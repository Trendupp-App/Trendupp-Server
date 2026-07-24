'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = [
      'campaigns',
      'users',
      'campaign_applications',
      'campaign_platforms',
      'content_submissions',
      'payments',
      'payment_releases',
      'campaign_refunds',
      'disputes',
      'creator_categories',
      'niches',
      'platforms',
      'industries',
      'user_niches',
      'user_industries',
    ];

    for (const table of tables) {
      try {
        const tableDescription = await queryInterface.describeTable(table);
        if (!tableDescription.deleted_at && !tableDescription.deletedAt) {
          await queryInterface.addColumn(table, 'deleted_at', {
            type: Sequelize.DATE,
            allowNull: true,
          });
        }
      } catch {
        // Ignore table reading errors or non-existent tables
      }
    }
  },

  async down() {
    // No-op down migration
  },
};
