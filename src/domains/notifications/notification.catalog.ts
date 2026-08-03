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
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `New application on "${d.campaignTitle}"`,
    body: (d) =>
      `${d.creatorName} applied to your campaign "${d.campaignTitle}". Review their application to get started.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/applications`,
  },
  'application.accepted': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: () => `You're in! Application accepted`,
    body: (d) =>
      `Your application for "${d.campaignTitle}" was accepted. Next step: create and submit your content draft.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
    emailSubject: (d) => `Your application for "${d.campaignTitle}" was accepted — Trendupp`,
  },
  'application.rejected': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Application update on "${d.campaignTitle}"`,
    body: (d) =>
      `Your application for "${d.campaignTitle}" was not selected this time. Keep exploring — new campaigns go live regularly.`,
    actionUrl: () => `/campaigns/explore`,
  },
  'application.acceptance_undone': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Engagement cancelled on "${d.campaignTitle}"`,
    body: (d) =>
      `The accepted application on "${d.campaignTitle}" was reverted by an administrator. The campaign is open again.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },

  // ── Content submissions (gated on applicationUpdates) ─────────────────────
  'submission.draft_submitted': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Draft ready for review on "${d.campaignTitle}"`,
    body: (d) =>
      `A creator submitted a content draft for "${d.campaignTitle}". Review it to approve or request a revision.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/submissions`,
  },
  'submission.revision_resubmitted': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Revised draft ready on "${d.campaignTitle}"`,
    body: (d) =>
      `The creator submitted a revised draft for "${d.campaignTitle}". This revision must be approved or escalated to a dispute.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/submissions`,
  },
  'submission.draft_approved': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: () => `Draft approved — time to go live!`,
    body: (d) =>
      `Your draft for "${d.campaignTitle}" was approved. Post your content and submit the live link to complete the campaign.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
    emailSubject: (d) => `Your draft for "${d.campaignTitle}" was approved — Trendupp`,
  },
  'submission.revision_requested': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: (d) => `Revision requested on "${d.campaignTitle}"`,
    body: (d) =>
      `The brand requested changes to your draft for "${d.campaignTitle}"` +
      (d.feedback ? `: "${d.feedback}"` : '.'),
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'submission.live_posted': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Live post submitted on "${d.campaignTitle}"`,
    body: (d) => `The creator posted their content live for "${d.campaignTitle}". Review post.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/submissions`,
  },
  'submission.live_approved': {
    category: 'payments',
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
    category: 'payments',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: (d) => `Payment sent: ${money(d.amount, d.currency)}`,
    body: (d) =>
      `Your payout of ${money(d.amount, d.currency)} for "${d.campaignTitle}" has been sent to your bank account.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
    emailSubject: (d) => `You've been paid ${money(d.amount, d.currency)} — Trendupp`,
  },
  'payout.failed': {
    // Money-movement failure — critical, so it lands in-app even when the
    // paymentAlerts toggle is off; also fanned out to finance admins.
    category: 'payments',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: (d) => `Payout failed: ${money(d.amount, d.currency)}`,
    body: (d) =>
      `The payout of ${money(d.amount, d.currency)} for "${d.campaignTitle}" could not be completed (${d.reason}). Our team has been alerted and will retry.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'payout.escrow_pending': {
    // Finance-admin work item: release the escrow so the payout can proceed.
    category: 'payments',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Action required: escrow release pending`,
    body: (d) =>
      `A creator payout of ${money(d.amount, d.currency)} is blocked awaiting escrow release for campaign ${d.campaignId}. Release the escrow in the Pandascrow dashboard to unblock it.`,
    actionUrl: (d) => `/admin/campaigns/${d.campaignId}`,
  },
  'campaign.payment_confirmed': {
    category: 'payments',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: (d) => `Payment confirmed — "${d.campaignTitle}" is live!`,
    body: (d) =>
      `Your payment of ${money(d.amount, d.currency)} was confirmed and "${d.campaignTitle}" is now live. Creators can start applying.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
    emailSubject: (d) => `Payment confirmed — "${d.campaignTitle}" is now live`,
    emailTemplate: 'payment-escrow-receipt',
  },
  'campaign.completed': {
    category: 'campaigns',
    channels: ['inApp', 'email'],
    priority: 'medium',
    title: (d) => `Campaign completed: "${d.campaignTitle}"`,
    body: (d) =>
      `All deliverables and payouts for "${d.campaignTitle}" are done. The campaign is now complete.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'campaign.cancelled': {
    category: 'campaigns',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: (d) => `Campaign cancelled: "${d.campaignTitle}"`,
    body: (d) =>
      d.payoutAmount
        ? `"${d.campaignTitle}" was cancelled. A ${d.payoutPercentage}% payout of ${money(d.payoutAmount)} has been scheduled for 30 days from now.`
        : `"${d.campaignTitle}" was cancelled.` +
          (d.refundAmount ? ` A refund of ${money(d.refundAmount)} is scheduled.` : ''),
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'campaign.paused': {
    category: 'campaigns',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Campaign paused: "${d.campaignTitle}"`,
    body: (d) =>
      `"${d.campaignTitle}" was paused by platform administration.` +
      (d.reason ? ` Reason: ${d.reason}` : ''),
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'campaign.resumed': {
    category: 'campaigns',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Campaign resumed: "${d.campaignTitle}"`,
    body: (d) => `"${d.campaignTitle}" has been resumed and is active again.`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },

  // ── Social connections (account-change confirmations — never suppressible) ─
  'social.connected': {
    category: 'security',
    channels: ['inApp', 'email'],
    priority: 'low',
    title: (d) => `${d.platformLabel} connected`,
    body: (d) =>
      // platform handles may already carry a leading @ (e.g. YouTube customUrl)
      `@${String(d.username).replace(/^@+/, '')} was verified with ${Number(d.followerCount).toLocaleString('en-NG')} followers. Your creator tier is now ${d.tier}.`,
    actionUrl: () => `/settings/socials`,
    emailSubject: (d) => `Your ${d.platformLabel} account is now connected — Trendupp`,
  },
  'social.disconnected': {
    category: 'security',
    channels: ['inApp', 'email'],
    priority: 'low',
    title: (d) => `${d.platformLabel} disconnected`,
    body: (d) =>
      `Your ${d.platformLabel} account was disconnected. Your creator tier is now ${d.tier}. If this wasn't you, contact support.`,
    actionUrl: () => `/settings/socials`,
    emailSubject: (d) => `Your ${d.platformLabel} account was disconnected — Trendupp`,
  },

  // ── Disputes (contractual process — never suppressible) ───────────────────
  'dispute.raised': {
    category: 'chatDispute',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `A dispute was raised`,
    body: (d) =>
      `A dispute was raised on campaign ${d.campaignId}: "${d.reason}". An administrator will review it shortly.`,
    actionUrl: (d) => `/disputes/${d.disputeId}`,
  },
  'dispute.activated': {
    category: 'chatDispute',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Your dispute is under review`,
    body: (d) =>
      `An administrator opened a resolution chat for the dispute on campaign ${d.campaignId}. Join the conversation to share your side.`,
    actionUrl: (d) => `/disputes/${d.disputeId}`,
  },
  'dispute.resolved': {
    category: 'chatDispute',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Your dispute has been resolved`,
    body: (d) =>
      `The dispute on campaign ${d.campaignId} was resolved with outcome: ${d.escrowAction.replace(/_/g, ' ')}` +
      (d.resolutionNotes ? `. Notes: "${d.resolutionNotes}"` : '.'),
    actionUrl: (d) => `/disputes/${d.disputeId}`,
  },
  'dispute.escrow_action_required': {
    category: 'chatDispute',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Action required: execute dispute escrow decision`,
    body: (d) =>
      `Dispute ${d.disputeId} was resolved with escrow action "${d.escrowAction.replace(/_/g, ' ')}". Execute the corresponding escrow movement in the Pandascrow dashboard.`,
    // The admin app has no dispute detail route; the list page focuses via query param.
    actionUrl: (d) => `/admin/disputes?focus=${d.disputeId}`,
  },
  'dispute.rejected': {
    category: 'chatDispute',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Your dispute was declined`,
    body: (d) =>
      `The dispute on campaign ${d.campaignId} was reviewed and declined by an administrator. Reason: "${d.reason}".`,
    actionUrl: (d) => `/disputes/${d.disputeId}`,
  },

  // ── Admin / staff inbox ─────────────────────────────────────────────────────
  // Delivered via recipientRole fan-outs, which bypass all preference gating
  // (admins have no notification-settings UI). In-app only unless noted.
  'admin.team_member_invited': {
    category: 'account',
    channels: ['inApp'],
    priority: 'medium',
    title: (d) => `Team member invited: ${d.adminName}`,
    body: (d) => `${d.adminName} was invited to the admin team as ${d.roleName}.`,
    actionUrl: () => `/admin/team`,
  },
  'admin.team_member_suspended': {
    category: 'account',
    channels: ['inApp'],
    priority: 'medium',
    title: (d) => `Team member suspended: ${d.adminName}`,
    body: (d) => `${d.adminName}'s admin access was suspended.`,
    actionUrl: () => `/admin/team`,
  },
  'admin.team_member_reactivated': {
    category: 'account',
    channels: ['inApp'],
    priority: 'low',
    title: (d) => `Team member reactivated: ${d.adminName}`,
    body: (d) => `${d.adminName}'s admin access was restored.`,
    actionUrl: () => `/admin/team`,
  },
  'admin.team_member_removed': {
    category: 'account',
    channels: ['inApp'],
    priority: 'medium',
    title: (d) => `Team member removed: ${d.adminName}`,
    body: (d) => `${d.adminName} was removed from the admin team.`,
    actionUrl: () => `/admin/team`,
  },
  'broadcast.sent': {
    category: 'broadcast',
    channels: ['inApp'],
    priority: 'low',
    title: (d) => `Broadcast sent: "${d.title}"`,
    body: (d) => `Your broadcast "${d.title}" was delivered to ${d.totalRecipients} user(s).`,
    actionUrl: () => `/admin/notifications`,
  },
  // ── Social Impact — creator-facing (copy from the PM notification spec) ───
  'social_impact.tokens_awarded': {
    category: 'opportunities',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Tokens earned`,
    // Spec: no CTA on this one — hence no actionUrl.
    body: (d) => `You earned ${d.reward} token(s) for ${d.campaignTitle}.`,
  },
  'social_impact.reminder': {
    category: 'opportunities',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Campaign ending soon`,
    body: (d) =>
      `Your ${d.campaignTitle} participation window closes in ${d.remainingTime}. ` +
      `Publish your content and submit your live link before the deadline to earn ` +
      `your ${d.tokenReward} token(s).`,
    actionUrl: (d) => `/campaigns/social-impact/${d.campaignId}`,
  },
  'social_impact.final_reminder': {
    category: 'opportunities',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: () => `Final reminder`,
    body: (d) =>
      `Only 2 hours remain before ${d.campaignTitle} closes. Submit your live content now to receive your reward.`,
    actionUrl: (d) => `/campaigns/social-impact/${d.campaignId}`,
  },
  'social_impact.badge_earned': {
    category: 'account',
    channels: ['inApp', 'email'],
    priority: 'medium',
    title: () => `Badge earned`,
    body: (d) => `You've earned the ${d.badgeName} badge. It's now displayed on your profile.`,
    actionUrl: () => `/profile`,
  },
  'social_impact.paused': {
    category: 'opportunities',
    channels: ['inApp'],
    priority: 'high',
    title: () => `Campaign paused`,
    body: (d) =>
      `${d.campaignTitle} has been paused. Creator participation is temporarily unavailable.`,
    actionUrl: (d) => `/campaigns/social-impact/${d.campaignId}`,
  },
  'social_impact.resumed': {
    category: 'opportunities',
    channels: ['inApp'],
    priority: 'high',
    title: () => `Campaign resumed`,
    body: (d) => `${d.campaignTitle} has resumed and creators can participate again.`,
    actionUrl: (d) => `/campaigns/social-impact/${d.campaignId}`,
  },
  'social_impact.cancelled': {
    category: 'opportunities',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Campaign cancelled`,
    body: (d) => `${d.campaignTitle} has been cancelled. No further participation is allowed.`,
    actionUrl: (d) => `/campaigns/social-impact/${d.campaignId}`,
  },
  'social_impact.extended': {
    category: 'opportunities',
    channels: ['inApp'],
    priority: 'medium',
    title: () => `Campaign extended`,
    body: (d) =>
      `The submission deadline for ${d.campaignTitle} has been extended to ${d.newEndDate}.`,
    actionUrl: (d) => `/campaigns/social-impact/${d.campaignId}`,
  },

  // ── Social Impact — admin inbox (role fan-outs bypass preference gating;
  //    inApp implies push for staff, mirroring the other admin.* types) ──────
  'social_impact.admin_published': {
    category: 'campaigns',
    channels: ['inApp'],
    priority: 'medium',
    title: () => `Campaign published`,
    body: (d) => `${d.campaignTitle} is now live and visible to creators.`,
    actionUrl: (d) => `/admin/campaigns/social/${d.campaignId}`,
  },
  'social_impact.admin_paused': {
    category: 'campaigns',
    channels: ['inApp'],
    priority: 'medium',
    title: () => `Campaign paused`,
    body: (d) =>
      `${d.campaignTitle} has been paused. Creator participation is temporarily unavailable.`,
    actionUrl: (d) => `/admin/campaigns/social/${d.campaignId}`,
  },
  'social_impact.admin_resumed': {
    category: 'campaigns',
    channels: ['inApp'],
    priority: 'medium',
    title: () => `Campaign resumed`,
    body: (d) => `${d.campaignTitle} has resumed and creators can participate again.`,
    actionUrl: (d) => `/admin/campaigns/social/${d.campaignId}`,
  },
  'social_impact.admin_cancelled': {
    category: 'campaigns',
    channels: ['inApp'],
    priority: 'high',
    title: () => `Campaign cancelled`,
    body: (d) => `${d.campaignTitle} has been cancelled. No further participation is allowed.`,
    actionUrl: (d) => `/admin/campaigns/social/${d.campaignId}`,
  },
  'social_impact.admin_extended': {
    category: 'campaigns',
    channels: ['inApp'],
    priority: 'medium',
    title: () => `Campaign extended`,
    body: (d) =>
      `The submission deadline for ${d.campaignTitle} has been extended to ${d.newEndDate}.`,
    actionUrl: (d) => `/admin/campaigns/social/${d.campaignId}`,
  },
  'social_impact.admin_participant_joined': {
    category: 'campaigns',
    channels: ['inApp'],
    priority: 'low',
    title: () => `New participant`,
    body: (d) => `${d.participantCount} creator(s) have joined ${d.campaignTitle}.`,
    actionUrl: (d) => `/admin/campaigns/social/${d.campaignId}`,
  },
  'social_impact.admin_live_link_submitted': {
    category: 'campaigns',
    channels: ['inApp'],
    priority: 'medium',
    title: () => `Submission received`,
    body: (d) => `${d.creatorName} submitted a live content link for ${d.campaignTitle}.`,
    actionUrl: (d) => `/admin/campaigns/social/${d.campaignId}`,
  },
  'social_impact.admin_ended': {
    category: 'campaigns',
    channels: ['inApp'],
    priority: 'medium',
    title: () => `Campaign ended`,
    body: (d) => `${d.campaignTitle} has reached its submission deadline.`,
    actionUrl: (d) => `/admin/campaigns/social/${d.campaignId}`,
  },
  'social_impact.admin_completed': {
    category: 'campaigns',
    channels: ['inApp'],
    priority: 'medium',
    title: () => `Campaign completed`,
    body: (d) =>
      `All eligible creators have received their rewards. ${d.campaignTitle} is now complete.`,
    actionUrl: (d) => `/admin/campaigns/social/${d.campaignId}`,
  },
};
