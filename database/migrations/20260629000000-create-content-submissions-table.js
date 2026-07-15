'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add url_is_live to campaigns
    await queryInterface.addColumn('campaigns', 'url_is_live', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
    });

    // 2. Create content_submissions table
    await queryInterface.createTable('content_submissions', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      campaign_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'campaigns',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      application_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'campaign_applications',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      creator_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      draft_link: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      live_link: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending_approval',
      },
      brand_feedback: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      url_is_live: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: null,
      },
      url_checked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      deleted_at: {
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex('content_submissions', ['application_id'], {
      name: 'idx_content_submissions_application_id',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('content_submissions');
    await queryInterface.removeColumn('campaigns', 'url_is_live');
  },
};
