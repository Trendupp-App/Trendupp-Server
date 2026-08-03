/**
 * Create (or repair) the default super-admin account.
 *
 *   npm run account:superadmin              # local database
 *   npm run account:superadmin -- --yes     # any other database
 *
 * Configuration, all optional except the password in a real environment:
 *   SUPERADMIN_EMAIL      default admin@trendupp.com
 *   SUPERADMIN_PASSWORD   generated and printed once if unset
 *   SUPERADMIN_FIRST_NAME default Trendupp
 *   SUPERADMIN_LAST_NAME  default Administrator
 *
 * Safe to re-run: it updates the existing row by email, which is also how you
 * rotate the password or revive an account that was deactivated or flagged.
 */
import { Sequelize } from 'sequelize';
import {
  confirmTarget,
  connect,
  lookupOne,
  requireRoleId,
  resolvePassword,
  upsertUser,
} from './lib/account-seed';

async function main(): Promise<void> {
  confirmTarget(process.argv.slice(2));

  const email = (process.env.SUPERADMIN_EMAIL ?? 'admin@trendupp.com').toLowerCase();
  const firstName = process.env.SUPERADMIN_FIRST_NAME ?? 'Trendupp';
  const lastName = process.env.SUPERADMIN_LAST_NAME ?? 'Administrator';
  const { password, generated } = resolvePassword('SUPERADMIN_PASSWORD');

  const db: Sequelize = connect();

  try {
    await db.authenticate();

    const roleId = await requireRoleId(db, 'super_admin');

    // Guard against a second super-admin appearing by surprise: if one already
    // exists under a different address, say so rather than quietly adding
    // another account with full privileges.
    const otherSuperAdmin = await lookupOne<{ email: string }>(
      db,
      `SELECT email FROM users
        WHERE role_id = :roleId AND lower(email) <> :email AND deleted_at IS NULL
        LIMIT 1`,
      { roleId, email },
    );
    if (otherSuperAdmin) {
      console.log(`Note: another super-admin already exists (${otherSuperAdmin.email}).`);
    }

    const result = await upsertUser(db, {
      email,
      password,
      firstName,
      lastName,
      roleId,
      columns: {
        username: process.env.SUPERADMIN_USERNAME ?? 'trendupp-admin',
      },
    });

    console.log('');
    console.log(`Super-admin ${result.created ? 'created' : 'updated'}`);
    console.log(`  id:       ${result.id}`);
    console.log(`  email:    ${email}`);
    console.log(`  role:     super_admin`);

    if (generated) {
      console.log(`  password: ${password}`);
      console.log('');
      console.log('This password was generated and is shown ONCE. Store it in your password');
      console.log('manager now — it is a bcrypt hash in the database and cannot be read back.');
      console.log('Set SUPERADMIN_PASSWORD to choose your own instead.');
    } else {
      console.log('  password: (taken from SUPERADMIN_PASSWORD)');
    }
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  console.error(`\nFailed: ${(error as Error).message}`);
  process.exit(1);
});
