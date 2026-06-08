'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'role');
    await queryInterface.addColumn('users', 'role_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'roles',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'role_id');
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.STRING,
      defaultValue: 'creator',
      allowNull: false,
    });
  }
};
