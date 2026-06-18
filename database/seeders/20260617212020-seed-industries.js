'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const crypto = require('crypto');

    const industriesList = [
      'FMCG (Fast-Moving Consumer Goods)',
      'Technology & Software',
      'Finance & Banking',
      'Healthcare & Pharmaceuticals',
      'Real Estate & Construction',
      'Fashion & Beauty',
      'Food & Beverage',
      'Entertainment & Media',
      'Travel & Tourism',
      'Education & E-learning',
      'Automotive',
      'Agriculture & Forestry',
      'Retail & Consumer Goods',
      'Advertising & Marketing',
      'Energy, Utilities & Mining',
      'Non-Profit & Social Enterprise',
      'Telecommunications',
      'Manufacturing & Industrial',
      'Hospitality & Leisure',
      'Professional Services (Legal, Consulting)',
      'Sports & Recreation',
      'E-commerce'
    ];

    const industries = industriesList.map((name) => ({
      id: crypto.randomUUID(),
      name,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    // Idempotency: clear existing first
    await queryInterface.bulkDelete('industries', null, {});
    await queryInterface.bulkInsert('industries', industries, {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('industries', null, {});
  },
};
