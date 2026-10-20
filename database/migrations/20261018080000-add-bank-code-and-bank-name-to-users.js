'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');

    if (!tableInfo.bank_code) {
      await queryInterface.addColumn('users', 'bank_code', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!tableInfo.bank_name) {
      await queryInterface.addColumn('users', 'bank_name', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('users');

    if (tableInfo.bank_code) {
      await queryInterface.removeColumn('users', 'bank_code');
    }

    if (tableInfo.bank_name) {
      await queryInterface.removeColumn('users', 'bank_name');
    }
  },
};

