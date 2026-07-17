/**
 * Type layer for the notification system.
 *
 * Every notification type declares its payload shape here. The catalog
 * (notification.catalog.ts) must have exactly one entry per type, and
 * NotificationsService.notify() is typed against this map end-to-end —
 * a wrong payload shape at a call site is a compile error.
 */

/**
 * Preference category a notification is gated on.
 * All values except 'security' are keys of users.notification_settings JSONB.
 * 'security' notifications bypass every user toggle (password/bank changes,
 * dispute lifecycle, money-movement failures) — a user must not be able to
 * opt out of "your bank account was changed".
 */
export type NotificationCategory =
  | 'newCampaigns'
  | 'applicationUpdates'
  | 'paymentAlerts'
  | 'brandMessages'
  | 'weeklySummary'
  | 'marketingOffers'
  | 'security';

export type NotificationChannel = 'inApp' | 'email';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

/** Roles that can be targeted with a role fan-out (seeded role names). */
export type NotificationRecipientRole = 'admin' | 'super_admin' | 'finance_admin';

/** Payload contract per notification type. */
export interface NotificationPayloads {
  // ── Applications ──────────────────────────────────────────────────────────
  'application.submitted': {
    campaignId: string;
    campaignTitle: string;
    applicationId: string;
    creatorName: string;
  };
  'application.accepted': { campaignId: string; campaignTitle: string; applicationId: string };
  'application.rejected': { campaignId: string; campaignTitle: string; applicationId: string };
  'application.acceptance_undone': {
    campaignId: string;
    campaignTitle: string;
    applicationId: string;
  };

  // ── Content submissions ───────────────────────────────────────────────────
  'submission.draft_submitted': { campaignId: string; campaignTitle: string; submissionId: string };
  'submission.revision_resubmitted': {
    campaignId: string;
    campaignTitle: string;
    submissionId: string;
  };
  'submission.draft_approved': { campaignId: string; campaignTitle: string; submissionId: string };
  'submission.revision_requested': {
    campaignId: string;
    campaignTitle: string;
    submissionId: string;
    feedback?: string;
  };
  'submission.live_posted': { campaignId: string; campaignTitle: string; submissionId: string };
  'submission.live_approved': {
    campaignId: string;
    campaignTitle: string;
    submissionId: string;
    amount: number;
    currency?: string;
    releaseDate: string;
  };

  // ── Payments & payouts ────────────────────────────────────────────────────
  'payout.released': {
    campaignId: string;
    campaignTitle: string;
    releaseId: string;
    amount: number;
    currency?: string;
  };
  'payout.failed': {
    campaignId: string;
    campaignTitle: string;
    releaseId: string;
    amount: number;
    currency?: string;
    reason: string;
  };
  'payout.escrow_pending': {
    campaignId: string;
    releaseId: string;
    amount: number;
    currency?: string;
  };
  'campaign.payment_confirmed': {
    campaignId: string;
    campaignTitle: string;
    amount: number;
    currency?: string;
  };
  'campaign.completed': { campaignId: string; campaignTitle: string };

  // ── Social connections ────────────────────────────────────────────────────
  'social.connected': {
    platform: string;
    platformLabel: string;
    username: string;
    followerCount: number;
    tier: string;
  };
  'social.disconnected': {
    platform: string;
    platformLabel: string;
    tier: string;
  };

  // ── Disputes ──────────────────────────────────────────────────────────────
  'dispute.raised': { disputeId: string; campaignId: string; reason: string };
  'dispute.activated': { disputeId: string; campaignId: string };
  'dispute.resolved': {
    disputeId: string;
    campaignId: string;
    escrowAction: string;
    resolutionNotes?: string;
  };
  'dispute.escrow_action_required': {
    disputeId: string;
    campaignId: string;
    escrowAction: string;
  };
}

export type NotificationType = keyof NotificationPayloads;

/**
 * One catalog entry fully describes a notification type: where it's gated,
 * which channels it uses, and how it renders for the in-app feed and email.
 */
export interface CatalogEntry<T extends NotificationType = NotificationType> {
  category: NotificationCategory;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  title: (data: NotificationPayloads[T]) => string;
  body: (data: NotificationPayloads[T]) => string;
  /** Client deep-link path (web route; mobile maps the same path). */
  actionUrl?: (data: NotificationPayloads[T]) => string;
  /** Defaults to the rendered title. */
  emailSubject?: (data: NotificationPayloads[T]) => string;
  /** EJS template name (without extension) in integration/email/templates. Defaults to 'generic-notification'. */
  emailTemplate?: string;
}

/** Input accepted by NotificationsService.notify(). */
export interface NotifyInput<T extends NotificationType = NotificationType> {
  type: T;
  /** Explicit recipient user id(s). Provide this OR recipientRole. */
  recipientId?: string | string[];
  /** Fan out to every user holding this role (seeded role names). */
  recipientRole?: NotificationRecipientRole;
  /** User who triggered the event (rendered as the actor in the feed). */
  actorId?: string;
  data: NotificationPayloads[T];
  /**
   * Idempotency key. REQUIRED for cron- and webhook-origin call sites:
   * @Cron fires on every PM2 instance and Pandascrow may redeliver webhooks.
   * Deduped at the queue level (BullMQ jobId) and at the DB level
   * (unique index on notifications.dedupe_key, stored per-recipient).
   */
  dedupeKey?: string;
}
