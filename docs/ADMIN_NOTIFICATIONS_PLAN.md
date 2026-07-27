# Admin Notifications — Plan & Status

**Goal:** a real notification inbox for the admin team — work items (disputes,
escrow) and awareness events (team changes, broadcast confirmations) — surfaced
in the Trendupp-Admin console's bell/drawer, powered by the existing
notification pipeline.

**Product decisions (July 2026):**
1. Push is NOT a standalone channel — push piggybacks on in-app automatically.
   Broadcast channels are `in_app | email | both` only; the admin composer UI
   offers In-App and Email.
2. `dispute.raised` staff fan-out targets the **support_agent** role.
3. NO separate "staff" notification category — staff notifications use the
   existing product taxonomy (chatDispute, payments, account, broadcast).
4. Admins can NEVER mute notifications — there is no admin
   notification-settings UI. Role fan-outs bypass all preference gating.
5. Staff-targeted broadcasts: not needed for now.
6. Badge polling at 45s is fine (no SSE for now).
7. No audit-log tab in the notification drawer for now.
8. Admin notification APIs live under **`/admin/notifications`** (staff-role
   guarded, Swagger tag `admin-notifications`) — never mixed with the consumer
   feed at `/notifications`.

---

## ✅ Implemented

### Backend (Trendupp-Server)

- **`GET/PATCH /admin/notifications[...]`** — dedicated staff controller
  (`admin/controllers/admin-notifications.controller.ts`): feed,
  `unread-count` (throttle-tuned for 45s polling), `seen`, `read-all`,
  `:id/read`. Guarded `@Roles('owner','super_admin','finance_admin','moderator','support_agent')`.
- **Fixed: `dispute.raised` reached no admin.** It fanned out to role
  `'admin'`, which is never seeded → now `support_agent`.
  `NotificationRecipientRole` re-typed to the five seeded staff roles and
  accepts an array (`recipientRole: ['owner','super_admin']`).
- **Role fan-outs bypass preference gating** (dispatcher): staff work items
  deliver on every declared channel + push regardless of the recipient's
  notification_settings (decision 4).
- **Dead role vocabulary removed**: `@Roles('admin')`/`'superadmin'`
  normalized to seeded names across admin, disputes, users, and campaigns
  controllers; `'admin'` dropped from `ADMIN_ROLES` and the team-list filter.
- **New staff notification types** (in the standard catalog):
  `admin.team_member_invited/suspended/reactivated/removed` (→ owner +
  super_admin, category `account`, in-app only) wired into
  `AdminUsersService`, and `broadcast.sent` (→ the sending admin, category
  `broadcast`) wired into `dispatchBroadcast`.
- **`actionUrl` fix**: `dispute.escrow_action_required` now deep-links to
  `/admin/disputes?focus=:id` (no detail route exists in the admin app).
- **Broadcast email leg**: dedicated `broadcast.ejs` template (no more OTP
  template reuse) + synthetic-address skip.
- **Scheduled broadcasts now dispatch.** A BullMQ repeatable job
  (`BroadcastSchedulerProcessor`, `broadcasts` queue, 60s tick — cluster-safe,
  unlike `@Cron`) sends due `status:'scheduled'` broadcasts. Each broadcast is
  atomically claimed (`claimScheduled`: scheduled→sent only if still
  scheduled) so a tick can never double-send or race a manual send; a dispatch
  failure marks the broadcast `failed`.
- docs/NOTIFICATIONS.md corrected: `refund.*` types marked NOT BUILT.

### Frontend (Trendupp-Admin)

- Inbox API client + react-query hooks against `/admin/notifications/*`
  (`services/adminInboxApi.ts`, `hooks/useAdminInbox.ts`, `types/adminInbox.ts`).
- `AdminNotificationDrawer` wired to the real feed: category tabs, infinite
  list, unread styling, mark-read + deep-link on click, mark-all-read,
  mark-seen on open.
- Bell badge driven by `unread-count` on a 45s `refetchInterval` (replaces the
  permanently-lit dot).
- Broadcast channel type fixed to `in_app | email | both` (push option
  removed from the composer), `failed` status added.
- Dead `/admin/escrow` links → `/admin/finance/escrow`.

---

## Follow-ups (not yet built)

| Item | Notes |
|---|---|
| `refund.completed` / `refund.failed` / `refund.bank_details_required` | Spec'd in docs/NOTIFICATIONS.md; `processPendingRefunds` only logs today. finance_admin fan-out on failure. |
| Campaign-approval work item | The live flow is `pending_payment → live` (payment webhook) with no admin gate; the `approveCampaign`/`pending_approval` path looks legacy. If an approval gate returns, add `staff` work-item type then. |
| Social-impact participant queue notification | Moderators currently discover pending participants only by visiting the page. |
| Dispute SLA reminder | Cron-origin (needs `dedupeKey`), e.g. dispute open > 48h → super_admin. |
| `/admin/finance/escrow` page | Still a ComingSoon stub — target of `payout.escrow_pending` deep links. |
