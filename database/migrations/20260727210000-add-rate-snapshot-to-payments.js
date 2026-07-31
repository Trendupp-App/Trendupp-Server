'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('payments', 'commission_rate', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn('payments', 'vat_rate', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    await queryInterface.addColumn('payments', 'gateway_rate', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('payments', 'commission_rate');
    await queryInterface.removeColumn('payments', 'vat_rate');
    await queryInterface.removeColumn('payments', 'gateway_rate');
  },
};
