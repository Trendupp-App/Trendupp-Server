import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Op } from 'sequelize';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../../users/entities/user.entity';
import { EmailService } from '../../../integration/email/email.service';

/**
 * Handles dormant / deactivated account lifecycle:
 *
 * Policy:
 *  - User deactivates their account → `isActive = false`, `deactivatedAt = <now>`
 *  - Day 60 → send one warning email: "account will be deleted in 30 days"
 *  - Day 90 → permanently delete the account (hard-delete from DB)
 *
 * Cron runs daily at 01:00 so it doesn't collide with the payout scheduler (midnight).
 */
@Injectable()
export class AccountLifecycleScheduler {
  private readonly logger = new Logger(AccountLifecycleScheduler.name);

  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    private readonly emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async processInactiveAccounts(): Promise<void> {
    this.logger.log('Running daily inactive-account lifecycle check...');

    const now = new Date();

    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const eightyNineDaysAgo = new Date(now);
    eightyNineDaysAgo.setDate(eightyNineDaysAgo.getDate() - 89);

    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // ── Step 1: Hard-delete accounts deactivated ≥ 90 days ago ──────────────
    const expiredAccounts = await this.userModel.findAll({
      where: {
        isActive: false,
        deactivatedAt: { [Op.lte]: ninetyDaysAgo },
      },
      attributes: ['id', 'email', 'firstName'],
    });

    if (expiredAccounts.length > 0) {
      this.logger.log(
        `Found ${expiredAccounts.length} account(s) past the 90-day window. Permanently deleting.`,
      );
      for (const user of expiredAccounts) {
        try {
          await this.userModel.destroy({ where: { id: user.id } });
          this.logger.log(`Permanently deleted account: ${user.email} (ID: ${user.id})`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Failed to delete account ${user.id}: ${msg}`);
        }
      }
    }

    // ── Step 2: Warn accounts deactivated ≥ 89 days ago but < 90 days ago (Day 89 warning) ───
    const tomorrowWarningCandidates = await this.userModel.findAll({
      where: {
        isActive: false,
        deactivatedAt: {
          [Op.gt]: ninetyDaysAgo,
          [Op.lte]: eightyNineDaysAgo,
        },
      },
      attributes: ['id', 'email', 'firstName'],
    });

    if (tomorrowWarningCandidates.length > 0) {
      this.logger.log(
        `Sending tomorrow deletion warning to ${tomorrowWarningCandidates.length} account(s).`,
      );
      for (const user of tomorrowWarningCandidates) {
        try {
          await this.emailService.sendAccountDeletionTomorrowWarning(user.email, user.firstName);
          this.logger.log(`Deletion tomorrow warning sent to: ${user.email}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Failed to send tomorrow warning to ${user.email}: ${msg}`);
        }
      }
    }

    // ── Step 3: Warn accounts deactivated ≥ 60 days ago but < 89 days ago (Day 60 warning) ───
    const warningCandidates = await this.userModel.findAll({
      where: {
        isActive: false,
        deactivatedAt: {
          [Op.gt]: eightyNineDaysAgo,
          [Op.lte]: sixtyDaysAgo,
        },
      },
      attributes: ['id', 'email', 'firstName'],
    });

    if (warningCandidates.length > 0) {
      this.logger.log(`Sending 30-day deletion warning to ${warningCandidates.length} account(s).`);
      for (const user of warningCandidates) {
        try {
          await this.emailService.sendAccountDeletionWarning(user.email, user.firstName);
          this.logger.log(`Deletion warning sent to: ${user.email}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Failed to send warning to ${user.email}: ${msg}`);
        }
      }
    }

    this.logger.log('Inactive-account lifecycle check complete.');
  }
}
