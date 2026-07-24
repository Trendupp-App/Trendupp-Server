'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('banner_ads', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      ad_type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Banner',
      },
      target_audience: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: ['All Creators'],
      },
      placement: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: ['Home Page'],
      },
      ad_image_url: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      link_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'draft',
      },
      impressions: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      clicks: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('banner_ads', ['status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('banner_ads');
  },
};
