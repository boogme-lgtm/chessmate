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

/**
 * Why a name typed into a form would be refused, or null when it is accepted.
 * Applies the server's rules (trimmed; at least `minLength`, at most
 * DISPLAY_NAME_MAX_LENGTH characters) with its messages, so a form can explain
 * the rule before submitting.
 */
export function displayNameProblem(
  value: string,
  { label = "Name", minLength = 1 }: { label?: string; minLength?: number } = {},
): string | null {
  const length = value.trim().length;
  if (length === 0) return `${label} is required`;
  if (length < minLength) return `${label} must be at least ${minLength} characters`;
  if (length > DISPLAY_NAME_MAX_LENGTH) return `${label} must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`;
  return null;
}
