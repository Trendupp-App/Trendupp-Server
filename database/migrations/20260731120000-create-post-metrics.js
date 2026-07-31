'use strict';

/**
 * Post-campaign performance reporting.
 *
 * Two tables:
 *
 * 1. `submission_post_media` — one row per (submission, platform) pair. A
 *    submission's `live_link` JSONB can carry several platforms, and each URL
 *    must be resolved to a platform media/video id that is PROVABLY owned by
 *    the creator's connected account before any metric is trusted. That
 *    resolution state (and why it failed) lives here.
 *
 * 2. `post_metric_snapshots` — append-only captures. Platform insight APIs
 *    return cumulative point-in-time counters with no history (TikTok has no
 *    webhooks at all), so the only way to show growth over a campaign window
 *    is to keep every capture. Rows are never updated.
 *
 * Every metric column is nullable on purpose: reach does not exist on
 * TikTok/YouTube/X and saves do not exist on Facebook. NULL means "the
 * platform does not provide this", which the report renders explicitly
 * instead of showing a misleading 0.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('submission_post_media', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      submission_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'content_submissions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      campaign_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'campaigns', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      creator_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      platform: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      url: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      /** Platform-native media/video/tweet id, once resolved. */
      platform_media_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      /** e.g. IMAGE / VIDEO / CAROUSEL_ALBUM / REELS / STORY — drives which metrics are valid. */
      media_type: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      /**
       * True only when the media was found in the creator's OWN account
       * listing. Insight APIs refuse third-party media, so this doubles as
       * proof the creator really published the post they were paid for.
       */
      ownership_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      /** pending | resolved | unowned | unsupported | unauthorized | error */
      resolution_status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
      resolution_error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      /** Windows already captured, e.g. ["t24h","t7d"] — drives the scheduler. */
      captured_windows: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      last_captured_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
      deleted_at: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('submission_post_media', ['submission_id', 'platform'], {
      name: 'uniq_submission_post_media_submission_platform',
      unique: true,
      where: { deleted_at: null },
    });
    await queryInterface.addIndex('submission_post_media', ['campaign_id'], {
      name: 'idx_submission_post_media_campaign_id',
    });
    await queryInterface.addIndex('submission_post_media', ['resolution_status'], {
      name: 'idx_submission_post_media_resolution_status',
    });

    await queryInterface.createTable('post_metric_snapshots', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      media_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'submission_post_media', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      platform: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      /** t24h | t7d | t30d | manual */
      window_label: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      captured_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      // NULL = not provided by this platform / media type. Never coerce to 0.
      views: { type: Sequelize.BIGINT, allowNull: true },
      likes: { type: Sequelize.BIGINT, allowNull: true },
      comments: { type: Sequelize.BIGINT, allowNull: true },
      shares: { type: Sequelize.BIGINT, allowNull: true },
      saves: { type: Sequelize.BIGINT, allowNull: true },
      reach: { type: Sequelize.BIGINT, allowNull: true },
      /** Creator's follower count at capture time — never a per-post metric. */
      follower_count: { type: Sequelize.BIGINT, allowNull: true },
      /** Metric keys the platform cannot supply, with the reason. */
      unavailable_metrics: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      /** Raw provider payload, kept for dispute resolution. */
      raw: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
      deleted_at: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('post_metric_snapshots', ['media_id', 'captured_at'], {
      name: 'idx_post_metric_snapshots_media_captured',
    });
    await queryInterface.addIndex('post_metric_snapshots', ['media_id', 'window_label'], {
      name: 'idx_post_metric_snapshots_media_window',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('post_metric_snapshots');
    await queryInterface.dropTable('submission_post_media');
  },
};
