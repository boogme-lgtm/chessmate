import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bindingDigest, bindingMatches, createBindingNonce, readCookie } from "./_core/browserBinding";

describe("browser binding helpers", () => {
  it("mints 32 random bytes in cookie-safe base64url", () => {
    const nonces = Array.from({ length: 100 }, createBindingNonce);
    for (const nonce of nonces) expect(Buffer.from(nonce, "base64url")).toHaveLength(32);
    expect(new Set(nonces).size).toBe(nonces.length);
  });

  it("fingerprints a link token one way, so the cookie never holds the token", () => {
    const token = "a".repeat(64);
    const digest = bindingDigest(token);
    expect(digest).toBe(createHash("sha256").update(token).digest("base64url"));
    expect(digest).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(digest).not.toContain(token);
    expect(bindingDigest(`${token}b`)).not.toBe(digest);
  });

  it("matches only the exact value, and never an absent one", () => {
    const value = createBindingNonce();
    expect(bindingMatches(value, value)).toBe(true);
    expect(bindingMatches(value, `${value}x`)).toBe(false);
    expect(bindingMatches(value, value.slice(1))).toBe(false);
    expect(bindingMatches(value, undefined)).toBe(false);
    expect(bindingMatches(undefined, value)).toBe(false);
    expect(bindingMatches(null, null)).toBe(false);
    expect(bindingMatches("", "")).toBe(false);
  });

  it("reads one named cookie without trusting lookalikes", () => {
    const read = (cookie?: string) => readCookie({ headers: cookie === undefined ? {} : { cookie } }, "app_binding");
    expect(read()).toBeUndefined();
    expect(read("app_binding_x=1; other=2")).toBeUndefined();
    expect(read("other=2; app_binding=value")).toBe("value");
    expect(readCookie({} as never, "app_binding")).toBeUndefined();
  });
});
