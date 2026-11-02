'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const paymentsTable = await queryInterface.describeTable('payments');

    if (!paymentsTable.payment_channel) {
      await queryInterface.addColumn('payments', 'payment_channel', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!paymentsTable.channel_details) {
      await queryInterface.addColumn('payments', 'channel_details', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }

    const refundsTable = await queryInterface.describeTable('campaign_refunds');

    if (!refundsTable.refund_method) {
      await queryInterface.addColumn('campaign_refunds', 'refund_method', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!refundsTable.channel_details) {
      await queryInterface.addColumn('campaign_refunds', 'channel_details', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const paymentsTable = await queryInterface.describeTable('payments');
    if (paymentsTable.payment_channel) {
      await queryInterface.removeColumn('payments', 'payment_channel');
    }
    if (paymentsTable.channel_details) {
      await queryInterface.removeColumn('payments', 'channel_details');
    }

    const refundsTable = await queryInterface.describeTable('campaign_refunds');
    if (refundsTable.refund_method) {
      await queryInterface.removeColumn('campaign_refunds', 'refund_method');
    }
    if (refundsTable.channel_details) {
      await queryInterface.removeColumn('campaign_refunds', 'channel_details');
    }
  },
};

