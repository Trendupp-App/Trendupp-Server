'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add security_settings JSONB column
    await queryInterface.addColumn('users', 'security_settings', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {
        twoFactorEnabled: false,
        biometricLoginEnabled: true,
        loginAlertsEnabled: true,
      },
    });

    // Add deactivated_at column
    await queryInterface.addColumn('users', 'deactivated_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'security_settings');
    await queryInterface.removeColumn('users', 'deactivated_at');
  }
};
