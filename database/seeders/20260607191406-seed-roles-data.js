'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const crypto = require('crypto');

    const roles = [
      { name: 'creator', display_name: 'Creator' },
      { name: 'brand', display_name: 'Brand' },
      { name: 'finance_admin', display_name: 'Finance Admin' },
      { name: 'admin', display_name: 'Admin' },
      { name: 'super_admin', display_name: 'Super Admin' },
    ].map((r) => ({
      id: crypto.randomUUID(),
      name: r.name,
      display_name: r.display_name,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await queryInterface.bulkInsert('roles', roles, {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('roles', null, {});
  }
};
