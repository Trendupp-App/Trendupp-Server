import { CatalogEntry, NotificationType } from './notification.types';

const CURRENCY_SYMBOLS: Record<string, string> = { NGN: '₦', USD: '$' };

const money = (amount: number, currency?: string): string => {
  const code = currency || 'NGN';
  const symbol = CURRENCY_SYMBOLS[code] ?? `${code} `;
  return `${symbol}${Number(amount).toLocaleString('en-NG')}`;
};

/**
 * The single source of truth for every notification type.
 *
 * Adding a new notification = add its payload interface to
 * notification.types.ts, add one entry here, and drop a one-line
 * notificationsService.notify() call at the trigger point. No new class,
 * queue, email method, or (usually) template is needed —
 * 'generic-notification.ejs' renders title/body/CTA for any entry that
 * doesn't name a bespoke emailTemplate.
 */
export const NOTIFICATION_CATALOG: { [T in NotificationType]: CatalogEntry<T> } = {
  // ── Applications (gated on notificationSettings.applicationUpdates) ───────
  'application.submitted': {
    category: 'applicationUpdates',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `New application on "${d.campaignTitle}"`,
    body: (d) =>
      `${d.creatorName} applied to your campaign "${d.campaignTitle}". Review their application to get started.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/applications`,
  },
  'application.accepted': {
    category: 'applicationUpdates',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: () => `You're in! Application accepted`,
    body: (d) =>
      `Your application for "${d.campaignTitle}" was accepted. Next step: create and submit your content draft.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
    emailSubject: (d) => `Your application for "${d.campaignTitle}" was accepted — Trendupp`,
  },
  'application.rejected': {
    category: 'applicationUpdates',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Application update on "${d.campaignTitle}"`,
    body: (d) =>
      `Your application for "${d.campaignTitle}" was not selected this time. Keep exploring — new campaigns go live regularly.`,
    actionUrl: () => `/campaigns/explore`,
  },
  'application.acceptance_undone': {
    category: 'applicationUpdates',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Engagement cancelled on "${d.campaignTitle}"`,
    body: (d) =>
      `The accepted application on "${d.campaignTitle}" was reverted by an administrator. The campaign is open again.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },

  // ── Content submissions (gated on applicationUpdates) ─────────────────────
  'submission.draft_submitted': {
    category: 'applicationUpdates',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Draft ready for review on "${d.campaignTitle}"`,
    body: (d) =>
      `A creator submitted a content draft for "${d.campaignTitle}". Review it to approve or request a revision.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/submissions`,
  },
  'submission.revision_resubmitted': {
    category: 'applicationUpdates',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Revised draft ready on "${d.campaignTitle}"`,
    body: (d) =>
      `The creator submitted a revised draft for "${d.campaignTitle}". This revision must be approved or escalated to a dispute.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/submissions`,
  },
  'submission.draft_approved': {
    category: 'applicationUpdates',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: () => `Draft approved — time to go live!`,
    body: (d) =>
      `Your draft for "${d.campaignTitle}" was approved. Post your content and submit the live link to complete the campaign.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
    emailSubject: (d) => `Your draft for "${d.campaignTitle}" was approved — Trendupp`,
  },
  'submission.revision_requested': {
    category: 'applicationUpdates',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: (d) => `Revision requested on "${d.campaignTitle}"`,
    body: (d) =>
      `The brand requested changes to your draft for "${d.campaignTitle}"` +
      (d.feedback ? `: "${d.feedback}"` : '.'),
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'submission.live_posted': {
    category: 'applicationUpdates',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Live post submitted on "${d.campaignTitle}"`,
    body: (d) =>
      `The creator posted their content live for "${d.campaignTitle}". Verify the post and approve it to schedule their payout.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/submissions`,
  },
  'submission.live_approved': {
    category: 'paymentAlerts',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: () => `Content approved — payout scheduled`,
    body: (d) =>
      `Your live post for "${d.campaignTitle}" was approved. A payout of ${money(d.amount, d.currency)} is scheduled for ${d.releaseDate}.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
    emailSubject: (d) => `Payout of ${money(d.amount, d.currency)} scheduled — Trendupp`,
  },

  // ── Payments & payouts ─────────────────────────────────────────────────────
  'payout.released': {
    category: 'paymentAlerts',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: (d) => `Payment sent: ${money(d.amount, d.currency)}`,
    body: (d) =>
      `Your payout of ${money(d.amount, d.currency)} for "${d.campaignTitle}" has been sent to your bank account.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
    emailSubject: (d) => `You've been paid ${money(d.amount, d.currency)} — Trendupp`,
  },
  'payout.failed': {
    // Money-movement failure — never suppressible, also fanned out to finance admins.
    category: 'security',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: (d) => `Payout failed: ${money(d.amount, d.currency)}`,
    body: (d) =>
      `The payout of ${money(d.amount, d.currency)} for "${d.campaignTitle}" could not be completed (${d.reason}). Our team has been alerted and will retry.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'payout.escrow_pending': {
    // Finance-admin work item: release the escrow so the payout can proceed.
    category: 'security',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Action required: escrow release pending`,
    body: (d) =>
      `A creator payout of ${money(d.amount, d.currency)} is blocked awaiting escrow release for campaign ${d.campaignId}. Release the escrow in the Pandascrow dashboard to unblock it.`,
    actionUrl: (d) => `/admin/campaigns/${d.campaignId}`,
  },
  'campaign.payment_confirmed': {
    category: 'paymentAlerts',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: (d) => `Payment confirmed — "${d.campaignTitle}" is live!`,
    body: (d) =>
      `Your payment of ${money(d.amount, d.currency)} was confirmed and "${d.campaignTitle}" is now live. Creators can start applying.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
    emailSubject: (d) => `"${d.campaignTitle}" is live — Trendupp`,
  },
  'campaign.completed': {
    category: 'applicationUpdates',
    channels: ['inApp', 'email'],
    priority: 'medium',
    title: (d) => `Campaign completed: "${d.campaignTitle}"`,
    body: (d) =>
      `All deliverables and payouts for "${d.campaignTitle}" are done. The campaign is now complete.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },

  // ── Social connections (account-change confirmations — in-app only) ───────
  'social.connected': {
    category: 'security',
    channels: ['inApp'],
    priority: 'low',
    title: (d) => `${d.platformLabel} connected`,
    body: (d) =>
      `@${d.username} was verified with ${Number(d.followerCount).toLocaleString('en-NG')} followers. Your creator tier is now ${d.tier}.`,
    actionUrl: () => `/settings/socials`,
  },
  'social.disconnected': {
    category: 'security',
    channels: ['inApp'],
    priority: 'low',
    title: (d) => `${d.platformLabel} disconnected`,
    body: (d) =>
      `Your ${d.platformLabel} account was disconnected. Your creator tier is now ${d.tier}. If this wasn't you, contact support.`,
    actionUrl: () => `/settings/socials`,
  },

  // ── Disputes (contractual process — never suppressible) ───────────────────
  'dispute.raised': {
    category: 'security',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `A dispute was raised`,
    body: (d) =>
      `A dispute was raised on campaign ${d.campaignId}: "${d.reason}". An administrator will review it shortly.`,
    actionUrl: (d) => `/disputes/${d.disputeId}`,
  },
  'dispute.activated': {
    category: 'security',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Your dispute is under review`,
    body: (d) =>
      `An administrator opened a resolution chat for the dispute on campaign ${d.campaignId}. Join the conversation to share your side.`,
    actionUrl: (d) => `/disputes/${d.disputeId}`,
  },
  'dispute.resolved': {
    category: 'security',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Your dispute has been resolved`,
    body: (d) =>
      `The dispute on campaign ${d.campaignId} was resolved with outcome: ${d.escrowAction.replace(/_/g, ' ')}` +
      (d.resolutionNotes ? `. Notes: "${d.resolutionNotes}"` : '.'),
    actionUrl: (d) => `/disputes/${d.disputeId}`,
  },
  'dispute.escrow_action_required': {
    category: 'security',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Action required: execute dispute escrow decision`,
    body: (d) =>
      `Dispute ${d.disputeId} was resolved with escrow action "${d.escrowAction.replace(/_/g, ' ')}". Execute the corresponding escrow movement in the Pandascrow dashboard.`,
    actionUrl: (d) => `/admin/disputes/${d.disputeId}`,
  },
};
