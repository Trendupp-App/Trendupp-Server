'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const crypto = require('crypto');

    // 1. Delete all existing banks to start fresh (idempotency)
    // Note: users table has setNull on delete for bank_id, so this is safe.
    await queryInterface.bulkDelete('banks', null, {});

    const banksData = [
      // Nigeria (Africa)
      { name: 'Access Bank', code: '044', country: 'Nigeria', region: 'Africa' },
      { name: 'Citibank Nigeria', code: '023', country: 'Nigeria', region: 'Africa' },
      { name: 'Ecobank Nigeria', code: '050', country: 'Nigeria', region: 'Africa' },
      { name: 'Fidelity Bank', code: '070', country: 'Nigeria', region: 'Africa' },
      { name: 'First Bank of Nigeria', code: '011', country: 'Nigeria', region: 'Africa' },
      { name: 'First City Monument Bank (FCMB)', code: '214', country: 'Nigeria', region: 'Africa' },
      { name: 'Globus Bank', code: '00103', country: 'Nigeria', region: 'Africa' },
      { name: 'Guaranty Trust Bank (GTBank)', code: '058', country: 'Nigeria', region: 'Africa' },
      { name: 'Heritage Bank', code: '030', country: 'Nigeria', region: 'Africa' },
      { name: 'Jaiz Bank', code: '301', country: 'Nigeria', region: 'Africa' },
      { name: 'Keystone Bank', code: '082', country: 'Nigeria', region: 'Africa' },
      { name: 'Kuda Bank', code: '090267', country: 'Nigeria', region: 'Africa' },
      { name: 'Moniepoint MFB', code: '50515', country: 'Nigeria', region: 'Africa' },
      { name: 'OPay', code: '999992', country: 'Nigeria', region: 'Africa' },
      { name: 'PalmPay', code: '999991', country: 'Nigeria', region: 'Africa' },
      { name: 'Polaris Bank', code: '076', country: 'Nigeria', region: 'Africa' },
      { name: 'Providus Bank', code: '101', country: 'Nigeria', region: 'Africa' },
      { name: 'Stanbic IBTC Bank', code: '039', country: 'Nigeria', region: 'Africa' },
      { name: 'Standard Chartered Bank', code: '068', country: 'Nigeria', region: 'Africa' },
      { name: 'Sterling Bank', code: '232', country: 'Nigeria', region: 'Africa' },
      { name: 'SunTrust Bank', code: '100', country: 'Nigeria', region: 'Africa' },
      { name: 'Taj Bank', code: '302', country: 'Nigeria', region: 'Africa' },
      { name: 'Union Bank of Nigeria', code: '032', country: 'Nigeria', region: 'Africa' },
      { name: 'United Bank for Africa (UBA)', code: '033', country: 'Nigeria', region: 'Africa' },
      { name: 'Unity Bank', code: '215', country: 'Nigeria', region: 'Africa' },
      { name: 'Wema Bank', code: '035', country: 'Nigeria', region: 'Africa' },
      { name: 'Zenith Bank', code: '057', country: 'Nigeria', region: 'Africa' },

      // Kenya (Africa)
      { name: 'KCB Bank Kenya', code: 'KCB', country: 'Kenya', region: 'Africa' },
      { name: 'Equity Bank Kenya', code: 'EQTY', country: 'Kenya', region: 'Africa' },
      { name: 'Co-operative Bank of Kenya', code: 'COOP', country: 'Kenya', region: 'Africa' },
      { name: 'NCBA Bank Kenya', code: 'NCBA', country: 'Kenya', region: 'Africa' },
      { name: 'Absa Bank Kenya', code: 'ABSA_KE', country: 'Kenya', region: 'Africa' },

      // Ghana (Africa)
      { name: 'GCB Bank', code: 'GCB', country: 'Ghana', region: 'Africa' },
      { name: 'Ecobank Ghana', code: 'ECO_GH', country: 'Ghana', region: 'Africa' },
      { name: 'Absa Bank Ghana', code: 'ABSA_GH', country: 'Ghana', region: 'Africa' },
      { name: 'Standard Chartered Ghana', code: 'SCB_GH', country: 'Ghana', region: 'Africa' },

      // South Africa (Africa)
      { name: 'Standard Bank of South Africa', code: 'SBSA', country: 'South Africa', region: 'Africa' },
      { name: 'First National Bank (FNB)', code: 'FNB', country: 'South Africa', region: 'Africa' },
      { name: 'Absa Bank South Africa', code: 'ABSA_ZA', country: 'South Africa', region: 'Africa' },
      { name: 'Nedbank', code: 'NED', country: 'South Africa', region: 'Africa' },
      { name: 'Capitec Bank', code: 'CPI', country: 'South Africa', region: 'Africa' },

      // Egypt (Africa)
      { name: 'National Bank of Egypt', code: 'NBE', country: 'Egypt', region: 'Africa' },
      { name: 'Banque Misr', code: 'MISR', country: 'Egypt', region: 'Africa' },
      { name: 'Commercial International Bank (CIB)', code: 'CIB', country: 'Egypt', region: 'Africa' },
      { name: 'QNB Alahli', code: 'QNBA', country: 'Egypt', region: 'Africa' },

      // United States (North America)
      { name: 'JPMorgan Chase & Co.', code: 'JPM', country: 'United States', region: 'North America' },
      { name: 'Bank of America', code: 'BAC', country: 'United States', region: 'North America' },
      { name: 'Citigroup Inc.', code: 'C', country: 'United States', region: 'North America' },
      { name: 'Wells Fargo', code: 'WFC', country: 'United States', region: 'North America' },
      { name: 'Goldman Sachs', code: 'GS', country: 'United States', region: 'North America' },
      { name: 'Morgan Stanley', code: 'MS', country: 'United States', region: 'North America' },

      // United Kingdom (Europe)
      { name: 'Barclays', code: 'BARC', country: 'United Kingdom', region: 'Europe' },
      { name: 'HSBC Holdings', code: 'HSBA', country: 'United Kingdom', region: 'Europe' },
      { name: 'Lloyds Banking Group', code: 'LLOY', country: 'United Kingdom', region: 'Europe' },
      { name: 'NatWest Group', code: 'NWG', country: 'United Kingdom', region: 'Europe' },
      { name: 'Standard Chartered PLC', code: 'STAN', country: 'United Kingdom', region: 'Europe' },

      // Canada (North America)
      { name: 'Royal Bank of Canada', code: 'RY', country: 'Canada', region: 'North America' },
      { name: 'Toronto-Dominion Bank', code: 'TD', country: 'Canada', region: 'North America' },
      { name: 'Bank of Nova Scotia (Scotiabank)', code: 'BNS', country: 'Canada', region: 'North America' },
      { name: 'Bank of Montreal (BMO)', code: 'BMO', country: 'Canada', region: 'North America' },

      // Australia (Oceania)
      { name: 'Commonwealth Bank of Australia', code: 'CBA', country: 'Australia', region: 'Oceania' },
      { name: 'Westpac Banking Corporation', code: 'WBC', country: 'Australia', region: 'Oceania' },
      { name: 'Australia & New Zealand Banking Group (ANZ)', code: 'ANZ', country: 'Australia', region: 'Oceania' },
      { name: 'National Australia Bank', code: 'NAB', country: 'Australia', region: 'Oceania' },
    ];

    const seededBanks = banksData.map((bank) => ({
      id: crypto.randomUUID(),
      name: bank.name,
      code: bank.code,
      country: bank.country,
      region: bank.region,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await queryInterface.bulkInsert('banks', seededBanks, {});
    console.log(`Seeded ${seededBanks.length} banks successfully!`);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('banks', null, {});
  },
};
