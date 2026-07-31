'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add reward_tokens to creator_categories
    await queryInterface.addColumn('creator_categories', 'reward_tokens', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    // Seed token rewards for existing creator categories based on tier rules:
    // Nano (1K-10K): 1 Token
    // Micro (10K-200K): 3 Tokens
    // Macro (200K-1M): 5 Tokens
    // Mega (1M+): 10 Tokens
    await queryInterface.bulkUpdate('creator_categories', { reward_tokens: 1 }, { name: 'Nano' });
    await queryInterface.bulkUpdate('creator_categories', { reward_tokens: 3 }, { name: 'Micro' });
    await queryInterface.bulkUpdate('creator_categories', { reward_tokens: 5 }, { name: 'Macro' });
    await queryInterface.bulkUpdate('creator_categories', { reward_tokens: 10 }, { name: 'Mega' });

    // 2. Add total_tokens and badge to users table
    await queryInterface.addColumn('users', 'total_tokens', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('users', 'badge', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('creator_categories', 'reward_tokens');
    await queryInterface.removeColumn('users', 'total_tokens');
    await queryInterface.removeColumn('users', 'badge');
  },
};
