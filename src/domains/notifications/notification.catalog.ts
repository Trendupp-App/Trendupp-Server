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
 * notificationsService.notify() call at the trigger point.
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
    inAppTitle: () => `New Application Received 🎯`,
    inAppBody: (d) =>
      `${d.creatorName} applied to your campaign. Review their application to get started.`,
    pushTitle: () => `New Application Received 🎯`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/applications`,
  },
  'application.accepted': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: () => `You're in! Application accepted`,
    body: (d) =>
      `Your application for "${d.campaignTitle}" was accepted. Next step: create and submit your content draft.`,
    inAppTitle: () => `Application Accepted! You're in. 🔥`,
    inAppBody: (d) =>
      `Your application for "${d.campaignTitle}" has been accepted. You have 3 - 5 days to create and submit your content for review.`,
    pushTitle: () => `Application Accepted! You're in. 🔥`,
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
    inAppTitle: () => `Application Rejected. Explore Other Paid Campaigns 👊🏽`,
    inAppBody: (d) =>
      `Your application for "${d.campaignTitle}" has been rejected. Keep exploring; apply to other paid campaigns.`,
    pushTitle: () => `Application Rejected. Explore Other Paid Campaigns 👊🏽`,
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
  'application.window_closing_soon': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Application window closing`,
    body: (d) => `${d.campaignTitle}'s window closes in 24 hours, apply now.`,
    inAppTitle: () => `Application Window Closes in 24 Hours ⏱️`,
    inAppBody: (d) =>
      `The application window for ${d.campaignTitle} closes in 24 hours. Apply now!`,
    pushTitle: () => `Application Window Closes in 24 Hours ⏱️`,
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
    inAppTitle: () => `Content Received for Review 📝`,
    inAppBody: (d) =>
      `A creator has submitted content for ${d.campaignTitle}. Approve or request a revision.`,
    pushTitle: () => `Content Received for Review 📝`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/submissions`,
  },
  'submission.revision_resubmitted': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Revised draft ready on "${d.campaignTitle}"`,
    body: (d) =>
      `The creator submitted a revised draft for "${d.campaignTitle}". This revision must be approved or escalated to a dispute.`,
    inAppTitle: () => `Revised Content Submitted 📝`,
    inAppBody: (d) =>
      `The creator submitted revised content for ${d.campaignTitle}. Approve or raise a dispute.`,
    pushTitle: () => `Revised Content Submitted 📝`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/submissions`,
  },
  'submission.draft_approved': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: () => `Draft approved — time to go live!`,
    body: (d) =>
      `Your draft for "${d.campaignTitle}" was approved. Post your content and submit the live link to complete the campaign.`,
    inAppTitle: () => `Your Content Has Been Approved! 🎉`,
    inAppBody: (d) =>
      `Your content for "${d.campaignTitle}" has been approved. Publish approved content on agreed platform(s) and submit post link(s) to conclude the campaign.`,
    pushTitle: () => `Your Content Has Been Approved! 🎉`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
    emailSubject: (d) => `Your draft for "${d.campaignTitle}" was approved — Trendupp`,
  },
  'submission.revision_requested': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: (d) => `Revision requested on "${d.campaignTitle}"`,
    body: (d) =>
      `The Advertiser requested changes to your draft for "${d.campaignTitle}"` +
      (d.feedback ? `: "${d.feedback}"` : '.'),
    inAppTitle: () => `Content Revision Requested 📝`,
    inAppBody: (d) =>
      `Advertiser has requested a revision on your content for ${d.campaignTitle}` +
      (d.feedback ? `: "${d.feedback}"` : '.'),
    pushTitle: () => `Content Revision Requested 📝`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'submission.deadline_approaching': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Submission deadline approaching`,
    body: (d) => `Your content for ${d.campaignTitle} is due in 24 hours.`,
    inAppTitle: () => `Content Submission Due in 24 Hours ⏱️`,
    inAppBody: (d) =>
      `Your content for ${d.campaignTitle} is due in 24 hours. Submit for review before the deadline.`,
    pushTitle: () => `Content Submission Due in 24 Hours ⏱️`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'submission.revision_deadline_approaching': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Revision deadline approaching`,
    body: (d) => `Your revised content for ${d.campaignTitle} is due in 24 hours.`,
    inAppTitle: () => `Content Revision Due in 24 Hours ⏱️`,
    inAppBody: (d) =>
      `Your revised content for ${d.campaignTitle} is due in 24 hours. Submit before the deadline.`,
    pushTitle: () => `Content Revision Due in 24 Hours ⏱️`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'submission.revision_approved': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: () => `Revised content approved`,
    body: (d) => `Your revised content for ${d.campaignTitle} was approved.`,
    inAppTitle: () => `Revised Content Approved! 🎉`,
    inAppBody: (d) =>
      `Your revised content for ${d.campaignTitle} was approved. Post the approved content on agreed platform(s) and submit post link(s) to conclude the campaign.`,
    pushTitle: () => `Revised Content Approved! 🎉`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'submission.live_posted': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Live post submitted on "${d.campaignTitle}"`,
    body: (d) => `The creator posted their content live for "${d.campaignTitle}". Review the post.`,
    inAppTitle: () => `Post Link Submitted ✅`,
    inAppBody: (d) =>
      `The creator shared the post link for "${d.campaignTitle}". Review now to conclude the campaign.`,
    pushTitle: () => `Post Link Submitted ✅`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/submissions`,
  },
  'submission.live_approved': {
    category: 'payments',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: () => `Content approved — payout scheduled`,
    body: (d) =>
      `Your live post for "${d.campaignTitle}" was approved. A payout of ${money(d.amount, d.currency)} is scheduled for ${d.releaseDate}.`,
    inAppTitle: () => `Content Approved! Payment in 30 Days 🤑`,
    inAppBody: (d) =>
      `Your post for "${d.campaignTitle}" has been approved and the campaign is now concluded. Expect payment in 30 days.`,
    pushTitle: () => `Content Approved! Payment in 30 Days 🤑`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
    emailSubject: (d) => `Payout of ${money(d.amount, d.currency)} scheduled — Trendupp`,
  },
  'submission.live_link_needed': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Live post link needed`,
    body: (d) => `You haven't submitted your live post link(s) for ${d.campaignTitle}.`,
    inAppTitle: () => `Submit Post Link to Facilitate Your Payment 🔔`,
    inAppBody: (d) =>
      `You are yet to submit your post link(s) for ${d.campaignTitle}. Submit now to facilitate your payment`,
    pushTitle: () => `Reminder: Submit Post Link to Facilitate Your Payment 🔔`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'submission.review_deadline_approaching': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Review deadline approaching`,
    body: (d) => `You have 24 hours left to review ${d.creatorName}'s content.`,
    inAppTitle: () => `Content Review Due in 24 Hours ⏱️`,
    inAppBody: (d) => `You have 24 hours left to review ${d.creatorName}'s content.`,
    pushTitle: () => `Content Review Due in 24 Hours ⏱️`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/submissions`,
  },
  'submission.revision_review_deadline_approaching': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Revision review deadline approaching`,
    body: (d) => `You have 24 hours left to review ${d.creatorName}'s revised content.`,
    inAppTitle: () => `Reviewed Content Approval Due in 24 Hours ⏱️`,
    inAppBody: (d) => `You have 24 hours left to review ${d.creatorName}'s revised content.`,
    pushTitle: () => `Reviewed Content Approval Due in 24 Hours ⏱️`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/submissions`,
  },
  'submission.live_post_review_needed': {
    category: 'applications',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Live post review needed`,
    body: (d) => `You haven't reviewed ${d.creatorName}'s live post yet.`,
    inAppTitle: () => `Review Published Post 🔔`,
    inAppBody: (d) =>
      `You are yet to review ${d.creatorName}'s published post for ${d.campaignTitle}. Review now to conclude the campaign.`,
    pushTitle: () => `Reminder: Review Published Post 🔔`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/submissions`,
  },

  // ── Payments & payouts ─────────────────────────────────────────────────────
  'payout.released': {
    category: 'payments',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: (d) => `Payment sent: ${money(d.amount, d.currency)}`,
    body: (d) =>
      `Your payout of ${money(d.amount, d.currency)} for "${d.campaignTitle}" has been sent to your bank account.`,
    inAppTitle: () => `You Have Been Paid 🤑`,
    inAppBody: (d) =>
      `${money(d.amount, d.currency)} has been sent as payment for "${d.campaignTitle}" to your bank account.`,
    pushTitle: () => `You Have Been Paid 🤑`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
    emailSubject: (d) => `You've been paid ${money(d.amount, d.currency)} — Trendupp`,
  },
  'payout.failed': {
    category: 'payments',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: (d) => `Payout failed: ${money(d.amount, d.currency)}`,
    body: (d) =>
      `The payout of ${money(d.amount, d.currency)} for "${d.campaignTitle}" could not be completed (${d.reason}). Our team has been alerted and will retry.`,
    inAppTitle: () => `Payment Failed.`,
    inAppBody: (d) =>
      `We couldn’t complete your payment for "${d.campaignTitle}" due to ${d.reason}. Kindly resolve.`,
    pushTitle: () => `Your Payment Failed. Kindly Resolve`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'payout.escrow_pending': {
    category: 'payments',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Action required: escrow release pending`,
    body: (d) =>
      `A creator payout of ${money(d.amount, d.currency)} is blocked awaiting escrow release for campaign ${d.campaignId}. Release the escrow in the Pandascrow dashboard to unblock it.`,
    inAppTitle: () => `Action Required: Escrow Release Pending`,
    inAppBody: (d) =>
      `A creator payout of ${money(d.amount, d.currency)} for ${d.campaignId} is awaiting escrow release.`,
    pushTitle: () => `Action Required: Escrow Release Pending`,
    actionUrl: (d) => `/admin/campaigns/${d.campaignId}`,
  },
  'refund.sent': {
    category: 'payments',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Refund sent`,
    body: (d) => `${money(d.amount, d.currency)} has been refunded for ${d.campaignTitle}.`,
    inAppTitle: () => `You Have Been Refunded! 💰`,
    inAppBody: (d) =>
      `Your ${money(d.amount, d.currency)} refund for "${d.campaignTitle}" has been sent to your bank account.`,
    pushTitle: () => `You Have Been Refunded! 💰`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'refund.failed': {
    category: 'payments',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Refund failed`,
    body: (d) =>
      `The refund of ${money(d.amount, d.currency)} for "${d.campaignTitle}" could not be completed (${d.reason}). Our team has been alerted and will retry.`,
    inAppTitle: () => `Refund Failed. Kindly Resolve`,
    inAppBody: (d) =>
      `We couldn’t complete your ${money(d.amount, d.currency)} refund for ${d.campaignTitle} due to ${d.reason}. Kindly resolve.`,
    pushTitle: () => `Refund Failed. Contact Support`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'campaign.payment_confirmed': {
    category: 'payments',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: (d) => `Payment confirmed — "${d.campaignTitle}" is live!`,
    body: (d) =>
      `Your payment of ${money(d.amount, d.currency)} was confirmed and "${d.campaignTitle}" is now live. Creators can start applying.`,
    inAppTitle: () => `Payment Confirmed! Campaign Is Now Live 💰`,
    inAppBody: (d) =>
      `Your ${money(d.amount, d.currency)} payment has been received, and your "${d.campaignTitle}" is now live. Creators have been notified to start applying.`,
    pushTitle: () => `Payment Confirmed! Your Campaign Is Now Live 💰`,
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
    inAppTitle: () => `Campaign Completed! 🍾`,
    inAppBody: (d) =>
      `All deliverables / payouts for "${d.campaignTitle}" have been done. The campaign is now concluded.`,
    pushTitle: () => `Campaign Completed! 🍾`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'campaign.cancelled': {
    category: 'campaigns',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: () => `Campaign cancelled`,
    body: (d) =>
      `${d.campaignTitle} has been cancelled by Trendupp. Any applicable refunds and creator payouts will be processed according to the campaign status.`,
    inAppTitle: () => `Campaign Cancelled`,
    inAppBody: (d) =>
      `${d.campaignTitle} has been cancelled. Any applicable refunds or creator payouts will be processed according to campaign status.`,
    pushTitle: (d) => `${d.campaignTitle} Campaign Cancelled`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'campaign.paused': {
    category: 'campaigns',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Campaign paused`,
    body: (d) => `${d.campaignTitle} has been paused by Trendupp.`,
    inAppTitle: () => `Campaign Paused ✋🏽`,
    inAppBody: (d) =>
      `Creator participation has been paused on ${d.campaignTitle}. Pending resolution.`,
    pushTitle: (d) => `${d.campaignTitle} Campaign Paused ✋🏽`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'campaign.resumed': {
    category: 'campaigns',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Campaign resumed`,
    body: (d) => `${d.campaignTitle} is active again.`,
    inAppTitle: () => `Campaign Is Active Again 🚀`,
    inAppBody: (d) => `Creator participation has resumed on ${d.campaignTitle}.`,
    pushTitle: (d) => `${d.campaignTitle} Campaign Is Active Again 🚀`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },

  // ── Account & Opportunities ───────────────────────────────────────────────
  'opportunity.new_campaign': {
    category: 'opportunities',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `New campaign for you`,
    body: (d) => `A new ${d.niche || 'matching'} campaign matches your tier.`,
    inAppTitle: () => `New Campaign Brief 📝`,
    inAppBody: (d) =>
      `${d.advertiserName} published a new campaign. Review and apply to get started.`,
    pushTitle: () => `New Campaign Brief 📝`,
    actionUrl: (d) => `/campaigns/${d.campaignId}`,
  },
  'account.suspended': {
    category: 'security',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: () => `Account suspended`,
    body: (d) =>
      `Your account has been suspended. Reason: ${d.reason}. Contact Support if you believe this is an error or need help restoring your account.`,
    inAppTitle: () => `Your Account Has Been Suspended 🚫`,
    inAppBody: (d) => `Your Trendupp account has been suspended due to ${d.reason}.`,
    pushTitle: () => `Your Account Has Been Suspended 🚫`,
    actionUrl: () => `/support`,
  },
  'campaign_access.suspended': {
    category: 'security',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Campaign access suspended`,
    body: () =>
      `Your access to campaigns has been suspended. You won't be able to apply for or participate in campaigns until your access is restored.`,
    inAppTitle: () => `Your Campaign Access Has Been Suspended`,
    inAppBody: () =>
      `You will be unable to apply for or participate in campaigns until your access is restored. Kindly support.`,
    pushTitle: () => `Your Campaign Access Has Been Suspended. Contact Support`,
    actionUrl: () => `/support`,
  },
  'campaign.unfunded_reminder': {
    category: 'campaigns',
    channels: ['inApp', 'email'],
    priority: 'medium',
    title: () => `Complete your campaign setup`,
    body: (d) => `${d.campaignTitle} is still in draft, fund it to go live.`,
    inAppTitle: () => `Fund Your Campaign to Go Live`,
    inAppBody: (d) =>
      `${d.campaignTitle} is still in your draft. Fund and launch your campaign to start receiving applications from creators.`,
    pushTitle: () => `Fund Your Campaign to Go Live`,
    actionUrl: (d) => `/campaigns/${d.campaignId}/checkout`,
  },
  'onboarding.nudge': {
    category: 'account',
    channels: ['inApp', 'email'],
    priority: 'low',
    title: () => `Finish setting up your profile`,
    body: () => `You're almost done, complete your profile to unlock campaigns.`,
    inAppTitle: () => `Complete Your Profile Setup`,
    inAppBody: (d) =>
      d.role === 'brand'
        ? `You’re almost there! Complete your profile to launch your first campaign.`
        : `You’re almost there! Complete your profile to start applying for paid campaigns.`,
    pushTitle: (d) =>
      d.role === 'brand'
        ? `Complete Your Profile to Launch Your First Campaign`
        : `Complete Your Profile to Start Applying for Paid Campaigns`,
    actionUrl: () => `/settings/profile`,
  },
  'tier.upgraded': {
    category: 'account',
    channels: ['inApp', 'email'],
    priority: 'medium',
    title: () => `You leveled up`,
    body: (d) => `You're now a ${d.newTier} creator. Keep up the great work!`,
    inAppTitle: (d) => `Congratuations! You’re Now a ${d.newTier} Creator 🎖️`,
    inAppBody: (d) => `You’re now a ${d.newTier} creator. Keep earning on Trendupp.`,
    pushTitle: (d) => `Congratuations! You’re Now a ${d.newTier} Creator 🎖️`,
    actionUrl: () => `/profile`,
  },

  // ── Social connections (account-change confirmations — never suppressible) ─
  'social.connected': {
    category: 'security',
    channels: ['inApp', 'email'],
    priority: 'low',
    title: (d) => `${d.platformLabel} connected`,
    body: (d) =>
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
    inAppTitle: () => `Dispute Raised. Click to Resolve`,
    inAppBody: (d) => `Dispute raised on campaign ${d.campaignId} due to ${d.reason}. Review now.`,
    pushTitle: () => `Dispute Raised. Click to Resolve`,
    actionUrl: (d) => `/disputes/${d.disputeId}`,
  },
  'dispute.activated': {
    category: 'chatDispute',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Dispute opened, payout/refund on hold`,
    body: (d) =>
      `A dispute has been opened on campaign ${d.campaignId} and your payout/refund is on hold until it's resolved. Join the conversation to share your side.`,
    inAppTitle: () => `Dispute Raised. Click to Resolve`,
    inAppBody: (d) =>
      `A dispute has been opened on campaign ${d.campaignId}, and your payout/refund is on hold. Join the chat to resolve.`,
    pushTitle: () => `Dispute Raised. Click to Resolve`,
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
    actionUrl: (d) => `/admin/disputes?focus=${d.disputeId}`,
  },
  'dispute.rejected': {
    category: 'chatDispute',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Dispute rejected`,
    body: (d) => `Your chat request was reviewed and not approved: "${d.reason}".`,
    inAppTitle: (d) => `Dispute Request Rejected Due to ${d.reason}`,
    inAppBody: (d) => `After review, your dispute request was rejected due to ${d.reason}.`,
    pushTitle: () => `Your Dispute Request has Been Rejected`,
    actionUrl: (d) => `/disputes/${d.disputeId}`,
  },

  // ── Admin / staff inbox ─────────────────────────────────────────────────────
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
  'admin.dispute_pending_activation': {
    category: 'chatDispute',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Dispute request awaiting activation`,
    body: (d) =>
      `${d.userName} raised a dispute request on ${d.campaignTitle}. Review and activate to open the resolution chat.`,
    inAppTitle: () => `Action Required: Accept / Reject Dispute Request`,
    inAppBody: (d) =>
      `${d.userName} raised a dispute request on ${d.campaignTitle}. Click to review.`,
    pushTitle: () => `Action Required: Accept / Reject Dispute Request`,
    actionUrl: (d) => `/admin/disputes?focus=${d.disputeId}`,
  },
  'admin.dispute_open_too_long': {
    category: 'chatDispute',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: (d) => `Dispute open for ${d.daysOpen} days`,
    body: (d) =>
      `The dispute on ${d.campaignTitle} has been open for ${d.daysOpen} days with no final action. Please review.`,
    inAppTitle: () => `Action Required: Dispute Resolution Still Pending`,
    inAppBody: (d) =>
      `The dispute on campaign ${d.campaignTitle} has been open for several days with no resolution. Click to review.`,
    pushTitle: () => `Action Required: Dispute Resolution Still Pending`,
    actionUrl: (d) => `/admin/disputes?focus=${d.disputeId}`,
  },
  'admin.stage_overdue': {
    category: 'campaigns',
    channels: ['inApp'],
    priority: 'high',
    title: (d) => `${d.userName} is overdue on ${d.stageName}`,
    body: (d) => `${d.userName}'s ${d.stageName} for ${d.campaignTitle} is now overdue.`,
    inAppTitle: (d) => `${d.userName} Is Late on ${d.stageName}`,
    inAppBody: (d) => `${d.userName} has missed the ${d.stageName} window for ${d.campaignTitle}.`,
    pushTitle: (d) => `${d.userName} Is Late on ${d.stageName}`,
    actionUrl: (d) => `/admin/campaigns/${d.campaignId}`,
  },
  'broadcast.sent': {
    category: 'broadcast',
    channels: ['inApp'],
    priority: 'low',
    title: (d) => `Broadcast sent: "${d.title}"`,
    body: (d) => `Your broadcast "${d.title}" was delivered to ${d.totalRecipients} user(s).`,
    actionUrl: () => `/admin/notifications`,
  },

  // ── Social Impact — creator-facing ────────────────────────────────────────
  'social_impact.tokens_awarded': {
    category: 'opportunities',
    channels: ['inApp', 'email'],
    priority: 'high',
    title: () => `Tokens earned`,
    body: (d) => `You earned ${d.reward} token(s) for ${d.campaignTitle}.`,
    inAppTitle: () => `Congratulations! You Have Earned New Tokens! 🤩`,
    inAppBody: (d) =>
      `You have earned ${d.reward} tokens for your participation on ${d.campaignTitle}.`,
    pushTitle: () => `Congratulations! You Have Earned New Tokens! 🤩`,
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
    inAppTitle: () => `Social Campaign Ends Soon`,
    inAppBody: () =>
      `Publish your content on your social platform(s) and submit the post link(s) before the deadline to receive your tokens.`,
    pushTitle: () => `Social Campaign Ends Soon. Upload Content Now`,
    actionUrl: (d) => `/campaigns/social-impact/${d.campaignId}`,
  },
  'social_impact.final_reminder': {
    category: 'opportunities',
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: () => `Final reminder`,
    body: (d) =>
      `Only 2 hours remain before ${d.campaignTitle} closes. Submit your live content now to receive your reward.`,
    inAppTitle: () => `2 Hours to Go ⏱️`,
    inAppBody: (d) =>
      `Only 2 hours before ${d.campaignTitle} closes. Submit your post link(s) now to receive your tokens.`,
    pushTitle: () => `Social Campaign Ends in 2 Hours. Upload Content Now`,
    actionUrl: (d) => `/campaigns/social-impact/${d.campaignId}`,
  },
  'social_impact.badge_earned': {
    category: 'account',
    channels: ['inApp', 'email'],
    priority: 'medium',
    title: () => `Badge earned`,
    body: (d) => `You've earned the ${d.badgeName} badge. It's now displayed on your profile.`,
    inAppTitle: () => `Congratulations! You Have Earned a New Badge🎖️`,
    inAppBody: (d) =>
      `You've earned the ${d.badgeName} badge. Keep participating in social campaigns for more rewards.`,
    pushTitle: () => `Congratulations! You Have Earned a New Badge 🎖️`,
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

  // ── Social Impact — admin inbox ───────────────────────────────────────────
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
