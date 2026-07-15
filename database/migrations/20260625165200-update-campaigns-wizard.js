'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add new columns
    await queryInterface.addColumn('campaigns', 'deliverables', {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    await queryInterface.addColumn('campaigns', 'content_direction', {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    await queryInterface.addColumn('campaigns', 'usage_rights', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('campaigns', 'success_looks_like', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('campaigns', 'current_step', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.addColumn('campaigns', 'payment_status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'unpaid',
    });

    // 2. Drop campaign_rules
    await queryInterface.removeColumn('campaigns', 'campaign_rules');

    // 3. Drop and recreate content_guidelines as JSONB
    await queryInterface.removeColumn('campaigns', 'content_guidelines');
    await queryInterface.addColumn('campaigns', 'content_guidelines', {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    // 4. Drop columns no longer required by the new campaign wizard design
    await queryInterface.removeColumn('campaigns', 'payment_per_creator');
    await queryInterface.removeColumn('campaigns', 'content_type');
    await queryInterface.removeColumn('campaigns', 'duration');
    await queryInterface.removeColumn('campaigns', 'content_duration');

    // 5. Alter creator_category_id to allow null (for saving partial drafts)
    await queryInterface.changeColumn('campaigns', 'creator_category_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    // 6. Change default status to 'draft'
    await queryInterface.changeColumn('campaigns', 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'draft',
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert status default
    await queryInterface.changeColumn('campaigns', 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'pending_approval',
    });

    // Revert creator_category_id back to non-nullable
    await queryInterface.changeColumn('campaigns', 'creator_category_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });

    // Recreate dropped columns as nullable to ensure easy rollback
    await queryInterface.addColumn('campaigns', 'payment_per_creator', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('campaigns', 'content_type', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('campaigns', 'duration', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn('campaigns', 'content_duration', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Revert content_guidelines to TEXT
    await queryInterface.removeColumn('campaigns', 'content_guidelines');
    await queryInterface.addColumn('campaigns', 'content_guidelines', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Restore campaign_rules
    await queryInterface.addColumn('campaigns', 'campaign_rules', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Remove added columns
    await queryInterface.removeColumn('campaigns', 'payment_status');
    await queryInterface.removeColumn('campaigns', 'current_step');
    await queryInterface.removeColumn('campaigns', 'success_looks_like');
    await queryInterface.removeColumn('campaigns', 'usage_rights');
    await queryInterface.removeColumn('campaigns', 'content_direction');
    await queryInterface.removeColumn('campaigns', 'deliverables');
  },
};
