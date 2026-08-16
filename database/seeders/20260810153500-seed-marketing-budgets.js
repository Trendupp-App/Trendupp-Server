'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const crypto = require('crypto');
    const now = new Date();

    const budgets = [
      // NGN Ranges
      { value: '₦100,000 - ₦1,000,000', currency: 'NGN', min_value: 100000, max_value: 1000000 },
      { value: '₦1,000,000 - ₦5,000,000', currency: 'NGN', min_value: 1000000, max_value: 5000000 },
      { value: '₦5,000,000 - ₦25,000,000', currency: 'NGN', min_value: 5000000, max_value: 25000000 },
      { value: 'Above ₦25,000,000', currency: 'NGN', min_value: 25000000, max_value: null },

      // USD Ranges
      { value: '$100 - $1,000', currency: 'USD', min_value: 100, max_value: 1000 },
      { value: '$1,000 - $5,000', currency: 'USD', min_value: 1000, max_value: 5000 },
      { value: '$5,000 - $25,000', currency: 'USD', min_value: 5000, max_value: 25000 },
      { value: 'Above $25,000', currency: 'USD', min_value: 25000, max_value: null },
    ].map((b) => ({
      id: crypto.randomUUID(),
      value: b.value,
      currency: b.currency,
      min_value: b.min_value,
      max_value: b.max_value,
      created_at: now,
      updated_at: now,
    }));

    await queryInterface.bulkInsert('marketing_budgets', budgets, {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('marketing_budgets', null, {});
  },
};
