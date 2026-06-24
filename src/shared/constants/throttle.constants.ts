/**
 * Centralized rate-limit configurations for all throttled endpoints.
 *
 * Each entry maps to a `@Throttle({ default: THROTTLE_LIMITS.<KEY> })` decorator.
 * - `ttl`   — rolling time window in milliseconds (60 000 ms = 1 minute)
 * - `limit` — maximum number of requests allowed within that window per IP
 *
 * To adjust a limit, change it here and it will propagate automatically
 * to every controller that references it.
 */
export const THROTTLE_LIMITS = {
  /** Registration  */
  SIGNUP: { ttl: 60000, limit: 5 },

  LOGIN: { ttl: 60000, limit: 10 },

  OTP_SEND: { ttl: 60000, limit: 3 },

  OTP_VERIFY: { ttl: 60000, limit: 5 },

  FORGOT_PASSWORD: { ttl: 60000, limit: 3 },

  RESET_PASSWORD: { ttl: 60000, limit: 5 },

  // Onboarding

  LOOKUP: { ttl: 60000, limit: 30 },

  ONBOARDING_STEP: { ttl: 60000, limit: 10 },

  USERNAME_CHECK: { ttl: 60000, limit: 20 },

  // Campaigns

  CAMPAIGN_CREATE: { ttl: 60000, limit: 5 },
} as const;
