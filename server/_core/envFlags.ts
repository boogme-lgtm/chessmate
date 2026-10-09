const TRUE_SPELLINGS = new Set(["true", "1", "yes", "on"]);
const FALSE_SPELLINGS = new Set(["false", "0", "no", "off"]);

/**
 * Read an optional boolean setting. The common spellings (true/false, 1/0,
 * yes/no, on/off) are accepted in any case and with surrounding whitespace, so
 * a host's formatting cannot flip behavior. Unset returns undefined, letting
 * the caller keep its default. Anything else throws a clear error: call this
 * before the server listens, so a typo stops the deploy instead of guessing.
 * The value itself is not echoed, matching the other configuration errors.
 */
export function parseBooleanSetting(name: string, value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (TRUE_SPELLINGS.has(normalized)) return true;
  if (FALSE_SPELLINGS.has(normalized)) return false;
  throw new Error(`${name} must be true or false when set (1/0, yes/no and on/off are also accepted)`);
}
