'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('notifications', {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      actor_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      type: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      priority: {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'medium',
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      action_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      data: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      seen_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      // Email-leg audit: 'skipped' | 'sent' | 'mocked' | 'failed'
      email_status: {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'skipped',
      },
      email_error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      // Per-recipient idempotency key: '<type>:<dedupeKey>:<userId>'
      dedupe_key: {
        type: Sequelize.STRING(255),
        allowNull: true,
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

    // Feed pagination (user's notifications, newest first)
    await queryInterface.addIndex('notifications', ['user_id', 'created_at'], {
      name: 'idx_notifications_user_created',
    });

    // Hot path for the unread badge count — partial index keeps it tiny
    await queryInterface.sequelize.query(
      `CREATE INDEX idx_notifications_user_unread ON notifications (user_id)
       WHERE read_at IS NULL AND deleted_at IS NULL`,
    );

    // Idempotency guard: cron double-fires across PM2 instances and webhook
    // redeliveries insert the same dedupe_key and are silently rejected.
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX uq_notifications_dedupe_key ON notifications (dedupe_key)
       WHERE dedupe_key IS NOT NULL`,
    );

    await queryInterface.addIndex('notifications', ['type'], {
      name: 'idx_notifications_type',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('notifications');
  },
};
