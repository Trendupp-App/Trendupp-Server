# Phase 0 Guide — Zoho Desk Portal Setup for Trendupp Support

Everything in this guide happens in the Zoho Desk web portal (no code). At the
end you will have collected **six values** that switch the already-shipped
integration on:

| Value | Where it goes |
|---|---|
| ASAP JWT secret | Trendupp-Server `.env` → `ZOHO_ASAP_SECRET` |
| Web widget script URL | Trendupp-Web `.env` → `NEXT_PUBLIC_ZOHO_ASAP_WIDGET_URL` |
| Org ID | Trendupp-Mobile `.env.*` → `ZOHO_ASAP_ORG_ID` |
| iOS app ID | Trendupp-Mobile `.env.*` → `ZOHO_ASAP_APP_ID_IOS` |
| Android app ID | Trendupp-Mobile `.env.*` → `ZOHO_ASAP_APP_ID_ANDROID` |
| Data center (e.g. `us`, `eu`, `in`) | Trendupp-Mobile `.env.*` → `ZOHO_ASAP_DC` |

> Menu names below match Zoho Desk's current navigation; minor label drift is
> normal. Everything lives under the gear icon (**Setup**).

---

## Step 1 — Account & data center

1. Sign in at https://desk.zoho.com with the Trendupp Zoho account (the same
   org that held the ZeptoMail mail agent, if you kept it — one org keeps
   billing and users together). If the account lives on another DC you'll be
   redirected (desk.zoho.**eu** / desk.zoho.**in**) — **note which**; that's
   your `ZOHO_ASAP_DC` value and it must match in every SDK config.
2. If Zoho Desk isn't provisioned yet, start it from https://www.zoho.com/desk/
   with that account. Plan note: ASAP add-ons and webhooks are available from
   the **Standard** plan up; verify the trial/plan you land on includes
   "ASAP" under Setup → Channels before investing setup time.

## Step 2 — Portal & department

1. **Setup → General → Company** — set the company name, logo, time zone
   (Africa/Lagos) and the help-center portal name (shown to users in ASAP).
2. **Setup → General → Departments** — rename the default department to
   `Trendupp Support` (one department is enough to start; split later if
   payments/disputes need separate queues).

## Step 3 — Email channel

1. **Setup → Channels → Email** — add the support address
   `support@trendupp.com` as a From/To address.
2. Zoho gives you a **verification + forwarding setup**: since inbound mail
   for trendupp.com is not hosted by Zoho Desk, create a forwarding rule from
   your mail host for `support@trendupp.com` → the Zoho Desk drop-box address
   it displays, then click Verify.
3. For outbound "reply from support@trendupp.com": add the **SPF/DKIM records**
   Zoho shows into the trendupp.com DNS zone (they coexist fine with the
   existing SES records — you'll be adding Zoho's selectors, not replacing
   Amazon's).

## Step 4 — Team (agents & roles)

**Setup → Users & Control → Agents → New Agent**, one per staff member:

| Trendupp role | Zoho Desk profile |
|---|---|
| owner, super_admin | Administrator |
| support_agent | Agent (Standard) |
| moderator, finance_admin | Agent — or Light Agent if they only need visibility |

Each agent should also install the **Zoho Desk mobile app** (App Store / Play
Store) and sign in — that's the on-the-go agent console; nothing to build.

## Step 5 — Ticket categories

Recreate the categories currently in Admin → Settings → Ticket Categories as
a picklist so agents can triage and reports segment:

1. **Setup → Customization → Layouts and Fields → Ticket layout** — edit the
   default **Category** field (or add a picklist field named `Category`).
2. Enter the same values users see in the app today (copy them from the
   Trendupp admin settings tab). Mark it visible in the customer portal so the
   ASAP ticket form shows it.
3. Optional: **Setup → Automation → Workflows** to auto-assign by category
   (e.g. payment categories → finance-minded agents).

> Decision applied from the plan: after cutover, category management moves
> here — the Trendupp admin tab gets retired with the legacy ticket flow.

## Step 6 — Service basics

- **Setup → Automation → SLAs**: start simple — first response 4 business
  hours, resolution 48 hours; escalate to super_admin on breach.
- **Setup → General → Business Hours**: your support window.
- **Setup → Customization → Email Templates / Snippets**: a handful of canned
  replies (payout timing, dispute process, account verification).

## Step 7 — Knowledge Base (feeds ASAP's self-service)

**Knowledge Base module → Manage KB**: create a root category ("Getting
started", "Payments", "Campaigns") and seed articles from the FAQs already
managed in Trendupp Admin → Settings → FAQ Management (copy the top ones).
Mark articles **visible to: All customers** so ASAP can show them without
sign-in.

## Step 8 — ASAP add-ons (the integration heart)

**Setup → Channels → ASAP**. Create **three** add-ons:

### 8a. Web
1. Add → Website, name `Trendupp Web`, allowed domain(s): `app.trendupp.com`
   (add localhost/staging domains for testing).
2. Zoho generates the **embed snippet** — copy the `<script src="...">` URL
   from it. That full URL is `NEXT_PUBLIC_ZOHO_ASAP_WIDGET_URL`.

### 8b. iOS
1. Add → iOS app, name `Trendupp iOS`, bundle ID `com.trendupp.app`.
2. Note the **App ID** and **Org ID** it shows → `ZOHO_ASAP_APP_ID_IOS`,
   `ZOHO_ASAP_ORG_ID`.
3. **Push notifications:** in this add-on's settings, upload the APNs
   auth key — the same `AuthKey_684N598L83.p8` (Key ID `684N598L83`, Team ID
   `JLMV2T5CLD`) already used for FCM. This lets ASAP deliver agent-reply
   pushes to iOS.

### 8c. Android
1. Add → Android app, name `Trendupp Android`, package name = the app's
   applicationId (check `android/app/build.gradle` — per flavor if suffixed).
2. Note the **App ID** → `ZOHO_ASAP_APP_ID_ANDROID`.
3. **Push notifications:** the add-on asks for FCM credentials (service
   account JSON under the current FCM v1 API). Use the existing
   `trendupp-app` Firebase project's service account.

## Step 9 — JWT user authentication

1. In the ASAP add-on settings, switch **User Authentication** from
   Anonymous to **JWT** (the *enhanced* mechanism — no callback URL needed).
   If prompted, enable SSO/JWT under **Setup → Channels → Help Center →
   Access Settings** first.
2. Zoho shows the **JWT secret once** — copy it immediately →
   `ZOHO_ASAP_SECRET` in Trendupp-Server `.env` (and the production host's
   env). All three add-ons should use JWT so web and mobile users are the
   same contact.
3. The server already signs tokens in the exact expected format (HS256,
   `email`, `email_verified`, `first_name`, `last_name`,
   `not_before`/`not_after` ms). Nothing to configure beyond pasting the
   secret.

## Step 10 — Wire the values & verify

1. Paste the six values into the envs listed at the top; restart server/web;
   rebuild the mobile app.
2. **Web check:** open app.trendupp.com signed in → ASAP launcher appears →
   submit a test ticket → it lands in Zoho Desk with your Trendupp name/email
   as the contact.
3. **Mobile check:** Help & Support opens the ASAP ticket screen (not the
   legacy form) → create a ticket → reply as an agent from Zoho Desk → the
   phone gets the reply push (test app in foreground, background, and killed).
4. **Identity check:** the Desk contact created matches your account email;
   a social-login test account shows `email_verified = false` (agents must
   reply in-thread for those).
5. Email a message to support@trendupp.com → it becomes a ticket (channel
   check).

When all five checks pass, ping me and I'll run **Phase 4** (freeze the legacy
ticket endpoints + migrate open tickets) and **Phase 5** (new-ticket webhook →
staff inbox + the /admin/support card).
