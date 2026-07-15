'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'avg_rating', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addColumn('users', 'total_reviews', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'avg_rating');
    await queryInterface.removeColumn('users', 'total_reviews');
  },
};
