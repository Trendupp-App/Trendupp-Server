'use strict';

/**
 * Adds a 'rejected' value to the disputes.status enum so an admin can decline
 * a raised dispute (the "Decline Request" action) without activating it.
 *
 * PostgreSQL cannot ADD VALUE inside a transaction reliably across versions,
 * so we use the same convert-to-TEXT / drop / recreate strategy as the
 * escrow_action enum migration. The column is NOT NULL with a default of
 * 'raised', so we drop/re-apply the default around the type swap.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.sequelize.query(
        `ALTER TABLE disputes ALTER COLUMN status DROP DEFAULT`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE disputes ALTER COLUMN status TYPE TEXT USING status::TEXT`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS "enum_disputes_status"`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_disputes_status" AS ENUM ('raised', 'under_review', 'resolved', 'rejected')`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE disputes
           ALTER COLUMN status TYPE "enum_disputes_status"
           USING status::"enum_disputes_status"`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE disputes ALTER COLUMN status SET DEFAULT 'raised'`,
        { transaction: t },
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.sequelize.query(
        `ALTER TABLE disputes ALTER COLUMN status DROP DEFAULT`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE disputes ALTER COLUMN status TYPE TEXT USING status::TEXT`,
        { transaction: t },
      );

      // Any 'rejected' rows fall back to 'raised' so they fit the old enum.
      await queryInterface.sequelize.query(
        `UPDATE disputes SET status = 'raised' WHERE status = 'rejected'`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS "enum_disputes_status"`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_disputes_status" AS ENUM ('raised', 'under_review', 'resolved')`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE disputes
           ALTER COLUMN status TYPE "enum_disputes_status"
           USING status::"enum_disputes_status"`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE disputes ALTER COLUMN status SET DEFAULT 'raised'`,
        { transaction: t },
      );
    });
  },
};
