'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add escrow columns to payments table
    await queryInterface.addColumn('payments', 'escrow_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('payments', 'payment_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('payments', 'transaction_ref', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('payments', 'provider', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('payments', 'escrow_status', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // 2. Create payment_releases table
    await queryInterface.createTable('payment_releases', {
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
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      release_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
      error_details: {
        type: Sequelize.TEXT,
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
        allowNull: true,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    // 1. Drop payment_releases table
    await queryInterface.dropTable('payment_releases');

    // 2. Remove escrow columns from payments table
    await queryInterface.removeColumn('payments', 'escrow_id');
    await queryInterface.removeColumn('payments', 'payment_url');
    await queryInterface.removeColumn('payments', 'transaction_ref');
    await queryInterface.removeColumn('payments', 'provider');
    await queryInterface.removeColumn('payments', 'escrow_status');
  },
};
