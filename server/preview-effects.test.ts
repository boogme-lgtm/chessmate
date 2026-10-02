import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", async () => {
  const { previewEnvironment } = await import("../test/preview-fixture");
  const { loadPreviewConfig } = await import("./_core/previewPolicy");
  return { ENV: { preview: loadPreviewConfig(previewEnvironment()) } };
});
vi.mock("resend", () => ({ Resend: vi.fn(() => { throw new Error("External email must not initialize"); }) }));

import { sendEmail as authEmail } from "./email";
import { sendEmail as serviceEmail } from "./emailService";
import { notifyOwner } from "./_core/notification";
import { createStripeCustomer } from "./stripe";
import { createConnectAccount } from "./stripeConnect";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ ID: "captured-unit" })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("all outbound email paths in preview", () => {
  const message = { to: "student@example.com", subject: "Verify account", html: "<a href='http://localhost/token'>private link</a>" };
  it("captures authentication, product and owner emails locally without logging links", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await authEmail(message);
    expect(await serviceEmail(message)).toEqual({ success: true, id: "captured-unit" });
    expect(await notifyOwner({ title: "Coach application", content: "<private>" })).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [url, request] of fetchMock.mock.calls) {
      expect(url).toBe("http://127.0.0.1:8025/api/v1/send");
      expect(request.redirect).toBe("error");
    }
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).HTML).toBe(message.html);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).HTML).toContain("&lt;private&gt;");
    expect(log).not.toHaveBeenCalled();
  });
  it("fails closed when capture fails, with no fallback to Resend or Forge", async () => {
    fetchMock.mockRejectedValue(new Error("unavailable"));
    await expect(authEmail(message)).rejects.toThrow("no external email was sent");
    expect(await serviceEmail(message)).toMatchObject({ success: false });
    expect(await notifyOwner({ title: "Unit", content: "Unit" })).toBe(false);
    expect(fetchMock.mock.calls.every(([url]) => url === "http://127.0.0.1:8025/api/v1/send")).toBe(true);
  });
  it("requires an actual capture receipt", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));
    await expect(authEmail(message)).rejects.toThrow("capture inbox is unavailable");
  });
});

describe("preview payment boundary using the real Stripe SDK", () => {
  it("blocks both platform and Connect API clients without network requests", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createStripeCustomer("student@example.com")).rejects.toThrow();
    expect(await createConnectAccount({ email: "coach@example.com", firstName: "Test", lastName: "Coach" }))
      .toMatchObject({ success: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
