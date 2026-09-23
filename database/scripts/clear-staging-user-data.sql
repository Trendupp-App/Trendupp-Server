-- ============================================================================
-- Trendupp · Clear all USER DATA from the STAGING database
-- ============================================================================
-- Run in TablePlus while connected to the STAGING database. DESTRUCTIVE.
--
-- What it wipes  : accounts and everything user-generated (campaigns,
--                  applications, submissions, payments, disputes, chats-side
--                  records, notifications, tokens, tickets, audit trail).
-- What it keeps  : migration/seeder tracking (SequelizeMeta, SequelizeData)
--                  and seeded/admin-configured reference data (roles, niches,
--                  countries/states, banks, industries, issue categories,
--                  fees, token batches, marketing budgets, creator categories,
--                  platforms, system settings, commission tiers, FAQs, news,
--                  news categories, banner ads, social platform settings).
--
-- NOTE: admins live in the users table (role-based), so OPTION A also removes
-- admin logins — recreate with `npm run account:superadmin` afterwards,
-- or use OPTION B to keep admin accounts.
-- ============================================================================

-- ---- STEP 0 · SAFETY CHECK — run this alone first ---------------------------
-- Confirm you are on STAGING before anything else:
-- SELECT current_database() AS db, inet_server_addr() AS host;

-- ============================================================================
-- OPTION A · FULL WIPE (recommended): every account including admins
-- ============================================================================
BEGIN;

DO $$
DECLARE
  t text;
  existing text[] := '{}';
  wipe text[] := ARRAY[
    -- users domain
    'users', 'user_niches', 'user_industries', 'user_token_ledgers',
    'portfolio_items',
    -- auth
    'otps',
    -- notifications
    'notifications', 'device_tokens', 'broadcasts',
    -- campaigns domain
    'campaigns', 'campaign_platforms', 'campaign_applications',
    'campaign_comments', 'campaign_reviews', 'campaign_refunds',
    'content_submissions', 'payments', 'payment_releases',
    -- disputes
    'disputes',
    -- post metrics
    'submission_post_media', 'post_metric_snapshots',
    -- socials
    'social_connections', 'data_deletion_requests',
    -- profile / support
    'support_tickets',
    -- admin trails tied to user records
    'admin_notes', 'audit_logs'
  ];
BEGIN
  -- keep only tables that actually exist in this schema (defensive)
  FOREACH t IN ARRAY wipe LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      existing := existing || t;
    ELSE
      RAISE NOTICE 'skipping missing table: %', t;
    END IF;
  END LOOP;

  -- one TRUNCATE handles FK ordering; CASCADE catches any referencing table
  -- accidentally left off the list (it will be reported by the NOTICE below).
  EXECUTE 'TRUNCATE TABLE '
    || (SELECT string_agg(format('public.%I', x), ', ') FROM unnest(existing) x)
    || ' RESTART IDENTITY CASCADE';

  RAISE NOTICE 'wiped % tables', array_length(existing, 1);
END $$;

COMMIT;

-- ---- Verify (all zeros) -----------------------------------------------------
SELECT 'users' AS t, count(*) FROM users
UNION ALL SELECT 'campaigns', count(*) FROM campaigns
UNION ALL SELECT 'payments', count(*) FROM payments
UNION ALL SELECT 'notifications', count(*) FROM notifications
UNION ALL SELECT 'disputes', count(*) FROM disputes;

-- ---- Verify reference data survived (all non-zero) --------------------------
SELECT 'roles' AS t, count(*) FROM roles
UNION ALL SELECT 'banks', count(*) FROM banks
UNION ALL SELECT 'nationalities', count(*) FROM nationalities
UNION ALL SELECT 'industries', count(*) FROM industries
UNION ALL SELECT 'fees', count(*) FROM fees;

-- Afterwards, recreate the first admin (from the server checkout):
--   npm ci --include=dev && NODE_ENV=staging npm run account:superadmin


-- ============================================================================
-- OPTION B · KEEP ADMIN ACCOUNTS (wipe everything else)
-- ============================================================================
-- Same wipe as Option A, but admin users (owner / super_admin / moderator /
-- support_agent roles) survive. Their notifications/tokens are still cleared.
-- Uses DELETE for users (TRUNCATE cannot keep rows); every dependent table is
-- truncated FIRST so no FK gets in the way of the delete.
/*
BEGIN;

DO $$
DECLARE
  t text;
  existing text[] := '{}';
  wipe text[] := ARRAY[
    'user_niches', 'user_industries', 'user_token_ledgers', 'portfolio_items',
    'otps', 'notifications', 'device_tokens', 'broadcasts',
    'campaigns', 'campaign_platforms', 'campaign_applications',
    'campaign_comments', 'campaign_reviews', 'campaign_refunds',
    'content_submissions', 'payments', 'payment_releases', 'disputes',
    'submission_post_media', 'post_metric_snapshots',
    'social_connections', 'data_deletion_requests', 'support_tickets',
    'admin_notes', 'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY wipe LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      existing := existing || t;
    END IF;
  END LOOP;

  EXECUTE 'TRUNCATE TABLE '
    || (SELECT string_agg(format('public.%I', x), ', ') FROM unnest(existing) x)
    || ' RESTART IDENTITY CASCADE';
END $$;

-- Remove every non-admin user. Adjust the role-name list if yours differ
-- (check with: SELECT name FROM roles;)
DELETE FROM users
WHERE role_id IS NULL
   OR role_id NOT IN (
  SELECT id FROM roles
  WHERE name IN ('owner', 'super_admin', 'moderator', 'support_agent')
);

COMMIT;

SELECT u.email, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id;
*/
