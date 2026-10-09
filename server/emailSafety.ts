/**
 * Output encoding for outbound email. Every value a user, coach, applicant or
 * provider can influence (names, titles, descriptions, messages, notes) is
 * plain text and MUST pass through escapeHtml before it is interpolated into an
 * HTML body. Templates escape their own inputs once, at entry, so callers pass
 * raw values; never escape a value twice.
 */

/** Escape text for HTML element content or a double/single-quoted attribute. */
export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape multi-line plain text and keep its line breaks. */
export function escapeHtmlWithLineBreaks(value: string | null | undefined): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br>");
}

/** Shorten raw text BEFORE escaping so an entity is never cut in half. */
export function truncateText(value: string, maxLength: number, ellipsis = "..."): string {
  return value.length > maxLength ? value.slice(0, maxLength) + ellipsis : value;
}

/**
 * A subject is a single header line. Line breaks (CR/LF and the Unicode line
 * separators) and other control characters could otherwise inject headers or
 * break the message, so they collapse to one space. Subjects are plain text:
 * do not HTML-escape them.
 */
export function sanitizeEmailSubject(subject: string): string {
  return subject.replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, " ").trim();
}
