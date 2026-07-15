'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('campaigns', 'timeline', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('campaigns', 'creator_niche_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'niches',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('campaigns', 'timeline');
    await queryInterface.removeColumn('campaigns', 'creator_niche_id');
  },
};
