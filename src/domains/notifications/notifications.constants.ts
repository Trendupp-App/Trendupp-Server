import { NotificationCategory } from './notification.types';

export const NOTIFICATIONS_QUEUE = 'notifications';

/**
 * The product taxonomy behind the category tabs in the clients
 * (GET /notifications/categories). Order here is display order.
 * The 'all' pseudo-category (no filter) is added by the endpoint, not stored.
 */
export interface NotificationCategoryInfo {
  id: NotificationCategory;
  label: string;
  description: string;
  /** Which users see this category as a tab. */
  audience: 'all' | 'creator' | 'brand';
}

export const NOTIFICATION_CATEGORIES: NotificationCategoryInfo[] = [
  {
    id: 'campaigns',
    label: 'Campaigns',
    description: 'Campaign paused/resumed/cancelled, completed, stage and deadline reminders',
    audience: 'all',
  },
  {
    id: 'applications',
    label: 'Applications',
    description:
      'Selected, not selected, new application received and application window closing ' +
      '(advertiser), and content submission updates',
    audience: 'all',
  },
  {
    id: 'payments',
    label: 'Payments',
    description: 'Payout/refund released or failed, escrow updates',
    audience: 'all',
  },
  {
    id: 'chatDispute',
    label: 'Chat Dispute',
    description:
      'Dispute opened, resolved, and anything tied to the resolution chat — disputes carry ' +
      'money consequences but the primary action is the conversation',
    audience: 'all',
  },
  {
    id: 'account',
    label: 'Account',
    description: 'Onboarding nudges, inactivity reminders, tier upgrades',
    audience: 'all',
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Account suspension, social account connected/disconnected',
    audience: 'all',
  },
  {
    id: 'opportunities',
    label: 'Opportunities',
    description: 'New campaigns matching your tier and niche',
    audience: 'creator',
  },
  {
    id: 'broadcast',
    label: 'Broadcast',
    description: 'Announcements from the Trendupp team',
    audience: 'all',
  },
];

/**
 * Preference gating: maps a display category to the users.notification_settings
 * key that mutes it. `null` = not user-mutable (always delivered per the
 * channel rules). The settings keys are unchanged from the original design so
 * GET/PATCH /profile/notifications keeps its public contract.
 */
export const CATEGORY_SETTINGS_KEY: Record<NotificationCategory, string | null> = {
  campaigns: 'applicationUpdates',
  applications: 'applicationUpdates',
  payments: 'paymentAlerts',
  opportunities: 'newCampaigns',
  account: null,
  broadcast: null,
  security: null,
  chatDispute: null,
};

/**
 * Categories that bypass ALL user toggles (except the pushNotifications
 * device toggle): security events and dispute proceedings.
 */
export const NON_SUPPRESSIBLE_CATEGORIES: ReadonlySet<NotificationCategory> = new Set([
  'security',
  'chatDispute',
]);
