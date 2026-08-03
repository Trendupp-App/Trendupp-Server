/**
 * Type layer for the notification system.
 *
 * Every notification type declares its payload shape here. The catalog
 * (notification.catalog.ts) must have exactly one entry per type, and
 * NotificationsService.notify() is typed against this map end-to-end —
 * a wrong payload shape at a call site is a compile error.
 */

/**
 * Display/filter category of a notification — the product taxonomy shown as
 * tabs in the clients (see GET /notifications/categories). Preference gating
 * maps each category to a users.notification_settings key separately via
 * CATEGORY_SETTINGS_KEY in notifications.constants.ts; 'security' and
 * 'chatDispute' bypass the category toggles entirely (a user must not be able
 * to opt out of "your account was suspended" or dispute proceedings).
 */
export type NotificationCategory =
  | 'campaigns'
  | 'applications'
  | 'payments'
  | 'chatDispute'
  | 'account'
  | 'security'
  | 'opportunities'
  | 'broadcast';

export type NotificationChannel = 'inApp' | 'email';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

/** Roles that can be targeted with a role fan-out (seeded staff role names). */
export type NotificationRecipientRole =
  'owner' | 'super_admin' | 'finance_admin' | 'moderator' | 'support_agent';

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
    /** Pandascrow transaction reference — used in the payment receipt email. */
    transactionRef?: string;
    /** Pandascrow escrow ID — used in the payment receipt email. */
    escrowId?: string;
    /** ISO timestamp of when the payment was confirmed. */
    paidAt?: string;
  };
  'campaign.completed': { campaignId: string; campaignTitle: string };
  'campaign.cancelled': {
    campaignId: string;
    campaignTitle: string;
    payoutAmount?: number;
    payoutPercentage?: number;
    refundAmount?: number;
    releaseDate?: string;
    reason?: string;
  };
  'campaign.paused': {
    campaignId: string;
    campaignTitle: string;
    reason?: string;
  };
  'campaign.resumed': {
    campaignId: string;
    campaignTitle: string;
  };

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
  'dispute.rejected': { disputeId: string; campaignId: string; reason: string };

  // ── Admin / staff inbox (delivered via role fan-outs; never suppressible) ──
  'admin.team_member_invited': { adminName: string; roleName: string };
  'admin.team_member_suspended': { adminName: string };
  'admin.team_member_reactivated': { adminName: string };
  'admin.team_member_removed': { adminName: string };
  'broadcast.sent': { broadcastId: string; title: string; totalRecipients: number };

  // ── Social Impact — creator-facing ────────────────────────────────────────
  'social_impact.tokens_awarded': {
    campaignId: string;
    campaignTitle: string;
    reward: number;
    totalTokens: number;
  };
  /** First reminder — timing tier depends on campaign duration (see scheduler). */
  'social_impact.reminder': {
    campaignId: string;
    campaignTitle: string;
    /** Human-readable window, e.g. "12 hours" — rendered into the body. */
    remainingTime: string;
    tokenReward: number;
  };
  /** Final reminder — always 2 hours before the campaign ends. */
  'social_impact.final_reminder': {
    campaignId: string;
    campaignTitle: string;
  };
  'social_impact.badge_earned': { badgeName: string };
  'social_impact.paused': { campaignId: string; campaignTitle: string };
  'social_impact.resumed': { campaignId: string; campaignTitle: string };
  'social_impact.cancelled': { campaignId: string; campaignTitle: string };
  'social_impact.extended': {
    campaignId: string;
    campaignTitle: string;
    /** Already formatted for display, e.g. "12 Aug 2026, 18:00". */
    newEndDate: string;
  };

  // ── Social Impact — admin inbox (role fan-outs; separate types because the
  //    deep link targets the admin console, not the creator app) ─────────────
  'social_impact.admin_published': { campaignId: string; campaignTitle: string };
  'social_impact.admin_paused': { campaignId: string; campaignTitle: string };
  'social_impact.admin_resumed': { campaignId: string; campaignTitle: string };
  'social_impact.admin_cancelled': { campaignId: string; campaignTitle: string };
  'social_impact.admin_extended': {
    campaignId: string;
    campaignTitle: string;
    newEndDate: string;
  };
  'social_impact.admin_participant_joined': {
    campaignId: string;
    campaignTitle: string;
    participantCount: number;
  };
  'social_impact.admin_live_link_submitted': {
    campaignId: string;
    campaignTitle: string;
    creatorName: string;
  };
  'social_impact.admin_ended': { campaignId: string; campaignTitle: string };
  'social_impact.admin_completed': { campaignId: string; campaignTitle: string };
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
  recipientRole?: NotificationRecipientRole | NotificationRecipientRole[];
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
