'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'city', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'website_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'monthly_budget', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'rep_first_name', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'rep_last_name', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'rep_email', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'rep_phone', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'city');
    await queryInterface.removeColumn('users', 'website_url');
    await queryInterface.removeColumn('users', 'monthly_budget');
    await queryInterface.removeColumn('users', 'rep_first_name');
    await queryInterface.removeColumn('users', 'rep_last_name');
    await queryInterface.removeColumn('users', 'rep_email');
    await queryInterface.removeColumn('users', 'rep_phone');
  },
};
