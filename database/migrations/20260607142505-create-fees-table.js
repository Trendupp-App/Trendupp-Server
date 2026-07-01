'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('fees', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'percentage',
      },
      value: {
        type: Sequelize.FLOAT,
        allowNull: false,
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

    const now = new Date();
    await queryInterface.bulkInsert('fees', [
      {
        id: 'a00d1390-63d3-4a5e-8f07-b10f837fb501',
        name: 'VAT',
        type: 'percentage',
        value: 0.075,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'a00d1390-63d3-4a5e-8f07-b10f837fb502',
        name: 'Trendupp Fee',
        type: 'percentage',
        value: 0.15,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('fees');
  },
};
