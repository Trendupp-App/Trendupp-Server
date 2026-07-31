'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('campaigns', 'type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'paid',
    });

    await queryInterface.addColumn('campaigns', 'token_reward', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('campaigns', 'type');
    await queryInterface.removeColumn('campaigns', 'token_reward');
  },
};
