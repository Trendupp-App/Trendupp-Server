'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      admin_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
      },
      action: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      target_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },
      ip_address: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      details: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
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

    // The feed lists newest-first and filters by action/admin.
    await queryInterface.addIndex('audit_logs', ['created_at'], {
      name: 'audit_logs_created_at_idx',
    });
    await queryInterface.addIndex('audit_logs', ['action'], {
      name: 'audit_logs_action_idx',
    });
    await queryInterface.addIndex('audit_logs', ['admin_id'], {
      name: 'audit_logs_admin_id_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('audit_logs');
  },
};
