'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('campaigns', 'campaign_brief', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('campaigns', 'accepted_terms', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('campaigns', 'accepted_terms');
    await queryInterface.removeColumn('campaigns', 'campaign_brief');
  },
};
