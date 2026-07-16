'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('news', {
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
      summary: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      cover_image: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'draft',
      },
      is_platform_update: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_top_news: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      industry_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'industries',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      author_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('news');
  }
};
