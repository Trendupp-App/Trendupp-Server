/**
 * Supported social platforms for the "Connect Socials" feature and the rules
 * that govern eligibility + creator tiering.
 *
 * These are the platforms a creator can link during onboarding (Step 3/4) to
 * have their follower count *verified* via OAuth — as opposed to the legacy
 * self-reported flow on `PATCH /users/onboarding/socials`.
 */
export enum SocialPlatform {
  INSTAGRAM = 'instagram',
  TIKTOK = 'tiktok',
  YOUTUBE = 'youtube',
  TWITTER = 'twitter',
}

/** Stable ordering used when returning the full set of platform cards. */
export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  SocialPlatform.INSTAGRAM,
  SocialPlatform.TIKTOK,
  SocialPlatform.YOUTUBE,
  SocialPlatform.TWITTER,
];

/** Human-friendly labels (used in API messages). */
export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  [SocialPlatform.INSTAGRAM]: 'Instagram',
  [SocialPlatform.TIKTOK]: 'TikTok',
  [SocialPlatform.YOUTUBE]: 'YouTube',
  [SocialPlatform.TWITTER]: 'X / Twitter',
};

/**
 * Minimum follower/subscriber count required to connect each platform.
 * Mirrors the thresholds shown on the mobile/web "Connect Socials" screen
 * (TikTok 1,000+, YouTube 500+, X 500+). Instagram is assumed 1,000 — adjust
 * here if product decides otherwise; this is the single source of truth.
 */
export const MIN_FOLLOWERS: Record<SocialPlatform, number> = {
  [SocialPlatform.INSTAGRAM]: 1000,
  [SocialPlatform.TIKTOK]: 1000,
  [SocialPlatform.YOUTUBE]: 500,
  [SocialPlatform.TWITTER]: 500,
};

/** Creator tier labels (kept identical to the legacy onboarding strings). */
export const CREATOR_TIERS = {
  NANO: 'Nano Creator',
  MICRO: 'Micro Creator',
  MID: 'Mid-tier Creator',
  MACRO: 'Macro Creator',
} as const;

/**
 * Derive a creator tier from the highest verified follower count across all
 * connected platforms. Centralised so the legacy onboarding controller and
 * the new socials service stay in lock-step.
 */
export function computeTier(maxFollowers: number): string {
  if (maxFollowers >= 500_000) return CREATOR_TIERS.MACRO;
  if (maxFollowers >= 100_000) return CREATOR_TIERS.MID;
  if (maxFollowers >= 10_000) return CREATOR_TIERS.MICRO;
  return CREATOR_TIERS.NANO;
}

/** Type guard: is the given string one of the supported platforms? */
export function isSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as string[]).includes(value);
}
