'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const crypto = require('crypto');

    // 1. Seed Niches
    const niches = [
      'Sports', 'Fitness', 'Comedy', 'Travel', 'Beauty', 'Parenting',
      'Finance', 'Technology', 'Lifestyle', 'Music', 'Food & Drink', 'Gaming'
    ].map((name, index) => ({
      id: crypto.randomUUID(),
      name,
      order: index + 1,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await queryInterface.bulkInsert('niches', niches, {});

    // 2. Seed Nationalities & States
    const nationalitiesData = [
      { name: 'Nigeria', code: 'NG', states: ['Lagos', 'Abuja', 'Rivers', 'Oyo', 'Kano', 'Kaduna', 'Delta'] },
      { name: 'Ghana', code: 'GH', states: ['Greater Accra', 'Ashanti', 'Western', 'Eastern'] },
      { name: 'Kenya', code: 'KE', states: ['Nairobi', 'Mombasa', 'Kisumu'] },
      { name: 'United Kingdom', code: 'GB', states: ['England', 'Scotland', 'Wales', 'Northern Ireland'] },
      { name: 'United States', code: 'US', states: ['California', 'New York', 'Texas', 'Florida'] },
    ];

    const nationalities = [];
    const states = [];

    for (const nat of nationalitiesData) {
      const nationalityId = crypto.randomUUID();
      nationalities.push({
        id: nationalityId,
        name: nat.name,
        code: nat.code,
        created_at: new Date(),
        updated_at: new Date(),
      });

      for (const stateName of nat.states) {
        states.push({
          id: crypto.randomUUID(),
          name: stateName,
          nationality_id: nationalityId,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }

    await queryInterface.bulkInsert('nationalities', nationalities, {});
    await queryInterface.bulkInsert('states', states, {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('states', null, {});
    await queryInterface.bulkDelete('nationalities', null, {});
    await queryInterface.bulkDelete('niches', null, {});
  }
};
