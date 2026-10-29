'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');

    if (!tableInfo.can_apply_to_campaigns) {
      await queryInterface.addColumn('users', 'can_apply_to_campaigns', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }

    if (!tableInfo.is_banned) {
      await queryInterface.addColumn('users', 'is_banned', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!tableInfo.banned_at) {
      await queryInterface.addColumn('users', 'banned_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!tableInfo.ban_reason) {
      await queryInterface.addColumn('users', 'ban_reason', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('users');

    if (tableInfo.can_apply_to_campaigns) {
      await queryInterface.removeColumn('users', 'can_apply_to_campaigns');
    }

    if (tableInfo.is_banned) {
      await queryInterface.removeColumn('users', 'is_banned');
    }

    if (tableInfo.banned_at) {
      await queryInterface.removeColumn('users', 'banned_at');
    }

    if (tableInfo.ban_reason) {
      await queryInterface.removeColumn('users', 'ban_reason');
    }
  },
};
