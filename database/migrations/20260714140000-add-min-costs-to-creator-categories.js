'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add columns to creator_categories
    await queryInterface.addColumn('creator_categories', 'min_cost_create_naira', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('creator_categories', 'min_cost_create_usd', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('creator_categories', 'min_cost_amplify_naira', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('creator_categories', 'min_cost_amplify_usd', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    // 2. Populate values based on spreadsheet
    // Nano (1K - 10K): Create = 50,000 NGN / $50, Amplify = 20,000 NGN / $20
    await queryInterface.sequelize.query(`
      UPDATE creator_categories
      SET min_cost_create_naira = 50000,
          min_cost_create_usd = 50,
          min_cost_amplify_naira = 20000,
          min_cost_amplify_usd = 20
      WHERE name = 'Nano';
    `);

    // Micro (10K - 200K): Create = 150,000 NGN / $150, Amplify = 100,000 NGN / $100
    await queryInterface.sequelize.query(`
      UPDATE creator_categories
      SET min_cost_create_naira = 150000,
          min_cost_create_usd = 150,
          min_cost_amplify_naira = 100000,
          min_cost_amplify_usd = 100
      WHERE name = 'Micro';
    `);

    // Macro (200K - 1M): Create = 500,000 NGN / $400, Amplify = 300,000 NGN / $250
    await queryInterface.sequelize.query(`
      UPDATE creator_categories
      SET min_cost_create_naira = 500000,
          min_cost_create_usd = 400,
          min_cost_amplify_naira = 300000,
          min_cost_amplify_usd = 250
      WHERE name = 'Macro';
    `);

    // Mega (1M+): Create = 2,500,000 NGN / $2,000, Amplify = 2,000,000 NGN / $1,500
    await queryInterface.sequelize.query(`
      UPDATE creator_categories
      SET min_cost_create_naira = 2500000,
          min_cost_create_usd = 2000,
          min_cost_amplify_naira = 2000000,
          min_cost_amplify_usd = 1500
      WHERE name = 'Mega';
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('creator_categories', 'min_cost_create_naira');
    await queryInterface.removeColumn('creator_categories', 'min_cost_create_usd');
    await queryInterface.removeColumn('creator_categories', 'min_cost_amplify_naira');
    await queryInterface.removeColumn('creator_categories', 'min_cost_amplify_usd');
  }
};
