'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'notification_settings', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {
        newCampaigns: true,
        applicationUpdates: true,
        paymentAlerts: true,
        brandMessages: true,
        pushNotifications: true,
        emailNotifications: true,
        weeklySummary: false,
        marketingOffers: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'notification_settings');
  }
};
