import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import Stripe from "stripe";
import {
  configureSecurityHeaders,
  frameAncestorsFromSetting,
} from "./_core/securityHeaders";

describe("framing configuration", () => {
  it("defaults to same-origin framing", () => {
    expect(frameAncestorsFromSetting()).toEqual(["'self'"]);
  });
  it("normalizes and deduplicates only explicit trusted HTTPS origins", () => {
    expect(
      frameAncestorsFromSetting(
        "https://review.example.com/, https://review.example.com"
      )
    ).toEqual(["'self'", "https://review.example.com"]);
  });
  it.each([
    "*",
    "https://*.example.com",
    "http://review.example.com",
    "javascript:alert(1)",
    "https://user:password@example.com",
    "https://example.com/path",
    "https://example.com?x=1",
    "https://example.com#fragment",
    "https://example.com,",
    "https://example.com;object-src",
    "'none'; script-src *",
  ])("rejects unsafe framing configuration %s", setting => {
    expect(() => frameAncestorsFromSetting(setting)).toThrow(
      "SECURITY_FRAME_ANCESTORS"
    );
  });
});

describe("browser headers on real local HTTP responses", () => {
  let server: Server;
  let origin: string;
  const stripe = new Stripe("sk_test_header_unit");
  const secret = "whsec_header_unit";
  beforeAll(async () => {
    const app = express();
    configureSecurityHeaders(app, "");
    app.get("/", (_req, res) => res.type("html").send("<h1>BooGMe</h1>"));
    app.get("/sign-in", (_req, res) =>
      res.type("html").send("<form>Sign in</form>")
    );
    app.get("/oauth", (_req, res) => res.redirect("/sign-in"));
    app.post(
      "/api/webhooks/stripe",
      express.raw({ type: "application/json" }),
      (req, res) => {
        try {
          const event = stripe.webhooks.constructEvent(
            req.body,
            req.headers["stripe-signature"] as string,
            secret
          );
          res.json({ id: event.id, rawBody: Buffer.isBuffer(req.body) });
        } catch {
          res.status(400).json({ error: "Invalid signature" });
        }
      }
    );
    app.use((_req, res) => res.status(404).send("Not found"));
    server = await new Promise<Server>(resolve => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close(e => (e ? reject(e) : resolve()))
    );
  });

  it.each([
    ["/", 200],
    ["/sign-in", 200],
    ["/missing", 404],
    ["/oauth", 302],
  ])(
    "protects %s including redirects/errors without advertising Express",
    async (path, status) => {
      const response = await fetch(`${origin}${path}`, { redirect: "manual" });
      expect(response.status).toBe(status);
      expect(response.headers.get("x-powered-by")).toBeNull();
      expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
      expect(response.headers.get("content-security-policy")).toBe(
        "frame-ancestors 'self'; base-uri 'self'; object-src 'none'"
      );
      expect(response.headers.get("referrer-policy")).toBe(
        "strict-origin-when-cross-origin"
      );
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("permissions-policy")).toBe(
        "camera=(self), microphone=(self), geolocation=()"
      );
      expect(response.headers.get("strict-transport-security")).toBeNull(); // no local HTTP HSTS
    }
  );
  it("preserves exact-byte Stripe signature verification and raw request bodies", async () => {
    const payload =
      '{ "id": "evt_test_headers", "object": "event", "type": "account.updated", "data": {"object": {}} }';
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    const response = await fetch(`${origin}/api/webhooks/stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
      },
      body: payload,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "evt_test_headers",
      rawBody: true,
    });
    const rejected = await fetch(`${origin}/api/webhooks/stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
      },
      body: payload + " ",
    });
    expect(rejected.status).toBe(400);
    expect(rejected.headers.get("x-content-type-options")).toBe("nosniff");
  });
  it("does not add script, worker, iframe-source, payment or cross-origin isolation restrictions", async () => {
    const response = await fetch(origin);
    const csp = response.headers.get("content-security-policy")!;
    expect(csp).not.toMatch(
      /(?:default|script|worker|frame|connect|style)-src/
    );
    expect(response.headers.get("permissions-policy")).not.toContain(
      "payment="
    );
    expect(response.headers.get("cross-origin-opener-policy")).toBeNull();
    expect(response.headers.get("cross-origin-embedder-policy")).toBeNull();
  });
});

it("permits an explicitly approved preview parent without a contradictory legacy header", async () => {
  const app = express();
  configureSecurityHeaders(app, "https://preview-parent.example.com");
  app.get("/", (_req, res) => res.send("Preview"));
  const server = await new Promise<Server>(resolve => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  try {
    const response = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'self' https://preview-parent.example.com;"
    );
    expect(response.headers.get("x-frame-options")).toBeNull();
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
