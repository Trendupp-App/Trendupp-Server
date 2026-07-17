'use strict';

/**
 * Per-platform connect rules, editable at runtime (no deploy needed).
 * min_followers drives the eligibility check in SocialsService.connect and
 * the "Requires N+ followers" hint on the client platform cards.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('social_platform_settings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      platform: {
        type: Sequelize.STRING(16),
        allowNull: false,
        unique: true,
      },
      min_followers: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    const now = new Date();
    await queryInterface.bulkInsert(
      'social_platform_settings',
      [
        { platform: 'instagram', min_followers: 1000 },
        { platform: 'tiktok', min_followers: 1000 },
        { platform: 'youtube', min_followers: 500 },
        { platform: 'twitter', min_followers: 500 },
      ].map((row) => ({
        ...row,
        id: Sequelize.literal('gen_random_uuid()'),
        created_at: now,
        updated_at: now,
      })),
    );
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('social_platform_settings');
  },
};
