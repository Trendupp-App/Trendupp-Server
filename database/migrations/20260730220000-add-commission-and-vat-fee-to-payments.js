'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('payments', 'commission_fee', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn('payments', 'vat_fee', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('payments', 'commission_fee');
    await queryInterface.removeColumn('payments', 'vat_fee');
  },
};
