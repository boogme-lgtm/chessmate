import type { Express } from "express";

/** Additional framing origins must be explicitly approved, never inferred from requests. */
export function frameAncestorsFromSetting(setting?: string): string[] {
  if (!setting?.trim()) return ["'self'"];
  if (setting.length > 2048)
    throw new Error("SECURITY_FRAME_ANCESTORS is too long");
  const origins = setting.split(",").map(value => {
    try {
      const url = new URL(value.trim());
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash ||
        url.hostname.includes("*") ||
        /[;'"\s]/.test(url.origin)
      )
        throw new Error();
      return url.origin;
    } catch {
      throw new Error(
        "SECURITY_FRAME_ANCESTORS must contain comma-separated HTTPS origins without paths, credentials or wildcards"
      );
    }
  });
  return Array.from(new Set(["'self'", ...origins]));
}

/** Baseline browser protections. HSTS remains managed by the HTTPS edge. */
export function configureSecurityHeaders(
  app: Express,
  framingSetting = process.env.SECURITY_FRAME_ANCESTORS
): void {
  const ancestors = frameAncestorsFromSetting(framingSetting);
  const csp = `frame-ancestors ${ancestors.join(" ")}; base-uri 'self'; object-src 'none'`;
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      // Keep first-party coaching camera/microphone use possible. This does not
      // replace the browser's permission prompt and does not restrict payments.
      "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",
      "Content-Security-Policy": csp,
    });
    // X-Frame-Options cannot express an allowlist. Send it only when it agrees
    // with CSP; approved cross-origin preview embedding otherwise uses CSP.
    if (ancestors.length === 1) res.set("X-Frame-Options", "SAMEORIGIN");
    next();
  });
}
