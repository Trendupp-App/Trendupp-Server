# Trendupp Notification System

Reference for the in-app + email notification system in `src/domains/notifications/`.
For the original design rationale and future roadmap (push, SSE, digests), see
[NOTIFICATION_SYSTEM_PLAN.md](../NOTIFICATION_SYSTEM_PLAN.md).

## How it works

```
Domain service ──▶ NotificationsService.notify(...)      one line, never throws
                        │  validates against the catalog, enqueues
                        ▼
              BullMQ 'notifications' queue               attempts: 3, exp. backoff
                        │  jobId = <type>:<dedupeKey>    exactly-once under PM2 cluster
                        ▼
              NotificationDispatchProcessor
                1. resolve recipients (ids | role fan-out), actor excluded
                2. gate per recipient via users.notification_settings
                3. INSERT notifications row (in-app feed)
                4. render EJS + send email → email_status audit column
```

- **`notify()` never throws.** A Redis or SES outage can never break the business
  transaction (escrow webhook, payout run) that triggered it. If the queue is
  unreachable, delivery falls back to inline fire-and-forget.
- **Idempotency.** Cron- and webhook-origin calls MUST pass `dedupeKey`.
  It becomes the BullMQ `jobId` (queue-level dedupe) and is stored per recipient
  as `<type>:<dedupeKey>:<userId>` under a unique index (DB-level dedupe).
  `@Cron` fires on every PM2 instance (`instances: 'max'`) and Pandascrow may
  redeliver webhooks — without a dedupeKey the user gets N copies.
- **Email failures never lose a notification.** The in-app row is written first;
  a failed SES send is recorded on the row (`email_status='failed'`, `email_error`).
- **Synthetic addresses are skipped.** TikTok/Instagram signups have
  `*@trendupp.tiktok|instagram` placeholder emails; the email leg is skipped
  (`email_status='skipped'`) and in-app is their primary channel.

Key files:

| File | Role |
|---|---|
| `notification.types.ts` | `NotificationType` union + typed payload per type |
| `notification.catalog.ts` | **Source of truth**: category, channels, priority, copy, deep link per type |
| `services/notifications.service.ts` | `notify()` — the only API producers call |
| `services/notification-dispatcher.service.ts` | Recipient resolution, preference gating, row insert, email leg |
| `services/notification-dispatch.processor.ts` | BullMQ worker (`notifications` queue) |
| `controllers/notifications.controller.ts` | Client REST API |
| `entities/notification.entity.ts` | `notifications` table model |
| migration `20260714120000-create-notifications-table.js` | Table + feed/unread/dedupe indexes |

## Preference gating

Preferences live in `users.notification_settings` JSONB (managed by the client at
`GET/PATCH /api/v1/profile/notifications`). Enforcement is one pure function,
`NotificationDispatcherService.resolveChannels()`:

| Rule | Behavior |
|---|---|
| `category: 'security'` | Bypasses **all** toggles (money movement, disputes, account security). |
| Category toggle off | Suppresses medium/low entirely; **critical/high still land in-app** (user opted out of noise, not history) but never email. |
| `emailNotifications: false` | Master email kill switch for all non-security email. |
| In-app | No master kill switch by design — the tray is the system of record. |
| Missing keys (pre-migration users) | Count as enabled, matching the JSONB defaults. |
| Role fan-outs (`finance_admin`, `admin`) | Not preference-gated — operational work items. |

Category → settings-key mapping: `applicationUpdates`, `paymentAlerts`,
`newCampaigns`, `brandMessages`, `weeklySummary`, `marketingOffers` map 1:1;
`security` is the non-suppressible sentinel.

## Implemented notifications (24)

**Legend** — Channels: in-app + email unless noted. Gate: settings key, or
**security** = non-suppressible. Dedupe: the `dedupeKey` passed (✗ = request-path
call, naturally single-fire).

### Applications — gate: `applicationUpdates`

| Type | Priority | Recipients | Trigger | Dedupe |
|---|---|---|---|---|
| `application.submitted` | high | brand | `CampaignsService.applyToCampaign` — creator applies | ✗ |
| `application.accepted` | critical | creator | `CampaignsService.reviewCampaignApplication` (accept) | ✗ |
| `application.rejected` | high | creator | `CampaignsService.reviewCampaignApplication` (reject) | ✗ |
| `application.acceptance_undone` | high | creator + brand | `reviewCampaignApplication` — admin undoes an acceptance | ✗ |

### Content submissions — gate: `applicationUpdates` (last one: `paymentAlerts`)

| Type | Priority | Recipients | Trigger | Dedupe |
|---|---|---|---|---|
| `submission.draft_submitted` | high | brand | `CampaignsService.submitDraft` — first draft | ✗ |
| `submission.revision_resubmitted` | high | brand | `submitDraft` — revised draft (must be approved or disputed) | ✗ |
| `submission.draft_approved` | critical | creator | `CampaignsService.vetDraft` (approve) | ✗ |
| `submission.revision_requested` | critical | creator | `vetDraft` (request revision, includes brand feedback) | ✗ |
| `submission.live_posted` | high | brand | `CampaignsService.submitLivePost` — live link submitted | ✗ |
| `submission.live_approved` | critical | creator | `CampaignsService.approveLivePost` — payout of `application.feeRequest` scheduled (+30 days) | ✗ |

### Payouts & payments — money amounts are currency-aware (`release.currency` / `campaign.currency`)

| Type | Priority | Gate | Recipients | Trigger | Dedupe |
|---|---|---|---|---|---|
| `payout.released` | critical | `paymentAlerts` | creator | `PayoutScheduler.processPendingPayouts` — bank transfer succeeded | `<releaseId>` |
| `payout.failed` | critical | security | creator **and** finance_admins | `processPendingPayouts` catch — transfer failed | `<releaseId>:failed`, `<releaseId>:failed:finance` |
| `payout.escrow_pending` | high | security | finance_admins (work item) | `processPendingPayouts` — payout blocked awaiting escrow release | `<releaseId>:escrow_pending` |
| `campaign.payment_confirmed` | critical | `paymentAlerts` | brand | `WebhooksController.handleEscrowPaid` — campaign goes live | `<campaignId>:live` |
| `campaign.completed` | medium | `applicationUpdates` | brand | `PayoutScheduler.checkAndCompleteCampaign` — all releases + submissions done | `<campaignId>:completed` |

### Refunds (brand refunds of unused campaign budget)

| Type | Priority | Gate | Recipients | Trigger | Dedupe |
|---|---|---|---|---|---|
| `refund.completed` | critical | `paymentAlerts` | brand | `PayoutScheduler.processPendingRefunds` — transfer succeeded. Zero-amount refunds never notify (created directly as completed). | `<refundId>` |
| `refund.failed` | critical | security | brand **and** finance_admins | `processPendingRefunds` catch — transfer failed | `<refundId>:failed`, `<refundId>:failed:finance` |
| `refund.bank_details_required` | high | security | brand (actionable → `/settings/payout`) | `processPendingRefunds` — refund parked, brand has no bank details | `<refundId>:bank_details` |

### Social connections — gate: security, **in-app only** (account-change confirmations)

| Type | Priority | Recipients | Trigger | Dedupe |
|---|---|---|---|---|
| `social.connected` | low | creator/brand | `SocialsService.connect` — OAuth-verified account linked; includes verified follower count + recomputed tier | ✗ |
| `social.disconnected` | low | creator/brand | `SocialsService.disconnect` — doubles as a security signal ("if this wasn't you, contact support") | ✗ |

### Disputes — gate: security (contractual process, never suppressible)

| Type | Priority | Recipients | Trigger | Dedupe |
|---|---|---|---|---|
| `dispute.raised` | high | counterparty (actor auto-excluded) + all admins | `DisputesService.raiseDispute` | ✗ |
| `dispute.activated` | high | creator + brand | `DisputesService.activateDispute` — resolution chat opened (not re-sent on retry) | `<disputeId>` |
| `dispute.resolved` | high | creator + brand | `DisputesService.resolveDispute` — outcome + notes (the chat freezes silently otherwise) | `<disputeId>` |
| `dispute.escrow_action_required` | high | finance_admins (work item) | `resolveDispute` — execute the escrow decision in Pandascrow | `<disputeId>` |

### Outside the system (legacy direct email, intentionally)

| Email | Sender | Why outside |
|---|---|---|
| OTP (signup/login/password reset) | `AuthService` → `EmailService.sendOtpEmail` | Latency-sensitive, security-critical, must never be preference-gated |
| Account-deletion warnings (day 60 / day 89) | `AccountLifecycleScheduler` | Planned migration onto `notify()` (Phase 3) — will fix its daily re-send and PM2 duplication bugs |

## Client API

All under `/api/v1/notifications`, JWT-authenticated, scoped to the caller:

| Endpoint | Purpose |
|---|---|
| `GET /notifications?page&limit&unreadOnly&category` | Paginated feed, newest first. Items include `title`, `body`, `actionUrl` (deep link), `data` (raw payload), `actor` (id/name/avatar), `readAt`, `createdAt`. |
| `GET /notifications/unread-count` | `{ count }` — badge poll target (throttled via `THROTTLE_LIMITS.NOTIFICATION_POLL`, 120/min). |
| `PATCH /notifications/seen` | Zeroes the badge when the tray opens; items stay visually unread. |
| `PATCH /notifications/:id/read` | Mark one read (404 if not owned). |
| `PATCH /notifications/read-all` | Mark all read. |

## Email rendering

`EmailService.send({ to, subject, template, data, throwOnFailure })` is the single
render/SES/mock path. Notification emails default to
`templates/generic-notification.ejs` (title, body, CTA button from `actionUrl`,
preferences-management footer; base URL from `WEB_APP_URL`, default
`https://trendupp.com`). A type that needs bespoke design sets `emailTemplate`
in its catalog entry — no code change. Without SES credentials the service runs
in mock mode (console logging) and rows record `email_status='mocked'`.

## Adding a new notification type

1. **Payload** — add the type + payload interface to `NotificationPayloads`
   in `notification.types.ts`.
2. **Catalog entry** — add one object to `notification.catalog.ts`:
   category (settings key or `'security'`), channels, priority, `title`/`body`
   renderers, `actionUrl` deep link, optional `emailSubject`/`emailTemplate`.
3. **Call site** — after the state change in the domain service:

   ```ts
   await this.notificationsService.notify({
     type: 'my.new_event',
     recipientId: user.id,            // or recipientRole: 'finance_admin'
     actorId: caller.id,              // optional, shown in the feed
     data: { ... },                   // typed against your payload
     dedupeKey: entity.id,            // REQUIRED from crons/webhooks
   });
   ```

   If the module doesn't already import it, add `NotificationsModule` to the
   domain module's `imports` and inject `NotificationsService`.
4. **Spec** — the catalog-integrity test covers the entry automatically; add a
   call-site assertion in the service's spec (mock `{ notify: jest.fn() }`).

Rules of thumb: money movement and account security are `category: 'security'`;
anything fired from a `@Cron` or webhook needs a `dedupeKey`; amounts in copy go
through the `money(amount, currency)` helper.

## Operations

- **Delivery audit**: `SELECT email_status, count(*) FROM notifications GROUP BY 1`
  — `failed` rows carry the SES error in `email_error`.
- **Queue**: BullMQ `notifications` queue on the root Redis connection;
  jobs keep 1000 completed / 5000 failed entries for inspection.
- **Retention**: the table is append-heavy; a purge job for read rows older than
  90 days is planned (Phase 4). The partial unread index keeps badge queries fast
  regardless.
