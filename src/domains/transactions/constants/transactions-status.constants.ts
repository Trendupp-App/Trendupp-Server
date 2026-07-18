export const PAYMENT_STATUS_DESCRIPTIONS: Record<string, string> = {
  paid: 'Escrow deposit confirmed and held for campaign',
  completed: 'Escrow deposit confirmed and held for campaign',
  unpaid: 'Escrow checkout initiated, awaiting payment confirmation',
  pending: 'Escrow checkout initiated, awaiting payment confirmation',
  failed: 'Escrow payment attempt failed',
};

export const PAYMENT_RELEASE_STATUS_DESCRIPTIONS: Record<string, string> = {
  released: "Payout successfully transferred to creator's bank account",
  pending: 'Payout scheduled, awaiting release date',
  escrow_pending: 'Payout queued, pending admin escrow release',
  on_hold: 'Payout placed on hold due to active dispute',
  failed: 'Payout transfer failed (will be retried)',
};

export const CAMPAIGN_REFUND_STATUS_DESCRIPTIONS: Record<string, string> = {
  completed: 'Unused campaign budget refunded to brand bank account',
  pending: 'Campaign refund queued for bank transfer',
  pending_bank_details: 'Refund pending — bank account details required',
  failed: 'Refund transfer failed',
};

export function getStatusDescription(
  table: 'payments' | 'payment_releases' | 'campaign_refunds',
  status: string,
): string {
  switch (table) {
    case 'payments':
      return PAYMENT_STATUS_DESCRIPTIONS[status] ?? 'Payment status updated';
    case 'payment_releases':
      return PAYMENT_RELEASE_STATUS_DESCRIPTIONS[status] ?? 'Payout status updated';
    case 'campaign_refunds':
      return CAMPAIGN_REFUND_STATUS_DESCRIPTIONS[status] ?? 'Refund status updated';
    default:
      return 'Status updated';
  }
}
