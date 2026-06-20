'use strict';

module.exports = {
  up: async (queryInterface) => {
    const crypto = require('crypto');
    const categories = [
      { name: 'Payments', description: 'Payouts, earnings, bank details, and billing' },
      { name: 'Technical Support', description: 'Bugs, platform errors, app crashes, and visual issues' },
      { name: 'Account Access', description: 'Password resets, deactivation, two-factor auth, and registration' },
      { name: 'Feedback', description: 'Feature requests and general suggestions' },
      { name: 'Other', description: 'General support queries not matching other categories' },
    ].map((cat) => ({
      id: crypto.randomUUID(),
      name: cat.name,
      description: cat.description,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await queryInterface.bulkInsert('issue_categories', categories, {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('issue_categories', null, {});
  },
};
