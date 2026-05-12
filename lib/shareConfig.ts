// Share & Earn — platform + hashtag configuration.
//
// Hashtag list is the placeholder set; final list comes from Kasey
// (Open Question #1 in the plan tracker). Swap the array below when received.
//
// Per-platform star values are mirrored from the on_submission_share_verified
// trigger (15 ★ per platform + 5 ★ all-three bonus = 50 ★ max).

export type SharePlatform = 'facebook' | 'instagram' | 'tiktok';

export const SHARE_PLATFORMS: ReadonlyArray<{
  key: SharePlatform;
  label: string;
  brandColor: string;
}> = [
  { key: 'facebook',  label: 'Facebook',  brandColor: '#1877F2' },
  { key: 'instagram', label: 'Instagram', brandColor: '#E4405F' },
  { key: 'tiktok',    label: 'TikTok',    brandColor: '#000000' },
];

export const STARS_PER_PLATFORM = 15;
export const STARS_ALL_THREE_BONUS = 5;
export const STARS_MAX = SHARE_PLATFORMS.length * STARS_PER_PLATFORM + STARS_ALL_THREE_BONUS;

// Final hashtag list (locked 2026-05-09 by Kasey).
export const REQUIRED_HASHTAGS: readonly string[] = [
  '#Wegood4u',
  '#eatsnapearn',
];

// Mention handle the AI verifier (and later the user copy) will look for.
export const REQUIRED_MENTION = '@wegood4u';
