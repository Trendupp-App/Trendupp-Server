'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface) => {
    const existingBatches = await queryInterface.sequelize.query(
      `SELECT id FROM "token_batches";`,
    );

    if (existingBatches[0].length > 0) {
      return;
    }

    const batches = [
      {
        id: uuidv4(),
        name: 'Starter Batch (50 Tokens)',
        amount: 50,
        description: 'Standard reward batch for entry-level social impact campaigns',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        name: 'Standard Batch (100 Tokens)',
        amount: 100,
        description: 'Popular reward batch for Micro and Nano creator campaigns',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        name: 'Growth Batch (250 Tokens)',
        amount: 250,
        description: 'Enhanced reward batch for high-impact social initiatives',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        name: 'Premium Batch (500 Tokens)',
        amount: 500,
        description: 'High-value reward batch for featured social impact campaigns',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        name: 'Mega Batch (1,000 Tokens)',
        amount: 1000,
        description: 'Maximum reward batch for top-tier social impact initiatives',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert('token_batches', batches);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('token_batches', null, {});
  },
};
