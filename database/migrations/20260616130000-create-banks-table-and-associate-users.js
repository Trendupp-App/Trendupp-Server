'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create banks table
    await queryInterface.createTable('banks', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      country: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      region: {
        type: Sequelize.STRING,
        allowNull: false,
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
        type: Sequelize.DATE,
      },
    });

    // 2. Remove bank_name from users
    await queryInterface.removeColumn('users', 'bank_name');

    // 3. Add bank_id to users
    await queryInterface.addColumn('users', 'bank_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'banks',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'bank_id');
    await queryInterface.addColumn('users', 'bank_name', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.dropTable('banks');
  },
};
