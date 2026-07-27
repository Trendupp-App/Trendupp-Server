# Support System via Zoho Desk — Implementation Plan

**Goal:** replace the half-built in-house support flow with Zoho Desk, embedded
in the mobile app (Flutter) and the consumer web app (Next.js). Agents work in
Zoho Desk's own console/mobile app — the Trendupp-Admin support module is
never built.

## Architecture decision

Two viable integration styles:

| | A. Embed Zoho's ASAP add-on (recommended) | B. Keep our ticket UI, proxy the Zoho Desk REST API |
|---|---|---|
| End-user UX | Zoho's in-app help center (tickets + replies, knowledge base, Guided Conversations bot, optional live chat) | Our existing ticket screens, pixel-perfect brand control |
| Build effort | Small — SDK init + auth token wiring | Medium — backend proxy for tickets/threads/attachments, contact mapping, polling or webhooks for replies |
| Replies/notifications | Handled by ASAP (its own push + in-widget threads) | We build reply threads + wire webhooks into our notification system |
| KB / bot / chat | Included | Not available without extra work |
| Maintenance | Zoho's problem | Ours |

**Recommendation: A (ASAP)** on both platforms. Option B only makes sense if
in-app support UX branding is a hard requirement; revisit later — the REST API
remains available regardless.

## What exists today (to be retired)

- Server: `POST/GET /profile/support-ticket` (+ `issue_categories`, now
  admin-manageable). Users can create/view tickets; **no admin can see or
  answer them** — the reason for this migration.
- Mobile: support-ticket screens under profile/settings.
- Admin: `/admin/support` is a ComingSoon stub.

---

## Phase 0 — Zoho Desk org setup (portal work, no code)

1. Zoho Desk department "Trendupp Support"; connect the email channel
   (support@trendupp.com — SES domain is already verified for sending; add the
   Zoho Desk forwarding/verification records).
2. Agents: invite the staff (map `support_agent` → Agent, `super_admin`/`owner`
   → Administrator). Agents also install the **Zoho Desk mobile app**.
3. Recreate the ticket categories from `issue_categories` as a Desk picklist
   field (or departments/layouts if routing differs per category).
4. SLAs, business hours, canned replies, and a starter Knowledge Base section
   (ASAP surfaces KB natively — worth seeding with FAQs, which already exist in
   admin settings).
5. Enable **ASAP add-ons**: one for Web, one for iOS, one for Android → yields
   per-platform `orgId` / `appId` / data-center values.
6. Configure ASAP **JWT user authentication** (not Anonymous) so tickets attach
   to the signed-in Trendupp user. Zoho supports two modes:
   - classic: we host a JWT callback endpoint;
   - enhanced: the app signs a JWT with a shared secret, no endpoint needed.
   Use the **enhanced mechanism** where supported — secret lives server-side
   either way (see Phase 1).

## Phase 1 — Identity bridge (server, ~half day)

- `GET /support/asap-token` (JwtAuthGuard): returns a short-lived JWT signed
  with the ASAP secret, claims = user id, email, display name. Both clients
  call this and hand the token to the widget/SDK. Keeping the signing
  server-side means the secret never ships in the apps.
- **Synthetic-email caveat:** social-login users have undeliverable
  `*@trendupp.tiktok/...` addresses. They still work as Zoho contact
  identifiers (in-app replies + ASAP push are unaffected), but email replies
  from agents will bounce. Mitigation: include a `cf_real_contact: false`
  custom field via the JWT claims so agents see it, and nudge these users to
  add a real email.
- Env: `ZOHO_ASAP_SECRET`, plus per-platform app ids in the clients' configs.

## Phase 2 — Web app (Trendupp-Web, ~half day)

- Load the ASAP web widget script (Zoho-provided snippet with web `appId`) via
  a Next.js `Script` in the authenticated layout.
- Call `ZohoDeskAsapReady` → set the JWT from `/support/asap-token`; open the
  widget from the existing Help/Support entry points (settings menu, footer).
- Remove/redirect the old ticket screens.

## Phase 3 — Mobile app (Trendupp-Mobile, ~1–1.5 days)

- Add the official Flutter plugins (pick modules we use):
  `zohodesk_portal_services` (core + init), `zohodesk_portal_ticket` (tickets),
  `zohodesk_portal_kb` (knowledge base), optionally `zohodesk_portal_gc`
  (Guided Conversations bot).
- Initialize per flavor with orgId/appId/DC; on sign-in fetch
  `/support/asap-token` and call the SDK login; logout on our logout.
- Replace the in-house support-ticket screens with ASAP's ticket module
  (entry point stays where it is in profile/settings).
- **Push coexistence:** ASAP has its own reply push notifications riding the
  same FCM registration. Our `NotificationService.onMessage`/background
  handlers must hand ASAP-originated messages to the ASAP SDK (it exposes an
  `isAsapNotification`/process API) and handle our own as today. This is the
  one integration point that needs care — test reply pushes in all three app
  states.
- iOS: no extra capability needed beyond existing push entitlements.

## Phase 4 — Cutover & data (server, ~half day)

- Freeze `POST /profile/support-ticket` (410 + message pointing to the new
  Help section) after both clients ship; keep `GET` temporarily for history,
  or migrate open tickets into Zoho Desk via its REST API (small script:
  create contacts by email, tickets with original timestamps in a custom
  field). Recommend migrating **open** tickets only and archiving the rest.
- `issue_categories` stays (admin settings tab keeps working) only if we keep
  the field mirrored in Zoho; otherwise deprecate the tab and manage
  categories in Desk. **Decide during Phase 0.**

## Phase 5 — Staff awareness (optional, ~half day)

- Zoho Desk webhook (`Ticket Created` / `Ticket Escalated`) →
  `POST /webhooks/zohodesk` (signature-verified) → `notify()` to the
  `support_agent` role. New tickets then appear in the admin bell inbox we
  just built, deep-linking to the Zoho Desk ticket URL.
- `/admin/support` page: replace ComingSoon with a lightweight card — open
  Zoho Desk console button + headline counts pulled from the Desk API
  (open/overdue tickets) if wanted.

## Decisions needed before starting

1. **Data center** — the Zoho org (same one as the former ZeptoMail account?)
   determines `.com/.eu/.in` endpoints everywhere.
2. **Live chat?** Agent chat requires SalesIQ (separate product/pricing);
   Guided Conversations bot is part of Desk. Plan assumes bot yes, chat later.
3. **Migrate or archive** existing tickets (Phase 4).
4. **Categories ownership** — keep the admin settings tab mirrored to Desk, or
   move category management into Desk entirely.
5. Zoho Desk **plan tier** — ASAP + webhooks need at least the plan that
   includes ASAP customization (verify current subscription).

## Effort summary

| Phase | Effort |
|---|---|
| 0 — Desk org setup | portal work, ~half day |
| 1 — JWT bridge | ~half day |
| 2 — Web embed | ~half day |
| 3 — Flutter SDK | ~1–1.5 days (push coexistence is the risk item) |
| 4 — Cutover/migration | ~half day |
| 5 — Staff inbox webhook + admin card | ~half day |

**Total: ~3.5–4 days**, front-loaded by portal configuration.
