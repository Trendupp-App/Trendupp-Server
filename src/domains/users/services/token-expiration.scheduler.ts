import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { UserTokenLedger } from '../entities/user-token-ledger.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class TokenExpirationScheduler {
  private readonly logger = new Logger(TokenExpirationScheduler.name);

  constructor(
    @InjectModel(UserTokenLedger)
    private readonly tokenLedgerModel: typeof UserTokenLedger,
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  /**
   * Runs daily at 4:00 AM UTC.
   * Finds all active token ledger entries where `expiresAt <= NOW()` and `isExpired = false`,
   * marks them as expired, and recalculates totalTokens and badges for affected users.
   */
  @Cron('0 4 * * *')
  async handleTokenExpirations(): Promise<void> {
    this.logger.log('Starting daily 4:00 AM token expiration job...');

    try {
      const now = new Date();

      // 1. Find expired ledger records
      const expiredLedgers = await this.tokenLedgerModel.findAll({
        where: {
          expiresAt: { [Op.lte]: now },
          isExpired: false,
        },
      });

      if (expiredLedgers.length === 0) {
        this.logger.log('No tokens expired today.');
        return;
      }

      // Collect unique user IDs affected
      const affectedUserIds = Array.from(new Set(expiredLedgers.map((l) => l.userId)));

      // 2. Mark ledgers as expired
      await this.tokenLedgerModel.update(
        { isExpired: true, tokensRemaining: 0 },
        {
          where: {
            id: { [Op.in]: expiredLedgers.map((l) => l.id) },
          },
        },
      );

      // 3. Recalculate totalTokens and badge for affected users
      for (const userId of affectedUserIds) {
        const activeLedgers = await this.tokenLedgerModel.findAll({
          where: {
            userId,
            isExpired: false,
          },
        });

        const activeTotal = activeLedgers.reduce((acc, l) => acc + (l.tokensRemaining || 0), 0);

        let badge: string | null = null;
        if (activeTotal >= 1000) {
          badge = 'Impact Champion';
        } else if (activeTotal >= 100) {
          badge = 'Impact Leader';
        } else if (activeTotal >= 10) {
          badge = 'Impact Advocate';
        }

        await this.userModel.update({ totalTokens: activeTotal, badge }, { where: { id: userId } });
      }

      this.logger.log(
        `Successfully expired ${expiredLedgers.length} token ledger grants for ${affectedUserIds.length} users.`,
      );
    } catch (error) {
      this.logger.error('Error executing daily token expiration job', error);
    }
  }
}
