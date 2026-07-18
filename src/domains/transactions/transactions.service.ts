import { Injectable } from '@nestjs/common';
import {
  TransactionsRepository,
  CreatorEscrowItem,
  CreatorPayoutItem,
  BrandEscrowItem,
} from './repository/transactions.repository';
import { getStatusDescription } from './constants/transactions-status.constants';

@Injectable()
export class TransactionsService {
  constructor(private readonly txRepo: TransactionsRepository) {}

  // ─── CREATOR ────────────────────────────────────────────────────────────────

  /**
   * Returns the full creator payout dashboard:
   * - Summary wallet card (available balance, 30-day hold, total earned, total failed)
   * - Paginated transaction history (all statuses)
   * - Escrow tab: pending releases with dispute flags
   */
  async getCreatorPayouts(creatorId: string, page: number, limit: number) {
    const [summary, { rows: txRows, count: txCount }, escrowItems] = await Promise.all([
      this.txRepo.getCreatorPayoutSummary(creatorId),
      this.txRepo.getCreatorPayouts(creatorId, page, limit),
      this.txRepo.getCreatorEscrowItems(creatorId),
    ]);

    // Remap transaction statuses:
    // If an item is pending/escrow_pending AND there's an open dispute for its campaign,
    // surface it as "on_hold" so the UI can show the amber "On Hold" badge.
    const escrowDisputeMap = new Map<string, string | null>(
      escrowItems.map((e: CreatorEscrowItem) => [e.campaignId, e.disputeStatus]),
    );

    const transactions = txRows.map((tx: CreatorPayoutItem) => {
      let displayStatus = tx.status;
      let statusDescription = tx.statusDescription;
      if (
        (tx.status === 'pending' || tx.status === 'escrow_pending') &&
        escrowDisputeMap.has(tx.campaignId) &&
        escrowDisputeMap.get(tx.campaignId) !== null
      ) {
        displayStatus = 'on_hold';
        statusDescription = getStatusDescription('payment_releases', 'on_hold');
      }
      return { ...tx, status: displayStatus, statusDescription };
    });

    return {
      summary,
      transactions: {
        total: txCount,
        page,
        limit,
        pages: Math.ceil(txCount / limit),
        items: transactions,
      },
      escrow: {
        totalFundsYetToBeReleased: escrowItems.reduce(
          (sum: number, e: CreatorEscrowItem) => sum + e.amount,
          0,
        ),
        items: escrowItems,
      },
    };
  }

  // ─── BRAND ──────────────────────────────────────────────────────────────────

  /**
   * Returns the full brand "Manage Payments" dashboard:
   * - Summary card (escrow balance, 30-day hold, total payout)
   * - Paginated merged ledger (escrow funded + creator payouts + refunds)
   * - Active escrow positions
   */
  async getBrandPayments(brandId: string, page: number, limit: number) {
    const [summary, { rows: txRows, count: txCount }, escrowItems] = await Promise.all([
      this.txRepo.getBrandPaymentSummary(brandId),
      this.txRepo.getBrandTransactions(brandId, page, limit),
      this.txRepo.getBrandEscrowItems(brandId),
    ]);

    return {
      summary,
      transactions: {
        total: txCount,
        page,
        limit,
        pages: Math.ceil(txCount / limit),
        items: txRows,
      },
      escrow: {
        totalActiveEscrow: escrowItems.reduce(
          (sum: number, e: BrandEscrowItem) => sum + e.amount,
          0,
        ),
        items: escrowItems,
      },
    };
  }
}
