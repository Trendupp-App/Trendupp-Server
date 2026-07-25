'use strict';

/**
 * Re-maps notifications.category from the old preference-key taxonomy
 * (applicationUpdates, paymentAlerts, security, ...) to the product taxonomy
 * shown as tabs in the clients (applications, campaigns, payments,
 * chatDispute, security, broadcast, ...). Mapping is derived from the
 * notification type, which is authoritative.
 */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE notifications SET category = CASE
        WHEN type LIKE 'dispute.%' THEN 'chatDispute'
        WHEN type = 'submission.live_approved' THEN 'payments'
        WHEN type LIKE 'payout.%' THEN 'payments'
        WHEN type = 'campaign.payment_confirmed' THEN 'payments'
        WHEN type LIKE 'application.%' OR type LIKE 'submission.%' THEN 'applications'
        WHEN type LIKE 'campaign.%' THEN 'campaigns'
        WHEN type LIKE 'social.%' THEN 'security'
        WHEN type LIKE 'broadcast.%' THEN 'broadcast'
        ELSE category
      END
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE notifications SET category = CASE
        WHEN type LIKE 'dispute.%' THEN 'security'
        WHEN type = 'submission.live_approved' THEN 'paymentAlerts'
        WHEN type = 'payout.released' THEN 'paymentAlerts'
        WHEN type LIKE 'payout.%' THEN 'security'
        WHEN type = 'campaign.payment_confirmed' THEN 'paymentAlerts'
        WHEN type LIKE 'application.%' OR type LIKE 'submission.%' THEN 'applicationUpdates'
        WHEN type LIKE 'campaign.%' THEN 'applicationUpdates'
        WHEN type LIKE 'social.%' THEN 'security'
        WHEN type LIKE 'broadcast.%' THEN 'announcements'
        ELSE category
      END
    `);
  },
};
