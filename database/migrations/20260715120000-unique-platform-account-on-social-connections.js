'use strict';

/**
 * One social account can back exactly one Trendupp profile: without this,
 * a single TikTok/Instagram/YouTube/X account (one set of credentials) could
 * be connected to unlimited Trendupp users, each inheriting its verified
 * follower count and creator tier.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX social_connections_platform_account_uq
       ON social_connections (platform, platform_user_id)
       WHERE platform_user_id IS NOT NULL AND deleted_at IS NULL`,
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS social_connections_platform_account_uq`,
    );
  },
};
