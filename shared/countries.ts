/**
 * Shared country list — ISO 3166-1 alpha-2 codes with display names.
 *
 * We store the code (e.g. "US") because Stripe Connect and other integrations
 * require the ISO code, and render the name in the UI via getCountryName().
 */

export type Country = { code: string; name: string };

export const COUNTRIES: Country[] = [
  { code: "AR", name: "Argentina" },
  { code: "AM", name: "Armenia" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BR", name: "Brazil" },
  { code: "BG", name: "Bulgaria" },
  { code: "CA", name: "Canada" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "EG", name: "Egypt" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" },
  { code: "GR", name: "Greece" },
  { code: "HK", name: "Hong Kong" },
  { code: "HU", name: "Hungary" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "MY", name: "Malaysia" },
  { code: "MX", name: "Mexico" },
  { code: "MA", name: "Morocco" },
  { code: "NL", name: "Netherlands" },
  { code: "NG", name: "Nigeria" },
  { code: "NO", name: "Norway" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SG", name: "Singapore" },
  { code: "ZA", name: "South Africa" },
  { code: "KR", name: "South Korea" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "TW", name: "Taiwan" },
  { code: "TH", name: "Thailand" },
  { code: "TR", name: "Turkey" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "VN", name: "Vietnam" },
];

/**
 * Returns the human-readable name for a country code. If the input is already
 * a full name (legacy DB record) or unknown, returns it unchanged so the UI
 * degrades gracefully instead of showing a blank.
 */
export function getCountryName(code: string | null | undefined): string {
  if (!code) return "";
  const match = COUNTRIES.find((c) => c.code === code);
  return match ? match.name : code;
}

/**
 * Returns the ISO code for a given value, which may be a 2-letter code
 * (passed through uppercased) or a full country name (mapped via name).
 * Falls back to `fallback` (default "US") if unresolvable.
 */
export function toCountryCode(
  value: string | null | undefined,
  fallback: string = "US"
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  const match = COUNTRIES.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  return match ? match.code : fallback;
}
