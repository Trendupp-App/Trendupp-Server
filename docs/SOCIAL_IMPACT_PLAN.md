# Social Impact — End-to-End Build Plan

**What it is:** token-rewarded, non-paid campaigns. Admins create them on
behalf of a brand; creators participate and earn tokens (not cash); tokens
accumulate toward Impact Badge tiers and expire after 12 months.

**Where it stands (July 2026 audit):** ~70% of the surface exists, ~0%
functions. The `type`/`tokenReward` fields were never migrated into the
database (they're VIRTUAL), so every server endpoint fails or returns empty;
"award tokens" awards nothing (no ledger exists); the entire admin UI is mock
with `alert()` success messages **and is live in the sidebar today**; web has
an orphaned card; mobile is built but dark except a leaking Explore chip.

## Product decisions (defaults applied — override any)

| Question | Default for this build |
|---|---|
| What is a token worth? | Non-monetary recognition points at launch: they drive Impact Badge tiers and profile standing. NOT redeemable for cash. The ledger is designed so redemption/perks can be added later without remodeling. |
| Badge tiers | As promised in the existing mobile UI: Impact Advocate 10 / Impact Leader 100 / Impact Champion 1,000+ (active, unexpired tokens). |
| Expiry | 12 months after each credit (as the mobile UI already states), enforced by a scheduled job; expiring-soon notice at 11 months. |
| Who funds it | Commercial arrangement outside the codebase (brand CSR/awareness deals). The system only needs `brandId` + `tokenReward`. |
| Participant approval | Admin approves (as built) — brands are passive on these campaigns. |
| Eligibility | Campaign's creator tiers gate applications; one participation per creator per campaign; applications only while `live` and inside the application window. |

---

## Phase 0 — Stop the bleeding (same day, ship immediately)

1. **Admin:** gate the Social Impact sidebar item + `/admin/campaigns/social*`
   routes behind `NEXT_PUBLIC_FEATURE_SOCIAL_IMPACT` (default off). Today an
   admin can "publish" a campaign and get a fake success alert.
2. **Mobile:** hide the Explore "Social Impact" filter chip behind the same
   kind of flag/remote-config (it currently returns a permanently empty list).
   The Impact Badge profile entry should also hide until Phase 6.

## Phase 1 — Data foundation (server, ~1 day)

1. Migration: `campaigns.type` (`'paid'` default, NOT NULL, indexed),
   `campaigns.token_reward` (int, nullable), `campaigns.token_batch_id`
   (FK → token_batches, nullable), `campaigns.creator_tiers` (JSONB) — and
   convert the VIRTUAL columns in `campaign.entity.ts` to real `@Column`s.
2. Migration: **`token_ledger`** — `id`, `user_id` (FK), `campaign_id` (FK),
   `application_id` (FK, **unique** — the idempotency key: one credit per
   approved participation), `amount` (int, positive=credit), `reason`
   (`participation_reward` | `expiry` | `adjustment`), `expires_at`,
   `expired_at` (null until swept), timestamps. Indexes on `user_id`,
   `expires_at`.
3. `TokenLedgerRepository`: `creditParticipation()` (idempotent),
   `balanceFor(userId)` (sum of unexpired credits minus expiries),
   `historyFor(userId)` (paginated), `expireDue(now)`.
4. Badge helper: `computeImpactBadge(balance)` → tier name + next-tier
   progress (constants mirror the mobile copy).

## Phase 2 — Server correctness & token economy (~2 days)

1. `approveParticipant` becomes transactional: statuses + ledger credit of
   the campaign's `tokenReward` in one transaction; success message only when
   the credit lands. Summary's `tokensDistributed` computed from the ledger.
2. **Expiry job:** BullMQ repeatable (daily, cluster-safe like the broadcast
   scheduler): mark due credits expired; enqueue `tokens.expiring_soon`
   notifications at T-30 days.
3. Fix the audited defects: stable persisted `displayId` scheme (one scheme
   everywhere, searchable); participants tab filter BEFORE pagination with a
   correct `meta.total`; order the submissions include `createdAt DESC`; add
   the missing `complete` transition + a `resume` action; guard illegal state
   transitions; rename social-impact "active" handling so it can't collide
   with paid-campaign semantics; persist `creatorTiers`/`tokenBatchId`
   (currently discarded); drop the duplicate audit write on create.
4. Replace every hardcoded response field (niche, tiers, platforms, rating,
   followers, engagement, `daysLeft: 4`, prose) with real columns/joins.
5. RBAC: publish/cancel/delete restricted to `owner`/`super_admin` (+
   `moderator` for participant review); `support_agent` read-only.
6. Notification catalog entries (existing categories, no new taxonomy):
   `social_impact.published` (→ matching creators, category `opportunities`),
   `social_impact.participant_approved` / `_rejected` (→ creator,
   `applications`), `tokens.awarded` and `tokens.expiring_soon` (→ creator,
   `account`).
7. Tests: ledger idempotency, approve-credits-once, expiry sweep, state
   guards, participants pagination.

## Phase 3 — Consumer API (server, ~1 day)

1. Fix the `status=social_impact` conflation: the public campaigns list gets
   a real `type` filter (`campaign.repository.ts`), keeping `status` for
   lifecycle. (Mobile already sends the old param — accept `status=social_impact`
   as an alias for `type` during transition.)
2. `GET /campaigns/social-impact/:id` detail (or type-aware existing detail)
   exposing `tokenReward` and participation state for the caller.
3. `POST /campaigns/:id/participate` (creator): eligibility checks (type,
   `live` status, window open, tier match, no prior application) → creates
   the `CampaignApplication`; submission flow reuses the existing draft/live
   endpoints.
4. Token endpoints for profile surfaces: `GET /tokens/me` (balance, badge
   tier, next-tier progress, expiring-soon total) and `GET /tokens/history`.

## Phase 4 — Admin app wiring (~2 days, parallel with 3)

1. `services/adminSocialImpactApi.ts` + `hooks/useAdminSocialImpact.ts` for
   all 13 endpoints.
2. `SocialStats` ← summary API. `SocialGrid` ← paginated list (tabs → `?tab=`,
   search, real Continue/Delete). Delete both `MOCK_SOCIAL_CAMPAIGNS` copies.
3. Create wizard: **add the token-batch/token-reward selector** (the defining
   field, currently absent), advertisers from the brands API, drop dummy
   prefill, wire Save-as-draft/Publish to the real endpoints with error
   states.
4. Detail page: `isSocial` from the API `type` field; participants tab wired
   to list/approve/reject; hide the escrow row for social campaigns; Admin
   Action tab wired to pause/resume/cancel/extend/close/complete.
5. Remove the Phase 0 feature flag when this ships with the server phases.

## Phase 5 — Consumer web (~1 day)

1. Creator dashboard: stop hardcoding `isSocialImpact: false`; map from the
   API `type`.
2. Social Impact section/route listing `type='social_impact'` campaigns using
   the (currently orphaned) `SocialCampaignCard`; give Participate a real
   handler → participate endpoint → same submission flow UI as paid
   campaigns minus payment copy.
3. Profile: token balance + badge tier chip via `GET /tokens/me`.

## Phase 6 — Mobile (~1.5 days)

1. Un-comment the home-feed section; switch the provider to the real type
   filter; render the real `tokenReward` (kill the "— Tokens" placeholder).
2. Participate button → participate endpoint + participation state on the
   campaign detail.
3. Impact Badge screen: replace all dummy data with `GET /tokens/me` +
   `GET /tokens/history` (balance, tier, progress, expiry list); delete the
   TODO disclaimer.
4. Re-enable the Explore chip.

## Phase 7 — Launch pass (~half day)

- Seed real token batches (confirm the 5 presets), create one pilot campaign
  end-to-end in staging: publish → notification to matching creators →
  participate on mobile → submit → admin approve → tokens land → badge
  updates → expiry job dry-run.
- Analytics events if wanted; update docs/NOTIFICATIONS.md with the new
  types; announce via broadcast.

## Sequencing & effort

```
Phase 0 (same day) ─┐
Phase 1 ─ Phase 2 ─ Phase 3 ──┐
                └─ Phase 4 ───┼─ Phase 7
              Phase 5 ────────┤   (Phases 4/5/6 parallel after 2–3)
              Phase 6 ────────┘
```

| Phase | Effort |
|---|---|
| 0 — safety gates | hours |
| 1 — data foundation | ~1 day |
| 2 — server economy + fixes | ~2 days |
| 3 — consumer API | ~1 day |
| 4 — admin wiring | ~2 days |
| 5 — web | ~1 day |
| 6 — mobile | ~1.5 days |
| 7 — launch pass | ~0.5 day |

**Total ≈ 9 engineer-days serial, ~5–6 calendar days with the client phases
parallelized.**
