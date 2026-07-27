'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('news', 'title', {
      type: Sequelize.TEXT,
      allowNull: false,
    });
    await queryInterface.changeColumn('news', 'cover_image', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('news', 'title', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn('news', 'cover_image', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
