'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE fees SET name = 'Startbutton Gateway Fee (NGN)' WHERE name = 'Pandascrow Gateway Fee (NGN)';`
    );
    await queryInterface.sequelize.query(
      `UPDATE fees SET name = 'Startbutton Gateway Fee (USD)' WHERE name = 'Pandascrow Gateway Fee (USD)';`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE fees SET name = 'Pandascrow Gateway Fee (NGN)' WHERE name = 'Startbutton Gateway Fee (NGN)';`
    );
    await queryInterface.sequelize.query(
      `UPDATE fees SET name = 'Pandascrow Gateway Fee (USD)' WHERE name = 'Startbutton Gateway Fee (USD)';`
    );
  },
};
