'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const crypto = require('crypto');

    // Pandascrow platform fee rates per currency/processor
    // NGN → Pandascrow routes via Paystack (3%)
    // USD → Pandascrow routes via Stripe (5%)
    const fees = [
      { name: 'Startbutton Gateway Fee (NGN)', type: 'percentage', value: 0.03 },
      { name: 'Startbutton Gateway Fee (USD)', type: 'percentage', value: 0.05 },
    ].map((fee) => ({
      id: crypto.randomUUID(),
      name: fee.name,
      type: fee.type,
      value: fee.value,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    // ignoreDuplicates so this is safe to re-run
    await queryInterface.bulkInsert('fees', fees, { ignoreDuplicates: true });
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      'fees',
      {
        name: ['Startbutton Gateway Fee (NGN)', 'Startbutton Gateway Fee (USD)'],
      },
      {},
    );
  },
};
