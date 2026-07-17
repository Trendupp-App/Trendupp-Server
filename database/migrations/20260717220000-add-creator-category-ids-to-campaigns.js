'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add creator_category_ids column
    await queryInterface.addColumn('campaigns', 'creator_category_ids', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });

    // 2. Migrate existing single creator_category_id values into the new array
    const [campaigns] = await queryInterface.sequelize.query(
      `SELECT id, creator_category_id FROM campaigns WHERE creator_category_id IS NOT NULL`
    );

    for (const row of campaigns) {
      await queryInterface.sequelize.query(
        `UPDATE campaigns SET creator_category_ids = :categoryIds WHERE id = :id`,
        {
          replacements: {
            categoryIds: JSON.stringify([row.creator_category_id]),
            id: row.id,
          },
        }
      );
    }

    // 3. Keep the legacy FK column but make it nullable (it was already nullable via allowNull: true)
    await queryInterface.changeColumn('campaigns', 'creator_category_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('campaigns', 'creator_category_ids');
  },
};
