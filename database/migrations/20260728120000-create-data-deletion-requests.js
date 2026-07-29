'use strict';

/**
 * Meta (Facebook/Instagram) mandates a data-deletion callback: their servers
 * POST a signed_request and we must return a status URL + confirmation code
 * the user can check. This table is that audit trail.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('data_deletion_requests', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      confirmation_code: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      // 'instagram' | 'facebook' — which platform's callback fired.
      platform: {
        type: Sequelize.STRING(16),
        allowNull: false,
      },
      // Platform-scoped user id from the signed_request payload.
      platform_user_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      // Null when no Trendupp account matched (nothing to delete).
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      // 'completed' | 'no_data' | 'failed'
      status: {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'completed',
      },
      details: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('data_deletion_requests', ['confirmation_code'], {
      unique: true,
      name: 'data_deletion_requests_code_unique',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('data_deletion_requests');
  },
};
