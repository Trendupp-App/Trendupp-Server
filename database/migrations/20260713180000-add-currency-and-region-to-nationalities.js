'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add columns to nationalities
    await queryInterface.addColumn('nationalities', 'currency', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'USD',
    });

    await queryInterface.addColumn('nationalities', 'is_african', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // 2. Add currency column to campaigns, payments, and payment_releases
    await queryInterface.addColumn('campaigns', 'currency', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'USD',
    });

    await queryInterface.addColumn('payments', 'currency', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'USD',
    });

    await queryInterface.addColumn('payment_releases', 'currency', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'USD',
    });

    // 3. Update nationalities data
    await queryInterface.sequelize.query(`
      UPDATE nationalities SET currency = 'NGN', is_african = true WHERE code = 'NG' OR name = 'Nigeria';
    `);

    await queryInterface.sequelize.query(`
      UPDATE nationalities SET currency = 'USD', is_african = true WHERE code IN ('GH', 'KE') OR name IN ('Ghana', 'Kenya');
    `);

    // 4. Update existing campaigns currency based on brand's country currency
    await queryInterface.sequelize.query(`
      UPDATE campaigns 
      SET currency = n.currency
      FROM users u
      JOIN nationalities n ON u.country_id = n.id
      WHERE campaigns.brand_id = u.id;
    `);

    // 5. Update existing payments and payment_releases currency based on their campaign's currency
    await queryInterface.sequelize.query(`
      UPDATE payments 
      SET currency = c.currency
      FROM campaigns c
      WHERE payments.campaign_id = c.id;
    `);

    await queryInterface.sequelize.query(`
      UPDATE payment_releases 
      SET currency = c.currency
      FROM campaigns c
      WHERE payment_releases.campaign_id = c.id;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('payment_releases', 'currency');
    await queryInterface.removeColumn('payments', 'currency');
    await queryInterface.removeColumn('campaigns', 'currency');
    await queryInterface.removeColumn('nationalities', 'is_african');
    await queryInterface.removeColumn('nationalities', 'currency');
  }
};
