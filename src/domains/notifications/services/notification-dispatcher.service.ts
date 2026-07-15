import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { EmailService } from '../../../integration/email/email.service';
import { NotificationRepository } from '../repository/notification.repository';
import { NOTIFICATION_CATALOG } from '../notification.catalog';
import { CatalogEntry, NotifyInput } from '../notification.types';

/**
 * TikTok/Instagram signups get synthetic placeholder addresses
 * (`tiktok_<openId>@trendupp.tiktok`) that would bounce and hurt SES
 * reputation — the email leg is hard-skipped for them (in-app still delivers).
 */
const SYNTHETIC_EMAIL_PATTERN = /@trendupp\.(tiktok|instagram)$/i;

/**
 * Does the actual work of delivering one notification: recipient resolution,
 * preference gating, in-app row insertion, and the email leg.
 *
 * Invoked by the BullMQ processor (normal path) and directly by
 * NotificationsService as an inline fallback when Redis is unreachable.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  private readonly appUrl: string;

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {
    this.appUrl = this.configService.get<string>('app.webUrl', 'https://trendupp.com');
  }

  async dispatch(input: NotifyInput): Promise<void> {
    const entry = NOTIFICATION_CATALOG[input.type] as CatalogEntry;
    if (!entry) {
      this.logger.error(`Unknown notification type "${input.type}" — dropping.`);
      return;
    }

    const recipients = await this.resolveRecipients(input);
    if (recipients.length === 0) {
      this.logger.warn(`No recipients resolved for notification "${input.type}".`);
      return;
    }

    // Per-recipient try/catch: one bad recipient never fails the batch.
    for (const user of recipients) {
      try {
        await this.deliverToRecipient(user, entry, input);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to deliver "${input.type}" to user ${user.id}: ${message}`);
      }
    }
  }

  /**
   * Resolves which channels apply for this user + catalog entry.
   * Pure preference logic — kept in one place so call sites can never
   * bypass or forget it.
   *
   * Policy (see NOTIFICATION_SYSTEM_PLAN.md §5):
   * - 'security' entries bypass all toggles.
   * - In-app: written when the category toggle is on; critical/high
   *   notifications land in the feed even when the category is off
   *   (the user opted out of noise, not of history).
   * - Email: category toggle AND the emailNotifications master toggle.
   */
  resolveChannels(
    user: Pick<User, 'notificationSettings'>,
    entry: CatalogEntry,
  ): { inApp: boolean; email: boolean } {
    const wantsInApp = entry.channels.includes('inApp');
    const wantsEmail = entry.channels.includes('email');

    if (entry.category === 'security') {
      return { inApp: wantsInApp, email: wantsEmail };
    }

    const settings = (user.notificationSettings ?? {}) as Record<string, boolean>;
    // Missing key (pre-migration rows) counts as enabled, matching the JSONB defaults.
    const categoryOn = settings[entry.category] !== false;
    const emailMasterOn = settings.emailNotifications !== false;
    const isImportant = entry.priority === 'critical' || entry.priority === 'high';

    return {
      inApp: wantsInApp && (categoryOn || isImportant),
      email: wantsEmail && categoryOn && emailMasterOn,
    };
  }

  private async resolveRecipients(input: NotifyInput): Promise<User[]> {
    if (input.recipientRole) {
      return this.userModel.findAll({
        attributes: ['id', 'email', 'firstName', 'lastName', 'notificationSettings'],
        include: [
          {
            model: Role,
            as: 'role',
            required: true,
            where: { name: input.recipientRole },
          },
        ],
      });
    }

    const ids = Array.isArray(input.recipientId)
      ? input.recipientId
      : input.recipientId
        ? [input.recipientId]
        : [];
    // Actor never notifies themselves (e.g. dispute raiser in a both-parties fan-out).
    const recipientIds = [...new Set(ids)].filter((id) => id && id !== input.actorId);
    if (recipientIds.length === 0) {
      return [];
    }

    return this.userModel.findAll({
      attributes: ['id', 'email', 'firstName', 'lastName', 'notificationSettings'],
      where: { id: recipientIds },
    });
  }

  private async deliverToRecipient(
    user: User,
    entry: CatalogEntry,
    input: NotifyInput,
  ): Promise<void> {
    const channels = this.resolveChannels(user, entry);
    if (!channels.inApp && !channels.email) {
      this.logger.debug(
        `Notification "${input.type}" fully suppressed by preferences for user ${user.id}.`,
      );
      return;
    }

    const data = input.data;
    const title = entry.title(data);
    const body = entry.body(data);
    const actionUrl = entry.actionUrl ? entry.actionUrl(data) : null;

    let notification;
    try {
      notification = await this.notificationRepository.create({
        userId: user.id,
        actorId: input.actorId ?? null,
        type: input.type,
        category: entry.category,
        priority: entry.priority,
        title,
        body,
        actionUrl,
        data: data,
        dedupeKey: input.dedupeKey ? `${input.type}:${input.dedupeKey}:${user.id}` : null,
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        // Already delivered (cron double-fire across PM2 instances, or a
        // redelivered webhook). Silently no-op — this is the idempotency guard.
        this.logger.debug(
          `Duplicate notification "${input.type}" for user ${user.id} suppressed by dedupe key.`,
        );
        return;
      }
      throw error;
    }

    if (!channels.email) {
      return; // emailStatus stays 'skipped' (the default) — auditable, not silent.
    }

    if (!user.email || SYNTHETIC_EMAIL_PATTERN.test(user.email)) {
      await notification.update({ emailStatus: 'skipped', emailError: 'synthetic_email' });
      return;
    }

    try {
      const result = await this.emailService.send({
        to: user.email,
        subject: entry.emailSubject ? entry.emailSubject(data) : title,
        template: entry.emailTemplate ?? 'generic-notification',
        data: { firstName: user.firstName, title, body, actionUrl, appUrl: this.appUrl },
        throwOnFailure: true,
      });
      await notification.update({ emailStatus: result });
    } catch (error: unknown) {
      // The in-app row already exists — an email failure never loses the
      // notification. Recorded for the ops/audit trail instead of retried.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Email leg failed for notification ${notification.id}: ${message}`);
      await notification.update({ emailStatus: 'failed', emailError: message });
    }
  }
}
