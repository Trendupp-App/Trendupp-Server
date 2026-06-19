'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const crypto = require('crypto');
    const { Country, State } = require('country-state-city');

    // 1. Delete all existing states and nationalities to start fresh (idempotent)
    // Note: users table has setNull on delete for state_id and nationality_id, so this is safe.
    await queryInterface.bulkDelete('states', null, {});
    await queryInterface.bulkDelete('nationalities', null, {});

    const countriesData = Country.getAllCountries();
    const nationalities = [];
    const states = [];

    console.log(`Processing ${countriesData.length} countries...`);

    for (const country of countriesData) {
      const nationalityId = crypto.randomUUID();
      nationalities.push({
        id: nationalityId,
        name: country.name,
        code: country.isoCode,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const countryStates = State.getStatesOfCountry(country.isoCode);
      for (const state of countryStates) {
        states.push({
          id: crypto.randomUUID(),
          name: state.name,
          nationality_id: nationalityId,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }

    // 2. Bulk insert nationalities
    console.log(`Inserting ${nationalities.length} nationalities...`);
    await queryInterface.bulkInsert('nationalities', nationalities, {});

    // 3. Bulk insert states in chunks of 1000 to prevent parameterized limit issues
    console.log(`Inserting ${states.length} states in chunks...`);
    const chunkSize = 1000;
    for (let i = 0; i < states.length; i += chunkSize) {
      const chunk = states.slice(i, i + chunkSize);
      await queryInterface.bulkInsert('states', chunk, {});
    }

    console.log('Seeding countries and states completed successfully!');
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('states', null, {});
    await queryInterface.bulkDelete('nationalities', null, {});
  },
};
