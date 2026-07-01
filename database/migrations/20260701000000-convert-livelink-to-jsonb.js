'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Convert live_link column from VARCHAR/STRING to JSONB
    await queryInterface.sequelize.query(
      `ALTER TABLE content_submissions ALTER COLUMN live_link TYPE JSONB USING CASE WHEN live_link IS NULL THEN NULL ELSE json_build_object('link', live_link) END`
    );
  },

  async down(queryInterface, Sequelize) {
    // Revert live_link column from JSONB back to VARCHAR/STRING (takes the value of the 'link' property if it's an object)
    await queryInterface.sequelize.query(
      `ALTER TABLE content_submissions ALTER COLUMN live_link TYPE VARCHAR(255) USING CASE WHEN live_link IS NULL THEN NULL WHEN jsonb_typeof(live_link) = 'object' AND live_link ? 'link' THEN live_link->>'link' ELSE live_link::text END`
    );
  }
};
