'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE campaign_applications 
      ALTER COLUMN past_work_link TYPE JSONB 
      USING CASE 
        WHEN past_work_link IS NULL THEN NULL 
        ELSE json_build_array(past_work_link)::jsonb 
      END
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE campaign_applications 
      ALTER COLUMN past_work_link TYPE VARCHAR(255) 
      USING CASE 
        WHEN past_work_link IS NULL THEN NULL 
        ELSE (past_work_link->>0) 
      END
    `);
  }
};
