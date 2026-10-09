/**
 * MySQL "duplicate entry" detection (ER_DUP_ENTRY, errno 1062).
 *
 * drizzle-orm 0.44+ wraps every driver error in a DrizzleQueryError and keeps
 * the original mysql2 error on `.cause`, so checking `err.errno` / `err.code`
 * on the thrown error never matches. Walk the cause chain instead (bounded and
 * cycle-safe) so the check holds whether or not a layer wraps the error.
 *
 * Deliberately does not match on message text: a wrapped error's message
 * includes the query parameters, so a value such as "duplicate@example.com"
 * would be misread as a duplicate-key violation.
 */
export function isDuplicateKeyError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 5; depth++) {
    if (!current || typeof current !== "object") return false;
    const e = current as { errno?: unknown; code?: unknown; cause?: unknown };
    if (e.errno === 1062 || e.code === "ER_DUP_ENTRY") return true;
    if (e.cause === current) return false;
    current = e.cause;
  }
  return false;
}
