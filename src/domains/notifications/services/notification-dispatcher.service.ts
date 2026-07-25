import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { EmailService } from '../../../integration/email/email.service';
import { PushService } from '../../../integration/push/push.service';
import { NotificationRepository } from '../repository/notification.repository';
import { DeviceTokenRepository } from '../repository/device-token.repository';
import { NOTIFICATION_CATALOG } from '../notification.catalog';
import { CatalogEntry, NotifyInput } from '../notification.types';
import { CATEGORY_SETTINGS_KEY, NON_SUPPRESSIBLE_CATEGORIES } from '../notifications.constants';

/**
 * TikTok/Instagram signups get synthetic placeholder addresses
 * (`tiktok_<openId>@trendupp.tiktok`) that would bounce and hurt SES
 * reputation — the email leg is hard-skipped for them (in-app still delivers).
 */
const SYNTHETIC_EMAIL_PATTERN = /@trendupp\.(tiktok|instagram|facebook|apple)$/i;

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
    private readonly deviceTokenRepository: DeviceTokenRepository,
    private readonly emailService: EmailService,
    private readonly pushService: PushService,
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
   * - Non-suppressible categories ('security', 'chatDispute') bypass all
   *   toggles (except pushNotifications, below).
   * - Each display category maps to a users.notification_settings key via
   *   CATEGORY_SETTINGS_KEY; categories mapped to null are never muted.
   * - In-app: written when the category toggle is on; critical/high
   *   notifications land in the feed even when the category is off
   *   (the user opted out of noise, not of history).
   * - Email: category toggle AND the emailNotifications master toggle.
   * - Push: mirrors the in-app decision AND the pushNotifications master
   *   toggle. The toggle is honored even for security notifications — push is
   *   an interruption channel, and the user still gets the in-app row and
   *   email; it's "don't buzz my phone", not "hide this from me".
   */
  resolveChannels(
    user: Pick<User, 'notificationSettings'>,
    entry: CatalogEntry,
  ): { inApp: boolean; email: boolean; push: boolean } {
    const wantsInApp = entry.channels.includes('inApp');
    const wantsEmail = entry.channels.includes('email');

    const settings = (user.notificationSettings ?? {}) as Record<string, boolean>;
    // Missing key (pre-migration rows) counts as enabled, matching the JSONB defaults.
    const pushMasterOn = settings.pushNotifications !== false;

    if (NON_SUPPRESSIBLE_CATEGORIES.has(entry.category)) {
      return { inApp: wantsInApp, email: wantsEmail, push: wantsInApp && pushMasterOn };
    }

    const settingsKey = CATEGORY_SETTINGS_KEY[entry.category];
    const categoryOn = settingsKey ? settings[settingsKey] !== false : true;
    const emailMasterOn = settings.emailNotifications !== false;
    const isImportant = entry.priority === 'critical' || entry.priority === 'high';

    const inApp = wantsInApp && (categoryOn || isImportant);
    return {
      inApp,
      email: wantsEmail && categoryOn && emailMasterOn,
      push: inApp && pushMasterOn,
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
    // Role fan-outs are staff work items (disputes, escrow releases, team
    // changes). Staff can never mute notifications — there is no admin
    // notification-settings UI — so preference gating is bypassed entirely.
    const channels = input.recipientRole
      ? {
          inApp: entry.channels.includes('inApp'),
          email: entry.channels.includes('email'),
          push: entry.channels.includes('inApp'),
        }
      : this.resolveChannels(user, entry);
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

    if (channels.push) {
      await this.sendPush(user.id, input.type, title, body, actionUrl);
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
        data: {
          // Spread the full notification payload first so bespoke templates
          // (e.g. payment-escrow-receipt) can access type-specific fields like
          // transactionRef, escrowId, amount, etc.
          ...data,
          // Standard vars always available in every template:
          firstName: user.firstName,
          title,
          body,
          actionUrl,
          appUrl: this.appUrl,
        },
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

  /**
   * Push leg. Best-effort by design: the in-app row is already written, so a
   * push failure is logged, never thrown. Tokens FCM reports as dead are
   * pruned so the table tracks live installs only.
   */
  private async sendPush(
    userId: string,
    type: string,
    title: string,
    body: string,
    actionUrl: string | null,
  ): Promise<void> {
    if (!this.pushService.isConfigured) return;

    try {
      const devices = await this.deviceTokenRepository.findAllForUser(userId);
      if (devices.length === 0) return;

      const result = await this.pushService.sendToTokens(
        devices.map((d) => d.token),
        {
          title,
          body,
          // FCM data values must be strings; the mobile app routes on these.
          data: { type, actionUrl: actionUrl ?? '' },
        },
      );

      if (result.invalidTokens.length > 0) {
        await this.deviceTokenRepository.removeTokens(result.invalidTokens);
        this.logger.debug(
          `Pruned ${result.invalidTokens.length} dead device token(s) for user ${userId}.`,
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Push leg failed for "${type}" to user ${userId}: ${message}`);
    }
  }
}
