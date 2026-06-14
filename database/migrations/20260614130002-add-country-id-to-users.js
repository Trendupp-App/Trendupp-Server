'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add country_id as a separate column from nationality_id.
    // Both reference the same nationalities table — nationality_id represents
    // the user's citizenship/passport, while country_id represents the country
    // they currently live/operate in (which drives the states lookup).
    await queryInterface.addColumn('users', 'country_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'nationalities',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'country_id');
  },
};
