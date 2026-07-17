# Trendupp Notification System — Implementation Plan

**Scope:** In-app + email notifications for Trendupp-Server (NestJS + Sequelize/Postgres + BullMQ + AWS SES + EJS), designed to be reusable and trivially integrable into existing flows, extensible to push (FCM) for the mobile app later.

**Method:** Full backend exploration (all 9 domains + 6 integrations), three independent architecture designs (DX-first, reliability-first, product-first) synthesized into one recommendation, plus a completeness audit of the touchpoint inventory.

> **Status (July 2026): Phases 1–2 are BUILT and merged.** The `notifications` module,
> migration, queue worker, REST API, and 22 wired notification types (applications,
> submissions, payouts, refunds, disputes) are live on the `notifications-system` branch.
> §1 below is a **historical snapshot** of the codebase before the build.
> See [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md) for what exists now;
> this document remains the reference for design rationale and Phases 3–5.

---

## 1. Current state (what exists today)

| What | Where | Notes |
|---|---|---|
| Email sending | `src/integration/email/email.service.ts` | AWS SES + EJS. Only 3 hardcoded methods (OTP, 2 deletion warnings), each ~50 lines of copy-pasted render/send/mock-fallback logic. Sent synchronously in the request path. No retry — SES failures are swallowed into console logs. |
| Templates | `src/integration/email/templates/` | `otp.ejs`, `account-deletion-warning.ejs`, `account-deletion-tomorrow.ejs`. **`dist/` only ships `otp.ejs`** — nest-cli assets config must be fixed or new templates 404 in production. |
| User preferences | `users.notification_settings` JSONB (`user.entity.ts:203-227`) | Keys: `newCampaigns, applicationUpdates, paymentAlerts, brandMessages, pushNotifications, emailNotifications, weeklySummary, marketingOffers`. CRUD already live at `GET/PATCH /api/v1/profile/notifications`. **Nothing consumes these settings today.** |
| BullMQ | `app.module.ts:66-75` | Redis connection wired at root. **Zero queues/processors registered anywhere** — the notification queue will be the first real consumer. |
| Cron jobs | `account-lifecycle.scheduler.ts`, `payout.scheduler.ts` | `@Cron` fires on **every PM2 instance** (`ecosystem.config.js` uses `instances: 'max'`) — no dedup guard. Deletion warnings re-send daily for ~29 days (no sent-flag). |
| Stream Chat | `src/integration/stream/stream.service.ts` | Dispute channels only (create/freeze). No system messages, no sendMessage method. Not a notification rail. |
| In-app notifications | — | **None.** No table, no module, no push. |
| Explicit TODO | `payout.scheduler.ts:37` | "I should send email after getting clarity from stakeholders" — payout notifications are wanted but unbuilt. ✅ **Resolved:** the TODO is removed and the scheduler now fires `payout.released`, `payout.failed`, `payout.escrow_pending`, `campaign.completed`, and the three `refund.*` notifications. |

Synthetic emails: TikTok/Instagram signups get `tiktok_<id>@trendupp.tiktok` / `instagram_<id>@trendupp.instagram` addresses (`auth.service.ts:421,513`) — **undeliverable**. For these users in-app must be the primary channel and email sends must be skipped.

---

## 2. Recommended architecture

### 2.1 Module

New domain module mirroring the existing domain shape exactly:

```
src/domains/notifications/
  notifications.module.ts                       # registerQueue('notifications'), forFeature([Notification])
  notification.catalog.ts                       # THE typed catalog — source of truth per type
  notification.types.ts                         # NotificationType union + per-type payload interfaces
  controllers/notifications.controller.ts       # client-facing REST (feed, unread-count, read)
  services/notifications.service.ts             # notify() — the ONE method domain services call
  services/notification-dispatch.processor.ts   # @Processor('notifications') BullMQ worker
  repository/notification.repository.ts
  entities/notification.entity.ts
  dtos/list-notifications.dto.ts, ...
```

### 2.2 Event flow

```
Domain service ──one line──▶ NotificationsService.notify(...)   [never throws]
                                    │  validates type against catalog,
                                    │  queue.add(jobId = dedupeKey, attempts:3, exp backoff 5s)
                                    ▼
                      BullMQ 'notifications' queue (Redis, root connection)
                                    │  exactly-one worker consumes per job,
                                    │  cluster-safe under PM2 instances:'max'
                                    ▼
                     NotificationDispatchProcessor
                       1. resolve recipients (ids | role fan-out | niche fan-out)
                       2. gate per-recipient via user.notificationSettings
                       3. INSERT in-app Notification row(s)  (skip → recorded, not silent)
                       4. render EJS + EmailService.send() → email_status = sent/mocked/failed/skipped
```

**Key decisions (and why):**

1. **Direct DI, no EventEmitter layer.** Zero event-emitter code exists in this codebase; direct service calls are the established cross-domain pattern. `notify()` is already the decoupling seam. One fewer indirection to learn.
2. **`notify()` never throws.** Wrapped in try/catch + `logger.error` internally — a Redis outage can never break an escrow webhook or a payout run. Matches the existing per-item try/catch convention in `payout.scheduler.ts`.
3. **Queued, never inline.** Emails leave the request path entirely. BullMQ gives retries (3 attempts, exponential backoff) that today's swallow-into-mock EmailService lacks. BullMQ workers take distributed locks, so running a worker on every PM2 instance is safe — this is the cluster-safety fix `@Cron` never had.
4. **`dedupeKey` → idempotency.** `jobId = dedupeKey` at the queue level plus a unique partial index on `notifications.dedupe_key` at the DB level. **Mandatory for every cron- or webhook-origin call site** (crons fire on N instances; Pandascrow can redeliver webhooks). E.g. `payout.released:<releaseId>`, `campaign.live:<campaignId>`.
5. **Typed catalog = reusability.** Adding a new notification type is: (a) one payload interface, (b) one catalog entry, (c) one `notify()` line at the hook. No new class, no new queue, no new email method, usually no new template (`generic-notification.ejs` covers it). Wrong payload shape = compile error.
6. **Module wiring:** each producing module (`CampaignsModule`, `DisputesModule`, `ProfileModule`, `AuthModule`, `UsersModule`, `AdminModule`) adds `NotificationsModule` to `imports` — the only change to their module files. To avoid a cycle with `UsersModule`, `NotificationsModule` injects `@InjectModel(User)` directly (existing precedent: `account-lifecycle.scheduler.ts:23`). If import-array churn becomes annoying, flipping to `@Global()` is a one-line change — start explicit, matching the codebase convention.
7. **Don't repurpose Stream Chat** as the notification transport (scoped to dispute channels, no message API used, couples the feed to a paid third party). Don't start with WebSockets (PM2 cluster + no sticky sessions). Poll first, SSE later, FCM push for mobile later — the schema already carries the deep-link payload push will need.

### 2.3 The catalog (source of truth)

```ts
// notification.catalog.ts
export const NOTIFICATION_CATALOG = {
  'payout.released': {
    category: 'paymentAlerts',          // key into user.notificationSettings, or 'security' (non-suppressible)
    channels: ['inApp', 'email'],
    priority: 'critical',
    title: (d) => `Payment sent: ₦${d.amount.toLocaleString()}`,
    body:  (d) => `Your payout for "${d.campaignTitle}" has been sent to your bank account.`,
    deepLink: (d) => ({ route: '/creator/earnings', entityType: 'payment_release', entityId: d.releaseId }),
    emailSubject: (d) => `You've been paid ₦${d.amount.toLocaleString()} — Trendupp`,
    emailTemplate: 'generic-notification',   // default; set a bespoke .ejs name when a type deserves one
  },
  // ... one entry per type
} satisfies Record<NotificationType, CatalogEntry>;
```

```ts
// notification.types.ts — typed end-to-end
export interface NotificationPayloads {
  'payout.released': { amount: number; campaignId: string; campaignTitle: string; releaseId: string };
  'application.accepted': { campaignId: string; campaignTitle: string; applicationId: string };
  // ...
}
export type NotificationType = keyof NotificationPayloads;
```

### 2.4 Producer API

```ts
// services/notifications.service.ts — the entire public surface
notify<T extends NotificationType>(input: {
  type: T;
  recipientId?: string | string[];                          // explicit user id(s)
  recipientRole?: 'admin' | 'finance_admin' | 'super_admin'; // OR role fan-out
  actorId?: string;                                          // who triggered it (audit-actor convention)
  data: NotificationPayloads[T];
  dedupeKey?: string;                                        // REQUIRED from crons/webhooks
}): Promise<void>   // NEVER throws
```

Real call sites (one line each, after the existing state mutation):

```ts
// campaigns.service.ts:576 — reviewCampaignApplication, after application.update({status})
await this.notificationsService.notify({
  type: dto.status === 'accepted' ? 'application.accepted' : 'application.rejected',
  recipientId: application.creatorId,
  actorId: user.id,
  data: { campaignId: campaign.id, campaignTitle: campaign.title, applicationId: application.id },
  dedupeKey: `application.${dto.status}:${application.id}`,
});
```

```ts
// payout.scheduler.ts:92 — success branch (resolves the TODO at line 37)
await this.notificationsService.notify({
  type: 'payout.released',
  recipientId: release.creatorId,
  data: { amount: Number(release.amount), campaignId: release.campaignId,
          campaignTitle: campaign.title, releaseId: release.id },
  dedupeKey: `payout.released:${release.id}`,   // cron fires on every PM2 instance — sent once
});
```

```ts
// disputes.service.ts:155 — resolveDispute, after freezeChannel
await this.notificationsService.notify({
  type: 'dispute.resolved',
  recipientId: [dispute.creatorId, dispute.brandId],
  actorId: admin.id,
  data: { disputeId: dispute.id, escrowAction: dto.escrowAction, resolutionNotes: dto.resolutionNotes },
  dedupeKey: `dispute.resolved:${dispute.id}`,
});
await this.notificationsService.notify({
  type: 'dispute.escrow_action_required',
  recipientRole: 'finance_admin',
  data: { disputeId: dispute.id, escrowAction: dto.escrowAction },
  dedupeKey: `dispute.escrow_action:${dispute.id}`,
});
```

```ts
// webhooks.controller.ts:124 — handleEscrowPaid (webhooks can be redelivered)
await this.notificationsService.notify({
  type: 'campaign.payment_confirmed',
  recipientId: campaign.brandId,
  data: { campaignId: campaign.id, campaignTitle: campaign.title, amount: payment.amount },
  dedupeKey: `campaign.live:${campaign.id}`,
});
```

---

## 3. Data model

One new entity extending `BaseEntity` (UUID v4 PK, `created_at/updated_at/deleted_at`):

```ts
@Table({ tableName: 'notifications' })
export class Notification extends BaseEntity<Notification> {
  @ForeignKey(() => User) @Column({ field: 'user_id', type: DataType.UUID, allowNull: false })
  declare userId: string;                    // recipient
  @BelongsTo(() => User, 'user_id') declare user: User;

  @ForeignKey(() => User) @Column({ field: 'actor_id', type: DataType.UUID, allowNull: true })
  declare actorId: string | null;            // who triggered it (mirrors disputes audit-actor)
  @BelongsTo(() => User, 'actor_id') declare actor: User;

  @Column({ type: DataType.STRING, allowNull: false }) declare type: string;      // 'payout.released'
  @Column({ type: DataType.STRING, allowNull: false }) declare category: string;  // preference key or 'security'
  @Column({ type: DataType.STRING, allowNull: false }) declare priority: string;  // critical|high|medium|low
  @Column({ type: DataType.STRING, allowNull: false }) declare title: string;     // pre-rendered
  @Column({ type: DataType.TEXT, allowNull: false }) declare body: string;

  @Column({ type: DataType.JSONB, defaultValue: {} })
  declare data: object;   // deep-link payload: { route, entityType, entityId, params } — web/mobile/push contract

  @Column({ field: 'read_at', allowNull: true }) declare readAt: Date | null;
  @Column({ field: 'seen_at', allowNull: true }) declare seenAt: Date | null;   // badge cleared vs item opened

  @Column({ field: 'email_status', type: DataType.STRING, defaultValue: 'skipped' })
  declare emailStatus: string;   // skipped|queued|sent|mocked|failed — the email audit trail
  @Column({ field: 'email_error', type: DataType.TEXT, allowNull: true })
  declare emailError: string | null;   // mirrors PaymentRelease.errorDetails

  @Column({ field: 'dedupe_key', type: DataType.STRING, allowNull: true })
  declare dedupeKey: string | null;
}
```

Migration `database/migrations/<ts>-create-notifications-table.js` (sequelize-cli CommonJS per convention):

- FKs: `user_id` → users CASCADE; `actor_id` → users SET NULL.
- Indexes:
  - `(user_id, created_at)` — feed pagination
  - partial `(user_id) WHERE read_at IS NULL AND deleted_at IS NULL` — O(1)-ish unread badge count
  - unique partial `(dedupe_key) WHERE dedupe_key IS NOT NULL` — DB-level idempotency against cluster double-fires
  - `(type)`

**No changes to `users.notification_settings`** — consumed as-is.

Retention: BullMQ repeatable purge job (`jobId: 'notifications-purge'`, cluster-safe by construction) hard-deletes (`force: true`) read notifications older than 90 days.

> Deferred: a separate `notification_deliveries` table (per-channel outbox rows + reconciler cron) is the reliability upgrade if/when push lands or delivery SLAs need auditing. The `email_status` column covers today's two channels with one table.

---

## 4. Email strategy

1. **Generalize, don't replace, `EmailService`.** Add one primitive:
   `send(to, subject, template, data, opts?: { throwOnFailure?: boolean }): Promise<'sent'|'mocked'|'failed'>`
   — single copy of the render→SES→mock-fallback logic. The 3 legacy methods become 3-line delegates (zero behavior change for auth). From the queue worker, pass `throwOnFailure: true` so SES errors propagate and BullMQ retries — the current swallow-to-mock behavior remains only for MOCK mode (no creds) and legacy direct calls.
2. **Templates:** `templates/layouts/base.ejs` (brand header/footer + "manage preferences" link) + `generic-notification.ejs` (title/body/CTA from the catalog — covers most types with **no new file**). Bespoke `.ejs` per type only when design demands it (e.g. payout receipt). **Fix `nest-cli.json` assets glob so `templates/**/*.ejs` copies to `dist/`** (today only `otp.ejs` ships) and add a boot-time template-existence check.
3. **Guards in the processor:** skip email (recorded as `email_status='skipped'`) for synthetic `@trendupp.tiktok|instagram` recipients (hard skip, not retry — protects SES reputation); re-check `emailNotifications` master toggle at send time.
4. **OTP stays synchronous and outside the system** (latency-sensitive, security-critical, already works). Later phase can route it through the queue at priority 1 for retries. While touching `EmailService`: **stop logging OTP codes** in the mock-fallback path.
5. **DI cleanup:** `AuthModule` drops `EmailService` from `providers` and imports `EmailModule` (acknowledged wart in `email.module.ts:6-7`).

---

## 5. Preferences

Reuse `users.notification_settings` exactly as shipped — no schema change, no new endpoints (CRUD already at `GET/PATCH /api/v1/profile/notifications`).

- **Category toggles** (per catalog entry): `applicationUpdates` → application.*/submission.*; `paymentAlerts` → payout.*/payment.*; `newCampaigns` → campaign.live.matching_creators fan-out; `brandMessages` → chat messages (future); `weeklySummary` → digest inclusion (default false = opt-in); `marketingOffers` → marketing (AND `user.acceptedPromotions`).
- **Channel masters:** `emailNotifications` gates all suppressible email; `pushNotifications` reserved for FCM. **In-app has no master kill switch by design** — the tray is the system of record; for critical/high priority the in-app row is written even when the category is off (user opted out of noise, not of history).
- **`category: 'security'` is non-suppressible** (bypasses all toggles): password changed, payout/bank details updated, email changed, account deactivation/deletion warnings, dispute lifecycle, Google-account-linked alert. Prevents a user preference-blocking "your bank account was changed."
- **Admin/finance fan-outs are not preference-gated** — they're operational work items.
- `securitySettings.loginAlertsEnabled` (`user.entity.ts:229-243`, currently read by nothing) gates `auth.login_alert` when it ships.
- Enforcement lives in **one pure function** `resolveChannels(user, catalogEntry)` in the processor — unit-testable, impossible for call sites to bypass or forget. Every skip is recorded, so support can answer "why didn't I get an email?"

---

## 6. Client delivery (web + mobile)

REST under `/api/v1/notifications` (`@UseGuards(JwtAuthGuard)`, `@CurrentUser()`, Swagger-decorated, standard `paginate()` response shape):

| Endpoint | Purpose |
|---|---|
| `GET /notifications?page&limit&unreadOnly&category` | Feed. Items carry `{ id, type, category, priority, title, body, data:{route,entityType,entityId}, actor:{id,firstName,avatarUrl}, readAt, createdAt }` — `data.route + entityId` is the deep-link contract both routers (and future push) consume. |
| `GET /notifications/unread-count` | `{ count }` off the partial index. The cheap poll target (30–60s + refetch-on-foreground). Add a generous `THROTTLE_LIMITS.NOTIFICATION_POLL`. |
| `PATCH /notifications/seen` | Badge → 0 when tray opens (sets `seen_at` on all unseen; items stay visually unread). |
| `PATCH /notifications/:id/read` | Read receipt (404 if not owned). |
| `PATCH /notifications/read-all` | Bulk `SET read_at=now() WHERE user_id=:id AND read_at IS NULL`. |

**Realtime: polling first, deliberately.** PM2 cluster (`instances:'max'`, no sticky sessions) means correct SSE/WS needs a Redis pub/sub relay — zero precedent in this codebase. Upgrade path (schema needs no changes):
- **SSE** `GET /notifications/stream` (`@Sse()`), processor publishes to Redis `notif:user:{id}`, each instance subscribes and forwards to its connected clients. Works through existing guards/prefix; heartbeat every ~25s.
- **FCM push** for mobile: `src/integration/push/` adapter + `device_tokens` table + a third channel branch in the processor gated on `pushNotifications`. No catalog or call-site changes.

---

## 7. Where notifications are needed — full touchpoint inventory

Verified against code (file:line = the service method to hook). *(planned)* = feature stubbed/not yet built.

### 7.1 Campaign lifecycle (recipients: brand unless noted)

| Event | Hook | Priority | Channels |
|---|---|---|---|
| campaign.submitted_pending_payment (checkout link) | `campaigns.service.ts:304` `submit` | high | both |
| campaign.payment_confirmed + campaign.live | `webhooks.controller.ts:124` `handleEscrowPaid` | critical | both |
| campaign.live.matching_creators (niche fan-out → creators, gated `newCampaigns`) | `webhooks.controller.ts:128` | high | both |
| campaign.approved_by_admin | `campaigns.service.ts:460` `approve` | high | both |
| campaign.rejected (with reason) | *(planned — admin flow)* | high | both |
| campaign.pending_review → admins | `handleEscrowPaid` | high | in-app |
| campaign.completed (→ brand + participating creators) | `payout.scheduler.ts:130` `checkAndCompleteCampaigns` | medium | both |
| campaign.payment_abandoned reminder | *(planned — new scheduler)* | medium | email |
| campaign.expiring_soon | *(planned — new scheduler)* | medium | both |
| review.received (→ creator) | `campaigns.service.ts:1023` `submitReview` | medium | in-app |

### 7.2 Applications (gate on `applicationUpdates`)

| Event | Hook | Priority | Channels |
|---|---|---|---|
| application.submitted (→ brand: new applicant) | `campaigns.service.ts:507` `applyToCampaign` | high | both |
| application.accepted (→ creator: you're hired) | `campaigns.service.ts:576` `reviewCampaignApplication` | **critical** | both |
| application.rejected (→ creator) | `campaigns.service.ts:576` | high | both |
| application.acceptance_undone (→ creator + brand) | `campaigns.service.ts:567` (admin undo) | high | both |
| application.not_selected (→ other pending applicants when campaign fills — currently stranded in 'pending' forever) | `campaigns.service.ts:576-580` accepted branch | medium | in-app |
| application.pending_reminder (→ brand: N awaiting review) | *(planned — scheduler)* | low | both |

### 7.3 Content submissions (gate on `applicationUpdates`)

| Event | Hook | Priority | Channels |
|---|---|---|---|
| submission.draft_submitted (→ brand) | `campaigns.service.ts:679` `submitDraft` | high | both |
| submission.revision_resubmitted (→ brand) | `campaigns.service.ts:667` | high | both |
| submission.draft_approved (→ creator: go post live) | `campaigns.service.ts:729` `vetDraft` | **critical** | both |
| submission.revision_requested (→ creator, with feedback) | `campaigns.service.ts:729` | **critical** | both |
| submission.live_posted (→ brand: verify + approve) | `campaigns.service.ts:792` `submitLivePost` | high | both |
| submission.live_approved + payout.scheduled (→ creator) | `campaigns.service.ts:855` `approveLivePost` | **critical** | both |
| submission.live_url_down (→ brand) | `campaigns.service.ts:936` | medium | both |

### 7.4 Payments & payouts (gate on `paymentAlerts`; admin items non-suppressible)

| Event | Hook | Priority | Channels |
|---|---|---|---|
| payout.released (→ creator; resolves TODO at line 37) | `payout.scheduler.ts:91-99` | **critical** | both |
| payout.failed (→ creator + finance_admin) | `payout.scheduler.ts:103-109` | **critical** | both |
| payout.blocked_escrow_pending (→ finance_admin action item) | `payout.scheduler.ts:69-78` | high | both |
| payout.unblocked / queued (→ creator) | `webhooks.controller.ts:154` `handleEscrowCompleted` | medium | in-app |
| payment.failed / payment.expired (→ brand: retry checkout) | *(planned — webhook default case)* | high | both |
| payment.cancelled (stale checkout replaced) | `campaigns.service.ts:267-274` | low | in-app |
| refund.processed (dispute refund/split) | *(planned — billing)* | high | both |
| ops.webhook_rejected (invalid signature / unknown event → admin + finance_admin; a dropped `escrow.paid` silently strands a funded campaign) | `webhooks.controller.ts:73,90` | medium | both |

### 7.5 Disputes (non-suppressible)

| Event | Hook | Priority | Channels |
|---|---|---|---|
| dispute.raised (→ admins triage + counterparty + raiser confirmation) | `disputes.service.ts:83` `raiseDispute` | high | both |
| dispute.activated (→ creator + brand: chat channel open — today the channel just appears silently) | `disputes.service.ts:92-125` `activateDispute` | high | both |
| dispute.finance_admin_added (→ that finance admin) | `disputes.service.ts:110-112` | medium | in-app |
| dispute.resolved (→ creator + brand with outcome; today the channel freezes with no explanation) | `disputes.service.ts:155` `resolveDispute` | high | both |
| dispute.escrow_action_required (→ finance_admin work item) | `disputes.service.ts:156` | high | both |

### 7.6 Auth, account & security (`category: 'security'` — non-suppressible email)

| Event | Hook | Priority | Channels |
|---|---|---|---|
| OTP (signup/login/password-reset) — **exists; keep direct** | `auth.service.ts:167,216,272,610,691` | critical | email |
| account.welcome / email_verified | `auth.service.ts:640-643` `verifyOtp` (+ social signup `:354`) | high | both |
| auth.password_changed / reset_completed | `auth.service.ts:717` + `profile.service.ts:394` | high | email |
| auth.google_account_linked (Google sign-in silently attached to an existing email/password account — the alert is the only owner-visibility mitigation) | `auth.service.ts:322-330` `googleLogin` linking branch | high | email + in-app |
| account.email_changed (→ old + new address) | `profile.service.ts:59-68` | high | email |
| payout_details.updated (bank change security alert) | `profile.service.ts:276-292` `updatePayout` | high | email + in-app |
| security.settings_changed (2FA on/off) | `profile.service.ts:370-372` | medium | email |
| auth.login_alert (gate on `securitySettings.loginAlertsEnabled`) | `auth.service.ts:252,310` *(planned)* | medium | email |
| account.deactivated (confirmation + 90-day policy) | `profile.service.ts:417` | high | email |
| account.deletion_warning day-60 / day-89 — **exists; migrate onto system** (dedupeKey fixes the repeats-daily-for-29-days bug and PM2 duplication for free) | `account-lifecycle.scheduler.ts:85,110` | critical | email |
| account.reactivated | `auth.service.ts:740` | low | email |
| user.deleted_via_api (confirmation + admin audit; see §9 security bug) | `users.controller.ts:83-88` | high | email |

### 7.7 Profile, social & support

| Event | Hook | Priority | Channels |
|---|---|---|---|
| social.connected / disconnected | `profile.service.ts:170`, `onboarding.controller.ts:330` | low | in-app |
| creator.tier_changed | `profile.service.ts:249-258` | medium | both |
| social.token_expired / reauth_required | *(planned — near social-apis)* | medium | both |
| support.ticket_created (→ user ack + admins) | `profile.service.ts:457` | medium | both |
| support.ticket_status_changed | *(planned — admin flow)* | medium | both |
| onboarding.incomplete_reminder | *(planned — scheduler)* | low | both |

### 7.8 Digest & marketing (opt-in)

| Event | Gate | Notes |
|---|---|---|
| digest.weekly_summary | `weeklySummary` (default false) | BullMQ **repeatable job** (`jobId:'weekly-digest'` — cluster-safe, unlike `@Cron`), Mon 08:00 WAT; aggregates 7 days of notification rows + earnings/applicant stats; one job per user. |
| marketing.offers | `marketingOffers` AND `acceptedPromotions` | Future. |
| ops.email_delivery_failed (aggregated → admins) | — | Today SES failures vanish into console logs; the `email_status='failed'` rows make an admin alert query trivial. |

---

## 8. Phased rollout

| Phase | Contents | Effort |
|---|---|---|
| **1 — Core plumbing** | Migration + entity + repository; `NotificationsModule` + `registerQueue('notifications')`; catalog + types with ~10 launch events; `notify()` + dispatch processor (first BullMQ worker — budget time to validate Redis under PM2 cluster; set `maxRetriesPerRequest: null` on the worker connection); `EmailService.send()` generic + `generic-notification.ejs` + layout + **nest-cli assets fix**; colocated `*.spec.ts` (table-driven `resolveChannels` tests). Exit criteria: a manually fired `notify()` survives a Redis restart and an SES failure with eventual delivery. | 2–3 days |
| **2 — Client API + money path** | `NotificationsController` (feed/unread-count/seen/read/read-all) + throttle constant; wire the ~14 critical/high call sites: `campaigns.service.ts` :507/:576/:679/:729/:792/:855, `payout.scheduler.ts` :76/:92/:106/:132, `webhooks.controller.ts` :124/:154, `disputes.service.ts` :83/:155. **Ship to production here** — polling gives a working product. | 2–3 days |
| **3 — Security/account + legacy migration** | password_changed, payout_details.updated, email_changed, google_account_linked, deactivated, welcome; migrate deletion-warning emails onto `notify()` with `dedupeKey` (fixes daily-resend + cluster dupes); AuthModule DI cleanup; stop logging OTPs. | 2 days |
| **4 — Fan-out + digest + retention** | `campaign.live.matching_creators` niche fan-out (chunked ~500 recipients/job); weekly digest repeatable job; 90-day purge job; admin ops alerts (webhook_rejected, email_delivery_failed). | 2–3 days |
| **5 — Realtime + push** (product-gated) | SSE via Redis pub/sub (+ query-token support in JwtAuthGuard); FCM adapter + `device_tokens` table + third processor branch gated on `pushNotifications`. Zero call-site changes. | 3–4 days |

Total to a fully wired two-channel system: **~2–2.5 engineer-weeks** (phases 1–4).

---

## 9. Risks & gotchas

1. **PM2 cluster duplication is the top correctness risk.** `@Cron` fires on every instance. Every cron/webhook-origin `notify()` must pass `dedupeKey` — enforce in code review and with a catalog `requiresDedupe` flag + spec test. Defense in depth: BullMQ `jobId` + DB unique partial index.
2. **Redis becomes load-bearing for the first time.** `notify()` never throws, so business flows survive Redis-down, but notifications during the outage are lost (log loudly). If that's unacceptable later, upgrade to the outbox pattern (deliveries table + reconciler cron).
3. **`dist/` template gap** — only `otp.ejs` ships today. Render errors are the one thing EmailService throws; inside the worker that burns all retries. Fix assets glob in Phase 1 + boot-time check.
4. **Role-name inconsistency:** `campaigns.service.ts:548,610` checks `'superadmin'` but the seeded role is `'super_admin'` — role fan-out must use seeded names (`creator, brand, finance_admin, admin, super_admin`). (Side effect: the admin undo-acceptance path may currently be dead for real super_admins.)
5. **Synthetic social emails** (`tiktok_*@trendupp.tiktok`) must hard-skip the email leg (BullMQ `UnrecoverableError`, not retry) — and every email-only touchpoint silently no-ops for these users, so in-app must be primary.
6. **Fan-out volume:** a hot campaign's niche fan-out can hit thousands of creators — chunk into per-batch jobs or it stalls the queue.
7. **Table growth:** append-heavy; the purge job + partial unread index keep the hot paths fast. Paranoid soft-delete means purges need `force: true`.
8. **Pre-rendered title/body freeze English copy in rows** — keep `data` JSONB complete enough for clients to re-render if i18n ever matters.

## 10. Pre-existing bugs found during exploration (fix independently)

- **`DELETE /users/:id` has no `RolesGuard`/`@Roles`** (`users.controller.ts:83-88`) — any authenticated user can hard-delete any user. Severe; fix before anything else.
- **OTP codes leak into API responses** (`auth.service.ts:183, 234, 695`) and into console logs via the mock fallback (`email.service.ts:71-76`).
- **Google login silently links** a Google identity to an existing email/password account with no password check and no notification (`auth.service.ts:322-330`).
- Deletion-warning emails re-send daily for ~29 days (no sent-flag) — fixed by Phase 3 migration.
- Dispute channels are created and frozen silently — no message tells participants what happened (covered by dispute.* notifications).
- `'superadmin'` vs `'super_admin'` role-string mismatch (`campaigns.service.ts:548,610`).
