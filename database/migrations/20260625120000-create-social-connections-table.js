'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('social_connections', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      user_id: {
        allowNull: false,
        type: Sequelize.UUID,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      platform: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      platform_user_id: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      username: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      avatar_url: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      follower_count: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      is_verified: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      status: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: 'connected',
      },
      access_token: {
        allowNull: true,
        type: Sequelize.TEXT,
      },
      refresh_token: {
        allowNull: true,
        type: Sequelize.TEXT,
      },
      token_expires_at: {
        allowNull: true,
        type: Sequelize.DATE,
      },
      last_verified_at: {
        allowNull: true,
        type: Sequelize.DATE,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      deleted_at: {
        allowNull: true,
        type: Sequelize.DATE,
      },
    });

    // One connection per platform per user.
    await queryInterface.addConstraint('social_connections', {
      fields: ['user_id', 'platform'],
      type: 'unique',
      name: 'social_connections_user_platform_unique',
    });

    // Fast lookup of all connections for a user.
    await queryInterface.addIndex('social_connections', ['user_id'], {
      name: 'social_connections_user_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('social_connections');
  },
};
