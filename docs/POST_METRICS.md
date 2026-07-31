# Post-Campaign Performance Metrics

Collects per-post performance for live posts creators submit against a campaign,
so advertisers can be sent a report after the fact.

## What is actually obtainable

Every metric below is verified against the platforms' own documentation. A `—`
is a permanent platform limitation, not a pending feature.

| Metric | Instagram | TikTok | YouTube | Facebook | X |
| --- | --- | --- | --- | --- | --- |
| Likes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Views | ✅ `views` | ✅ `view_count` | ✅ | ✅ | ⚠️ `impression_count` |
| Comments | ✅ | ✅ | ✅ | ✅ | ✅ `reply_count` |
| Shares | ✅ | ✅ | ✅ (Analytics API) | ✅ | ✅ retweets + quotes |
| Saves | ✅ `saved` | ⚠️ `collect_count` | ⚠️ playlist adds | — | ⚠️ `bookmark_count` |
| Reach (unique) | ✅ `reach` | — | — | ✅ `post_impressions_unique` | — |
| Follower count | ✅ | ✅ | ✅ | ✅ | ✅ (account-level only) |

⚠️ = a proxy, not a like-for-like figure. `PLATFORM_METRIC_SUPPORT` and
`SAVES_IS_APPROXIMATE` in [`post-metrics.constants.ts`](../src/domains/post-metrics/post-metrics.constants.ts)
are the single source of truth; `GET /post-metrics/capabilities` serves them to clients.

**There is no single cross-platform "Total Reach".** Reach exists only on
Instagram and Facebook. The report therefore lists any metric that not every
platform in the set can supply under `notComparableAcrossPlatforms` and omits it
from `totals`, instead of quietly summing an under-count.

## How it works

1. **Register** — the collector polls `content_submissions` for live links with
   no `submission_post_media` row and creates one row per platform. It pulls
   rather than having `campaigns.service` push, which avoids a circular module
   dependency and backfills links submitted before this feature shipped.
2. **Resolve** — each URL is located inside the creator's *own* account listing
   (`/me/media`, `video/list`, `channels?mine=true`, `/me/accounts`, `users/me`).
   No platform's insights API will serve third-party media, so a successful
   match is also proof the creator published the post they were paid for.
   Outcomes: `resolved`, `unowned`, `unauthorized`, `unsupported`, `error`.
3. **Capture** — a snapshot at T+24h, T+7d and T+30d from publish. Snapshots are
   append-only: platform APIs return cumulative point-in-time counters with no
   history (TikTok has no webhooks at all), so growth is derived by diffing rows.
4. **Report** — the advertiser-facing endpoints join the latest snapshot per post
   with the capability matrix, so every field is either a real reading or
   explicitly unavailable with a reason. Nothing is defaulted to `0`.

Driven by a BullMQ repeatable job (`post-metrics` queue, 15-minute tick), not
`@Cron` — `@Cron` fires on every PM2 instance under `instances: 'max'`, whereas
identical repeat specs dedupe in Redis and each tick is consumed by one worker.

## Platform quirks encoded in the implementation

- **Instagram carousels always report 0 views.** Treated as unavailable rather
  than reported as a false zero (`INSTAGRAM_VIEWLESS_MEDIA_TYPES`).
- **Instagram Stories expire in 24h** and take their insights with them, so they
  get a single capture at ~T+20h instead of the standard schedule
  (`STORY_CAPTURE_OFFSET_MS`).
- **Instagram paths must be versioned.** `graph.instagram.com/me` without a
  version returns the misleading `IGApiException` code 100 "Unsupported request".
- **YouTube Analytics is day-bucketed with 2-3 days of settling latency**, so the
  T+24h capture uses only the real-time `videos.list` counters; shares and
  playlist adds join from T+7d (`YOUTUBE_ANALYTICS_MIN_WINDOW`).
- **Facebook post insights need a Page token**, not the stored user token — the
  provider exchanges via `/me/accounts` on every call.
- **Short links are rejected, not guessed.** `vm.tiktok.com`, `vt.tiktok.com`,
  Instagram `/share/` codes and Facebook `pfbid` permalinks carry no usable id;
  resolving them would mean following an untrusted redirect. They resolve to
  `unsupported` so the creator is asked for a direct permalink — deliberately
  *not* `unowned`, which would read as an accusation.

## Endpoints

Advertiser / creator (`JwtAuthGuard`, access limited to the campaign's brand, the
posting creator, or staff):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/post-metrics/capabilities` | The capability matrix + required OAuth scopes |
| GET | `/post-metrics/submissions/:submissionId` | Latest metrics per platform for one submission |
| GET | `/post-metrics/campaigns/:campaignId` | Campaign-wide roll-up with totals |
| GET | `/post-metrics/media/:mediaId/history` | Every capture, oldest first (growth curves) |

Staff (`/admin` namespace, staff roles only, audit-logged):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/post-metrics/unresolved` | Triage queue for unresolved live posts |
| POST | `/admin/post-metrics/:mediaId/resolve` | Retry ownership resolution |
| POST | `/admin/post-metrics/:mediaId/capture` | Capture a `manual` snapshot now |

## NOT DONE — required before this returns real data

The collection pipeline is complete, but **no platform will return insights until
the creator has granted the insights scopes**, which are not yet requested at
connect time. Each of these is a client change that triggers a new App Review,
and every already-connected creator must re-consent:

| Platform | Scope to add | Where |
| --- | --- | --- |
| Instagram | `instagram_business_manage_insights` | `Trendupp-Web/lib/socialConnect.ts` |
| TikTok | `video.list` | same (also needs production approval — currently sandbox) |
| YouTube | `.../auth/yt-analytics.readonly` | same (re-opens Google verification) |
| Facebook | `read_insights` | same |

Until then every capture will record `unauthorized` and the report will correctly
say the creator needs to reconnect.

Also unresolved: Meta's own docs state only that *some* metrics are unavailable
below **100 followers**, while third-party integration docs claim engagement
insights need **1,000+**. If the higher figure is right, smaller creators produce
empty reports. Confirm with a real API call against a low-follower test account
before promising advertisers coverage.
