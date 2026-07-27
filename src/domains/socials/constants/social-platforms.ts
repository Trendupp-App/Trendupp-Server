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
  FACEBOOK = 'facebook',
}

/** Stable ordering used when returning the full set of platform cards. */
export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  SocialPlatform.INSTAGRAM,
  SocialPlatform.TIKTOK,
  SocialPlatform.YOUTUBE,
  SocialPlatform.TWITTER,
  SocialPlatform.FACEBOOK,
];

/** Human-friendly labels (used in API messages). */
export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  [SocialPlatform.INSTAGRAM]: 'Instagram',
  [SocialPlatform.TIKTOK]: 'TikTok',
  [SocialPlatform.YOUTUBE]: 'YouTube',
  [SocialPlatform.TWITTER]: 'X / Twitter',
  [SocialPlatform.FACEBOOK]: 'Facebook',
};

/**
 * FALLBACK minimum follower/subscriber counts per platform.
 * The live values come from the social_platform_settings table (editable at
 * runtime, seeded with these numbers) — these constants apply only for
 * platforms missing a DB row. See SocialPlatformSettingRepository.
 */
export const MIN_FOLLOWERS: Record<SocialPlatform, number> = {
  [SocialPlatform.INSTAGRAM]: 1000,
  [SocialPlatform.TIKTOK]: 1000,
  [SocialPlatform.YOUTUBE]: 500,
  [SocialPlatform.TWITTER]: 500,
  // Follower count comes from the creator's Facebook Page (profiles expose none).
  [SocialPlatform.FACEBOOK]: 1000,
};

/** Creator tier labels (kept identical to the legacy onboarding strings). */
export const CREATOR_TIERS = {
  NANO: 'Nano Creator',
  MICRO: 'Micro Creator',
  MACRO: 'Macro Creator',
  MEGA: 'Mega Creator',
} as const;

/**
 * Derive a creator tier from the highest follower count across all connected
 * platforms. This is THE tier ladder — the onboarding controller, profile
 * service, and socials service all call this so a user's tier can never
 * differ by endpoint. Thresholds match the ladder live in production
 * (users.assigned_tier was populated with these values).
 */
export function computeTier(maxFollowers: number): string {
  if (maxFollowers >= 1_000_000) return CREATOR_TIERS.MEGA;
  if (maxFollowers >= 200_000) return CREATOR_TIERS.MACRO;
  if (maxFollowers >= 10_000) return CREATOR_TIERS.MICRO;
  return CREATOR_TIERS.NANO;
}

/** Type guard: is the given string one of the supported platforms? */
export function isSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as string[]).includes(value);
}
