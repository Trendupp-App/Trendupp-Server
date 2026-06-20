'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create issue_categories table
    await queryInterface.createTable('issue_categories', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      description: {
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
    });

    // 2. Clear existing support tickets to avoid foreign key violations in local dev
    await queryInterface.bulkDelete('support_tickets', null, {});

    // 3. Remove old category column
    await queryInterface.removeColumn('support_tickets', 'category');

    // 4. Add issue_category_id column
    await queryInterface.addColumn('support_tickets', 'issue_category_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'issue_categories', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('support_tickets', 'issue_category_id');
    await queryInterface.addColumn('support_tickets', 'category', {
      type: Sequelize.STRING(100),
      allowNull: false,
    });
    await queryInterface.dropTable('issue_categories');
  },
};
