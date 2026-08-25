'use strict';

/**
 * Runtime kill-switches for authentication and social connects — flip rows in
 * the DB (no deploy needed) to control what users can do:
 *
 * 1. `auth_provider_settings` — per OAuth provider:
 *      signin_enabled=false, signup_enabled=false → provider fully off
 *      signin_enabled=true,  signup_enabled=false → existing users only
 *    Providers without a row behave as fully enabled (fail-open so a missed
 *    seed can never lock everyone out).
 *
 * 2. `social_platform_settings.enabled` — a disabled platform disappears from
 *    the connect list on web and mobile, and its connect endpoint refuses.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const crypto = require('crypto');

    await queryInterface.createTable('auth_provider_settings', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      provider: {
        type: Sequelize.STRING(16),
        allowNull: false,
        unique: true,
      },
      signin_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      signup_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
      deleted_at: { type: Sequelize.DATE },
    });

    const now = new Date();
    await queryInterface.bulkInsert(
      'auth_provider_settings',
      ['google', 'apple', 'facebook', 'tiktok', 'instagram'].map((provider) => ({
        id: crypto.randomUUID(),
        provider,
        signin_enabled: true,
        signup_enabled: true,
        created_at: now,
        updated_at: now,
      })),
    );

    await queryInterface.addColumn('social_platform_settings', 'enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('social_platform_settings', 'enabled');
    await queryInterface.dropTable('auth_provider_settings');
  },
};
