'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add timeline JSONB column to campaign_applications table if it doesn't exist
    const appTableDescription = await queryInterface.describeTable('campaign_applications');
    if (!appTableDescription.timeline) {
      await queryInterface.addColumn('campaign_applications', 'timeline', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }

    // 2. Change campaigns.timeline column to JSONB safely using to_jsonb
    const campaignTableDescription = await queryInterface.describeTable('campaigns');
    if (campaignTableDescription.timeline) {
      await queryInterface.changeColumn('campaigns', 'timeline', {
        type: 'JSONB USING CASE WHEN timeline IS NULL THEN NULL ELSE to_jsonb(timeline::text) END',
        allowNull: true,
      });
    } else {
      await queryInterface.addColumn('campaigns', 'timeline', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const appTableDescription = await queryInterface.describeTable('campaign_applications');
    if (appTableDescription.timeline) {
      await queryInterface.removeColumn('campaign_applications', 'timeline');
    }

    const campaignTableDescription = await queryInterface.describeTable('campaigns');
    if (campaignTableDescription.timeline) {
      await queryInterface.changeColumn('campaigns', 'timeline', {
        type: 'TIMESTAMP WITH TIME ZONE USING NULL',
        allowNull: true,
      });
    }
  },
};
