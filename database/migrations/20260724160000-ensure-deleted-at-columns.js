'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Fetch all table names in the public schema dynamically
    const [tables] = await queryInterface.sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != 'SequelizeMeta';
    `);

    // 2. Loop through every table in the database and ensure deleted_at exists
    for (const row of tables) {
      const tableName = row.table_name;
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE "${tableName}" 
          ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE NULL;
        `);
      } catch (err) {
        console.error(`Error ensuring deleted_at on table ${tableName}:`, err);
      }
    }
  },

  async down() {
    // No-op down migration
  },
};
