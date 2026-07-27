'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'facebook_open_id', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });
    await queryInterface.addColumn('users', 'apple_user_id', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });
    await queryInterface.addColumn('users', 'facebook_username', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'facebook_followers', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'facebook_open_id');
    await queryInterface.removeColumn('users', 'apple_user_id');
    await queryInterface.removeColumn('users', 'facebook_username');
    await queryInterface.removeColumn('users', 'facebook_followers');
  },
};
