'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Normalise all existing email addresses to lowercase + trimmed whitespace.
    // This is a one-time data fix to ensure email lookups work correctly
    // regardless of how users originally typed their email during signup.
    await queryInterface.sequelize.query(
      `UPDATE users SET email = LOWER(TRIM(email)) WHERE email != LOWER(TRIM(email))`,
    );
  },

  async down() {
    // This migration is intentionally irreversible.
    // Email addresses cannot be restored to their original mixed-case form
    // as that information is no longer relevant or stored.
  },
};
