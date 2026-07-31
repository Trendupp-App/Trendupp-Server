import { Test, TestingModule } from '@nestjs/testing';
import { PostMetricsService } from './post-metrics.service';
import { PostMetricsRepository } from '../repository/post-metrics.repository';
import { SocialConnectionRepository } from '../../socials/repository/social-connection.repository';
import { PostInsightsRegistry } from '../../../integration/social-apis/insights/post-insights.registry';
import { SocialPlatform } from '../../socials/constants/social-platforms';
import { SubmissionPostMedia } from '../entities/submission-post-media.entity';
import { PostMetricSnapshot } from '../entities/post-metric-snapshot.entity';
import { CAPTURE_WINDOWS, STORY_CAPTURE_OFFSET_MS } from '../post-metrics.constants';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function media(overrides: Partial<SubmissionPostMedia> = {}): SubmissionPostMedia {
  return {
    id: 'media-1',
    submissionId: 'sub-1',
    campaignId: 'camp-1',
    creatorId: 'creator-1',
    platform: SocialPlatform.INSTAGRAM,
    url: 'https://www.instagram.com/reel/Cx1y2z3AbCd/',
    platformMediaId: '178414',
    mediaType: 'REELS',
    publishedAt: new Date('2026-07-01T00:00:00Z'),
    ownershipVerified: true,
    resolutionStatus: 'resolved',
    capturedWindows: [],
    ...overrides,
  } as SubmissionPostMedia;
}

function snapshot(overrides: Partial<PostMetricSnapshot> = {}): PostMetricSnapshot {
  return {
    id: 'snap-1',
    mediaId: 'media-1',
    platform: SocialPlatform.INSTAGRAM,
    windowLabel: 't7d',
    capturedAt: new Date('2026-07-08T00:00:00Z'),
    views: 1000,
    likes: 100,
    comments: 10,
    shares: 5,
    saves: 20,
    reach: 800,
    followerCount: 50_000,
    unavailableMetrics: [],
    ...overrides,
  } as PostMetricSnapshot;
}

describe('PostMetricsService', () => {
  let service: PostMetricsService;
  let repository: jest.Mocked<
    Pick<
      PostMetricsRepository,
      'findMediaBySubmission' | 'findLatestSnapshotsForMedia' | 'findMediaByCampaign'
    >
  >;

  beforeEach(async () => {
    repository = {
      findMediaBySubmission: jest.fn(),
      findLatestSnapshotsForMedia: jest.fn(),
      findMediaByCampaign: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PostMetricsService,
        { provide: PostMetricsRepository, useValue: repository },
        { provide: SocialConnectionRepository, useValue: {} },
        { provide: PostInsightsRegistry, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PostMetricsService);
  });

  describe('dueWindows', () => {
    it('returns nothing before the first window elapses', () => {
      const now = new Date('2026-07-01T12:00:00Z'); // 12h after publish
      expect(service.dueWindows(media(), now)).toEqual([]);
    });

    it('returns every elapsed window that has not been captured', () => {
      const now = new Date('2026-07-09T00:00:00Z'); // 8 days after publish
      expect(service.dueWindows(media(), now)).toEqual(['t24h', 't7d']);
    });

    it('never re-captures a window already recorded', () => {
      const now = new Date('2026-07-09T00:00:00Z');
      expect(service.dueWindows(media({ capturedWindows: ['t24h'] }), now)).toEqual(['t7d']);
    });

    it('captures a Story before the 24h expiry, not at t24h', () => {
      // Stories take their insights with them when they vanish, so the
      // standard t24h window would always miss them.
      const storyMedia = media({ mediaType: 'STORY' });
      const tooEarly = new Date(storyMedia.publishedAt!.getTime() + 2 * HOUR);
      const inWindow = new Date(storyMedia.publishedAt!.getTime() + STORY_CAPTURE_OFFSET_MS + HOUR);

      expect(service.dueWindows(storyMedia, tooEarly)).toEqual([]);
      expect(service.dueWindows(storyMedia, inWindow)).toEqual(['story']);
      expect(
        service.dueWindows(media({ mediaType: 'STORY', capturedWindows: ['story'] }), inWindow),
      ).toEqual([]);
    });

    it('returns nothing when the publish date is unknown', () => {
      expect(service.dueWindows(media({ publishedAt: null }), new Date())).toEqual([]);
    });

    it('covers all three configured windows once fully elapsed', () => {
      const longest = Math.max(...CAPTURE_WINDOWS.map((w) => w.offsetMs));
      const now = new Date(media().publishedAt!.getTime() + longest + DAY);
      expect(service.dueWindows(media(), now)).toEqual(['t24h', 't7d', 't30d']);
    });
  });

  describe('getSubmissionMetrics', () => {
    it('reports a platform-missing metric as unavailable, never as 0', async () => {
      // TikTok has no unique-reach metric on any API surface.
      repository.findMediaBySubmission.mockResolvedValue([
        media({ id: 'm-tt', platform: SocialPlatform.TIKTOK, mediaType: 'VIDEO' }),
      ]);
      repository.findLatestSnapshotsForMedia.mockResolvedValue(
        new Map([
          ['m-tt', snapshot({ mediaId: 'm-tt', platform: SocialPlatform.TIKTOK, reach: null })],
        ]),
      );

      const result = await service.getSubmissionMetrics('sub-1');
      const reach = result.platforms[0].metrics.reach;

      expect(reach.value).toBeNull();
      expect(reach.available).toBe(false);
      expect(reach.reason).toMatch(/does not provide/i);
    });

    it('flags TikTok saves as an approximation', async () => {
      repository.findMediaBySubmission.mockResolvedValue([
        media({ id: 'm-tt', platform: SocialPlatform.TIKTOK }),
      ]);
      repository.findLatestSnapshotsForMedia.mockResolvedValue(
        new Map([
          ['m-tt', snapshot({ mediaId: 'm-tt', platform: SocialPlatform.TIKTOK, saves: 42 })],
        ]),
      );

      const saves = (await service.getSubmissionMetrics('sub-1')).platforms[0].metrics.saves;
      expect(saves.value).toBe(42);
      expect(saves.approximate).toBe(true);
    });

    it('refuses to total a metric one platform cannot supply', async () => {
      // Summing reach across Instagram and TikTok would under-report by
      // however much TikTok contributed.
      repository.findMediaBySubmission.mockResolvedValue([
        media({ id: 'm-ig', platform: SocialPlatform.INSTAGRAM }),
        media({ id: 'm-tt', platform: SocialPlatform.TIKTOK }),
      ]);
      repository.findLatestSnapshotsForMedia.mockResolvedValue(
        new Map([
          ['m-ig', snapshot({ mediaId: 'm-ig', reach: 800 })],
          [
            'm-tt',
            snapshot({
              mediaId: 'm-tt',
              platform: SocialPlatform.TIKTOK,
              reach: null,
              views: 2000,
              likes: 300,
              comments: 30,
              shares: 15,
            }),
          ],
        ]),
      );

      const result = await service.getSubmissionMetrics('sub-1');

      expect(result.notComparableAcrossPlatforms).toContain('reach');
      expect(result.totals.reach).toBeUndefined();
      // Views are supported by both, so they do total.
      expect(result.totals.views).toBe(3000);
    });

    it('marks saves not-comparable when only one platform approximates it', async () => {
      repository.findMediaBySubmission.mockResolvedValue([
        media({ id: 'm-ig', platform: SocialPlatform.INSTAGRAM }),
        media({ id: 'm-tt', platform: SocialPlatform.TIKTOK }),
      ]);
      repository.findLatestSnapshotsForMedia.mockResolvedValue(
        new Map([
          ['m-ig', snapshot({ mediaId: 'm-ig' })],
          ['m-tt', snapshot({ mediaId: 'm-tt', platform: SocialPlatform.TIKTOK })],
        ]),
      );

      const result = await service.getSubmissionMetrics('sub-1');
      expect(result.notComparableAcrossPlatforms).toContain('saves');
    });

    it('never totals followerCount, which is per-creator not per-post', async () => {
      repository.findMediaBySubmission.mockResolvedValue([
        media({ id: 'm-ig', platform: SocialPlatform.INSTAGRAM }),
        media({ id: 'm-yt', platform: SocialPlatform.YOUTUBE }),
      ]);
      repository.findLatestSnapshotsForMedia.mockResolvedValue(
        new Map([
          ['m-ig', snapshot({ mediaId: 'm-ig', followerCount: 50_000 })],
          [
            'm-yt',
            snapshot({
              mediaId: 'm-yt',
              platform: SocialPlatform.YOUTUBE,
              followerCount: 50_000,
              reach: null,
            }),
          ],
        ]),
      );

      const result = await service.getSubmissionMetrics('sub-1');
      expect(result.totals.followerCount).toBeUndefined();
    });

    it('excludes unverified posts from totals but still reports their status', async () => {
      repository.findMediaBySubmission.mockResolvedValue([
        media({ id: 'm-ig' }),
        media({
          id: 'm-bad',
          ownershipVerified: false,
          resolutionStatus: 'unowned',
          resolutionError: "Not found in the creator's Instagram account",
        }),
      ]);
      repository.findLatestSnapshotsForMedia.mockResolvedValue(
        new Map([['m-ig', snapshot({ mediaId: 'm-ig', views: 1000 })]]),
      );

      const result = await service.getSubmissionMetrics('sub-1');

      expect(result.totals.views).toBe(1000);
      const unverified = result.platforms.find((p) => p.resolutionStatus === 'unowned');
      expect(unverified?.ownershipVerified).toBe(false);
      expect(unverified?.resolutionError).toMatch(/not found/i);
    });

    it('reports "not captured yet" before the first snapshot lands', async () => {
      repository.findMediaBySubmission.mockResolvedValue([media()]);
      repository.findLatestSnapshotsForMedia.mockResolvedValue(new Map());

      const result = await service.getSubmissionMetrics('sub-1');
      const views = result.platforms[0].metrics.views;

      expect(views.value).toBeNull();
      expect(views.available).toBe(false);
      expect(views.reason).toMatch(/not captured yet/i);
    });

    it('honours a per-capture unavailable flag from the provider', async () => {
      // e.g. views on an Instagram carousel, which always reports 0.
      repository.findMediaBySubmission.mockResolvedValue([media({ mediaType: 'CAROUSEL_ALBUM' })]);
      repository.findLatestSnapshotsForMedia.mockResolvedValue(
        new Map([
          [
            'media-1',
            snapshot({
              views: null,
              unavailableMetrics: [
                {
                  metric: 'views',
                  reason: 'not_supported_for_media_type',
                  detail: 'Videos inside an Instagram carousel always report 0 views',
                },
              ],
            }),
          ],
        ]),
      );

      const views = (await service.getSubmissionMetrics('sub-1')).platforms[0].metrics.views;
      expect(views.available).toBe(false);
      expect(views.reason).toMatch(/carousel/i);
    });

    it('throws when no live post has been registered yet', async () => {
      repository.findMediaBySubmission.mockResolvedValue([]);
      await expect(service.getSubmissionMetrics('sub-1')).rejects.toThrow(
        /no live posts have been registered/i,
      );
    });
  });
});
