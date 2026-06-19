'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const crypto = require('crypto');

    // 1. Seed Creator Categories
    const categories = [
      { name: 'Nano', min_followers: 0, max_followers: 9999 },
      { name: 'Micro', min_followers: 10000, max_followers: 99999 },
      { name: 'Mid-tier', min_followers: 100000, max_followers: 499999 },
      { name: 'Macro', min_followers: 500000, max_followers: null },
    ].map((cat) => ({
      id: crypto.randomUUID(),
      name: cat.name,
      min_followers: cat.min_followers,
      max_followers: cat.max_followers,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await queryInterface.bulkInsert('creator_categories', categories, {});

    // 2. Seed Platforms
    const platforms = [
      { name: 'Instagram' },
      { name: 'TikTok' },
      { name: 'YouTube' },
      { name: 'Twitter' },
    ].map((plat) => ({
      id: crypto.randomUUID(),
      name: plat.name,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await queryInterface.bulkInsert('platforms', platforms, {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('platforms', null, {});
    await queryInterface.bulkDelete('creator_categories', null, {});
  },
};
