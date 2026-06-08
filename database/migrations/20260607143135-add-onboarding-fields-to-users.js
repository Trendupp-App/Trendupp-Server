'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'role', {
      type: Sequelize.STRING,
      defaultValue: 'creator',
      allowNull: false,
    });
    await queryInterface.addColumn('users', 'password', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'is_email_verified', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });
    await queryInterface.addColumn('users', 'username', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'nationality_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'nationalities',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('users', 'state_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'states',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('users', 'bio', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'instagram_username', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'instagram_followers', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
    });
    await queryInterface.addColumn('users', 'tiktok_username', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'tiktok_followers', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
    });
    await queryInterface.addColumn('users', 'youtube_username', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'youtube_followers', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
    });
    await queryInterface.addColumn('users', 'twitter_username', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'twitter_followers', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
    });
    await queryInterface.addColumn('users', 'verification_video_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'verification_status', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'assigned_tier', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'assigned_tier');
    await queryInterface.removeColumn('users', 'verification_status');
    await queryInterface.removeColumn('users', 'verification_video_url');
    await queryInterface.removeColumn('users', 'twitter_followers');
    await queryInterface.removeColumn('users', 'twitter_username');
    await queryInterface.removeColumn('users', 'youtube_followers');
    await queryInterface.removeColumn('users', 'youtube_username');
    await queryInterface.removeColumn('users', 'tiktok_followers');
    await queryInterface.removeColumn('users', 'tiktok_username');
    await queryInterface.removeColumn('users', 'instagram_followers');
    await queryInterface.removeColumn('users', 'instagram_username');
    await queryInterface.removeColumn('users', 'bio');
    await queryInterface.removeColumn('users', 'state_id');
    await queryInterface.removeColumn('users', 'nationality_id');
    await queryInterface.removeColumn('users', 'username');
    await queryInterface.removeColumn('users', 'is_email_verified');
    await queryInterface.removeColumn('users', 'password');
    await queryInterface.removeColumn('users', 'role');
  }
};
