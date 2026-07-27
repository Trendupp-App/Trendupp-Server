'use strict';

/**
 * PostgreSQL does not support DROP VALUE on an ENUM directly.
 * Strategy: convert the column to TEXT, drop the old enum type,
 * create the new enum type with the correct values, then cast the
 * column back to the new type.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (t) => {
      // 1. Convert existing column to plain TEXT so we can drop the old type
      await queryInterface.sequelize.query(
        `ALTER TABLE disputes ALTER COLUMN escrow_action TYPE TEXT USING escrow_action::TEXT`,
        { transaction: t },
      );

      // 2. Drop the old enum type (Sequelize names it "enum_disputes_escrow_action")
      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS "enum_disputes_escrow_action"`,
        { transaction: t },
      );

      // 3. Create the new enum type with all required values
      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_disputes_escrow_action" AS ENUM (
          'release_to_creator',
          'refund_to_brand',
          'split',
          'allow_content_submission',
          'allow_content_review',
          'allow_revised_submission',
          'allow_revised_review'
        )`,
        { transaction: t },
      );

      // 4. Cast the column back to the new enum (any old 'extend_days' rows become NULL)
      await queryInterface.sequelize.query(
        `ALTER TABLE disputes
           ALTER COLUMN escrow_action TYPE "enum_disputes_escrow_action"
           USING CASE
             WHEN escrow_action IN (
               'release_to_creator','refund_to_brand','split',
               'allow_content_submission','allow_content_review',
               'allow_revised_submission','allow_revised_review'
             ) THEN escrow_action::"enum_disputes_escrow_action"
             ELSE NULL
           END`,
        { transaction: t },
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (t) => {
      // Reverse: restore original enum (release_to_creator, refund_to_brand, split, extend_days)
      await queryInterface.sequelize.query(
        `ALTER TABLE disputes ALTER COLUMN escrow_action TYPE TEXT USING escrow_action::TEXT`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `DROP TYPE IF EXISTS "enum_disputes_escrow_action"`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `CREATE TYPE "enum_disputes_escrow_action" AS ENUM (
          'release_to_creator',
          'refund_to_brand',
          'split',
          'extend_days'
        )`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE disputes
           ALTER COLUMN escrow_action TYPE "enum_disputes_escrow_action"
           USING CASE
             WHEN escrow_action IN ('release_to_creator','refund_to_brand','split')
               THEN escrow_action::"enum_disputes_escrow_action"
             ELSE NULL
           END`,
        { transaction: t },
      );
    });
  },
};
