/** Longest account display name accepted by any profile or sign-up path. */
export const DISPLAY_NAME_MAX_LENGTH = 100;

/**
 * Normalize a display name before it is stored: surrounding whitespace is
 * removed, and a blank value becomes undefined, meaning "no name supplied".
 * Every path that writes users.name uses this, so a blank or whitespace-only
 * value can never overwrite (or create) an account name.
 */
export function normalizeDisplayName(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
