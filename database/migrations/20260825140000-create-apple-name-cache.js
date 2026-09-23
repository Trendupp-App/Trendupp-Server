'use strict';

/**
 * Server-side backup for Sign in with Apple names.
 *
 * Apple delivers the user's name exactly ONCE — on the first authorization
 * per Apple ID. When that first attempt hits the sign-IN endpoint of a user
 * with no account yet, the API rejects with "please signup first" and the
 * name would be lost forever. The mobile app caches it on-device, but that
 * cannot survive a reinstall, a second device, or a web→mobile switch — so
 * the backend also stashes the name here on any Apple auth attempt that
 * carries one, and consumes (then deletes) it when the account is created.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('apple_name_cache', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      /** Apple's stable per-app user id (the token's `sub`). */
      apple_user_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      first_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      last_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
      deleted_at: { type: Sequelize.DATE },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('apple_name_cache');
  },
};
