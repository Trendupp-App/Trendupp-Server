'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('device_tokens', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      // FCM registration tokens are opaque and can exceed 255 chars.
      token: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      platform: {
        type: Sequelize.STRING(16),
        allowNull: false,
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

    // A token identifies one physical device install — globally unique.
    // Re-registration by another user reassigns it (device changed accounts).
    await queryInterface.addIndex('device_tokens', ['token'], {
      unique: true,
      name: 'device_tokens_token_unique',
      where: { deleted_at: null },
    });
    await queryInterface.addIndex('device_tokens', ['user_id'], {
      name: 'device_tokens_user_id_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('device_tokens');
  },
};
