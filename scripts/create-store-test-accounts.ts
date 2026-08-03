/**
 * Create the creator + brand accounts handed to the App Store / Play Store
 * review teams on submission.
 *
 *   npm run account:store-test              # local database
 *   npm run account:store-test -- --yes     # any other database
 *
 * Configuration (all optional; passwords are generated and printed if unset):
 *   STORE_TEST_CREATOR_EMAIL     default appreview.creator@trendupp.com
 *   STORE_TEST_CREATOR_PASSWORD
 *   STORE_TEST_BRAND_EMAIL       default appreview.brand@trendupp.com
 *   STORE_TEST_BRAND_PASSWORD
 *   STORE_TEST_COUNTRY           default Nigeria
 *
 * Why these accounts are configured the way they are
 * --------------------------------------------------
 * Reviewers get one shot at the app and cannot receive our emails or SMS. So:
 *
 *  - is_email_verified is forced true (they cannot click a verification link),
 *  - twoFactorEnabled stays false (they cannot receive a code),
 *  - and every onboarding step is pre-completed, because an account sitting at
 *    40% onboarding lands the reviewer on a "finish your profile" wall instead
 *    of the app being reviewed. Guideline 2.1 rejections frequently come from
 *    exactly this.
 *
 * Onboarding completion is not a flag — it is derived in User.onboardingPercentage
 * from real columns. A creator needs username + country + state, niches, at
 * least one social handle, and full payout details; a brand needs username +
 * country + state, industries, and representative details. This script sets all
 * of them, so both accounts report 100%.
 */
import { QueryTypes, Sequelize } from 'sequelize';
import {
  confirmTarget,
  connect,
  lookupOne,
  requireRoleId,
  resolvePassword,
  setJoinRows,
  upsertUser,
} from './lib/account-seed';

interface Place {
  countryId: string;
  stateId: string;
  countryName: string;
  stateName: string;
}

async function resolvePlace(db: Sequelize, countryName: string): Promise<Place> {
  const country = await lookupOne<{ id: string; name: string }>(
    db,
    'SELECT id, name FROM nationalities WHERE lower(name) = lower(:name) LIMIT 1',
    { name: countryName },
  );
  if (!country) {
    throw new Error(
      `Country "${countryName}" not found in nationalities. ` +
        'Run `npm run seed:run` against this database, or set STORE_TEST_COUNTRY.',
    );
  }

  const state = await lookupOne<{ id: string; name: string }>(
    db,
    'SELECT id, name FROM states WHERE nationality_id = :countryId ORDER BY name LIMIT 1',
    { countryId: country.id },
  );
  if (!state) {
    throw new Error(
      `No states exist for ${country.name}; onboarding cannot be completed without one. ` +
        'Run `npm run seed:run`.',
    );
  }

  return {
    countryId: country.id,
    stateId: state.id,
    countryName: country.name,
    stateName: state.name,
  };
}

async function pickIds(db: Sequelize, table: 'niches' | 'industries', count: number) {
  const rows = await db.query<{ id: string; name: string }>(
    `SELECT id, name FROM ${table} ORDER BY name LIMIT :count`,
    { replacements: { count }, type: QueryTypes.SELECT },
  );
  if (rows.length === 0) {
    throw new Error(
      `The ${table} table is empty, so onboarding cannot be completed. Run \`npm run seed:run\`.`,
    );
  }
  return rows;
}

async function main(): Promise<void> {
  confirmTarget(process.argv.slice(2));

  const creatorEmail = (
    process.env.STORE_TEST_CREATOR_EMAIL ?? 'appreview.creator@trendupp.com'
  ).toLowerCase();
  const brandEmail = (
    process.env.STORE_TEST_BRAND_EMAIL ?? 'appreview.brand@trendupp.com'
  ).toLowerCase();

  const creatorSecret = resolvePassword('STORE_TEST_CREATOR_PASSWORD');
  const brandSecret = resolvePassword('STORE_TEST_BRAND_PASSWORD');

  const db = connect();

  try {
    await db.authenticate();

    const place = await resolvePlace(db, process.env.STORE_TEST_COUNTRY ?? 'Nigeria');
    const creatorRoleId = await requireRoleId(db, 'creator');
    const brandRoleId = await requireRoleId(db, 'brand');

    const niches = await pickIds(db, 'niches', 2);
    const industries = await pickIds(db, 'industries', 2);

    // Match the bank to the account's country. Ordering banks by name alone
    // hands a Nigerian creator a Ghanaian bank, which looks broken to a
    // reviewer and can fail payout validation downstream.
    const bank =
      (await lookupOne<{ id: string; name: string }>(
        db,
        'SELECT id, name FROM banks WHERE lower(country) = lower(:country) ORDER BY name LIMIT 1',
        { country: place.countryName },
      )) ??
      (await lookupOne<{ id: string; name: string }>(
        db,
        'SELECT id, name FROM banks ORDER BY name LIMIT 1',
      ));

    if (!bank) {
      throw new Error(
        'The banks table is empty, so creator payout onboarding cannot be completed. ' +
          'Run `npm run seed:run`.',
      );
    }

    // ---- Creator -----------------------------------------------------------
    // 25 000 followers puts the account in the "Micro Creator" tier, so the
    // reviewer sees a populated, representative profile rather than an empty
    // Nano one. Handles are marked `trenduppreview` so nobody mistakes them
    // for a real creator's accounts.
    const creator = await upsertUser(db, {
      email: creatorEmail,
      password: creatorSecret.password,
      firstName: 'App',
      lastName: 'Reviewer',
      roleId: creatorRoleId,
      columns: {
        username: 'trendupp_reviewer',
        country_id: place.countryId,
        nationality_id: place.countryId,
        state_id: place.stateId,
        city: place.stateName,
        bio: 'Demonstration creator account for app store review. Not a real creator.',
        instagram_username: 'trenduppreview',
        instagram_followers: 25000,
        assigned_tier: 'Micro Creator',
        bank_id: bank.id,
        bank_account_number: '0000000000',
        bank_account_name: 'App Reviewer',
        verification_status: 'approved',
      },
    });
    await setJoinRows(
      db,
      'user_niches',
      'niche_id',
      creator.id,
      niches.map((n) => n.id),
    );

    // ---- Brand -------------------------------------------------------------
    const brand = await upsertUser(db, {
      email: brandEmail,
      password: brandSecret.password,
      firstName: 'Review',
      lastName: 'Brand',
      roleId: brandRoleId,
      columns: {
        username: 'trendupp_review_brand',
        country_id: place.countryId,
        nationality_id: place.countryId,
        state_id: place.stateId,
        city: place.stateName,
        bio: 'Demonstration advertiser account for app store review. Not a real brand.',
        website_url: 'https://trendupp.com',
        monthly_budget: '1000',
        rep_first_name: 'Review',
        rep_last_name: 'Representative',
        rep_email: brandEmail,
        rep_phone: '+2348000000000',
      },
    });
    await setJoinRows(
      db,
      'user_industries',
      'industry_id',
      brand.id,
      industries.map((i) => i.id),
    );

    // ---- Report ------------------------------------------------------------
    console.log('');
    console.log(`Location:   ${place.countryName} / ${place.stateName}`);
    console.log(`Niches:     ${niches.map((n) => n.name).join(', ')}`);
    console.log(`Industries: ${industries.map((i) => i.name).join(', ')}`);
    console.log(`Bank:       ${bank.name}`);
    console.log('');

    for (const account of [
      { label: 'CREATOR', email: creatorEmail, secret: creatorSecret, result: creator },
      { label: 'BRAND', email: brandEmail, secret: brandSecret, result: brand },
    ]) {
      console.log(`${account.label} — ${account.result.created ? 'created' : 'updated'}`);
      console.log(`  email:    ${account.email}`);
      console.log(
        `  password: ${
          account.secret.generated ? account.secret.password : '(taken from env var)'
        }`,
      );
      console.log(`  id:       ${account.result.id}`);
      console.log('');
    }

    if (creatorSecret.generated || brandSecret.generated) {
      console.log('Generated passwords are shown ONCE — copy them into App Store Connect /');
      console.log('Play Console now. They are stored as bcrypt hashes and cannot be read back.');
      console.log('');
    }

    console.log('Verify before submitting: sign in as each account and confirm the app opens');
    console.log('on its home screen with no onboarding prompt. Both should report 100%');
    console.log('onboarding on GET /api/v1/users/:id (onboardingPercentage).');
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  console.error(`\nFailed: ${(error as Error).message}`);
  process.exit(1);
});
