'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add creator_niche_ids column
    await queryInterface.addColumn('campaigns', 'creator_niche_ids', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });

    // 2. Migrate existing single creator_niche_id values to the array
    const [campaigns] = await queryInterface.sequelize.query(
      `SELECT id, creator_niche_id FROM campaigns WHERE creator_niche_id IS NOT NULL`
    );

    for (const row of campaigns) {
      await queryInterface.sequelize.query(
        `UPDATE campaigns SET creator_niche_ids = :nicheIds WHERE id = :id`,
        {
          replacements: {
            nicheIds: JSON.stringify([row.creator_niche_id]),
            id: row.id,
          },
        }
      );
    }

    // 3. Make legacy column nullable
    await queryInterface.changeColumn('campaigns', 'creator_niche_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('campaigns', 'creator_niche_ids');
  },
};
