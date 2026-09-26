'use strict';

/**
 * Widen `social_connections.avatar_url` from VARCHAR(255) to TEXT.
 *
 * Platform avatar URLs are signed CDN links, not plain paths. TikTok's in
 * particular carry the signature inline and routinely exceed 255 characters:
 *
 *   https://p16-sign-sg.tiktokcdn.com/aweme/1080x1080/tos-alisg-avt-.../x.jpeg
 *     ?lk3s=…&x-expires=…&x-signature=…&idc=…&ps=…&shcp=…&shp=…&t=…
 *
 * Writing one raised `value too long for type character varying(255)`. That is
 * a DatabaseError rather than a UniqueConstraintError, so SocialsService.connect
 * rethrew it and the endpoint answered 500 — after the OAuth exchange had
 * already succeeded. Instagram, Facebook and YouTube return similarly long
 * signed URLs, so this is not TikTok-specific.
 *
 * access_token / refresh_token were already TEXT; only this column was capped.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('social_connections', 'avatar_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Truncates any value already longer than 255 characters. Down-migrating
    // is only safe if no long avatar URL has been stored since `up` ran.
    await queryInterface.changeColumn('social_connections', 'avatar_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
