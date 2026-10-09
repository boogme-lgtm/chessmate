// Partial-update semantics for optional profile text fields:
//   undefined           → leave the stored value unchanged
//   blank after trim    → clear the stored value (NULL, never "")
//   anything else       → store the trimmed value
export function normalizeOptionalText(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// Keeps only the fields that would change the stored row: drops undefined
// ("leave unchanged") and values equal to what is already stored. A missing
// row counts as all-NULL. An empty result means there is nothing to write.
export function changedFields<T extends Record<string, string | null | undefined>>(
  next: T,
  current: { [K in keyof T]?: string | null } | null | undefined,
): Partial<T> {
  const changes: Partial<T> = {};
  for (const key of Object.keys(next) as (keyof T)[]) {
    const value = next[key];
    if (value === undefined || value === (current?.[key] ?? null)) continue;
    changes[key] = value;
  }
  return changes;
}
