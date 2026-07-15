'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('campaign_applications', {
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
      content_idea: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      past_work_link: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      primary_platform_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'platforms',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      secondary_platform_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'platforms',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fee_request: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      comments: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending',
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

    await queryInterface.addIndex('campaign_applications', ['campaign_id', 'creator_id'], {
      unique: true,
      name: 'unique_campaign_creator_application',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('campaign_applications');
  },
};
