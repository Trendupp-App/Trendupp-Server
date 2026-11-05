require('dotenv').config();

// Shared connection settings. `seederStorage: 'sequelize'` makes the CLI record
// which seeders have run (in the SequelizeData table) and skip already-applied
// ones — so `db:seed:all` becomes idempotent and safe to run on every deploy.
const base = {
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  // Track applied seeders so re-runs are no-ops (prevents duplicate reference data).
  seederStorage: 'sequelize',
  seederStorageTableName: 'SequelizeData',
};

module.exports = {
  development: { ...base },
  production: { ...base },
};
