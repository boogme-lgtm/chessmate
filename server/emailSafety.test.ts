import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml, escapeHtmlWithLineBreaks, sanitizeEmailSubject, truncateText } from "./emailSafety";

const { resendSend } = vi.hoisted(() => ({ resendSend: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class { emails = { send: resendSend }; },
}));

import { sendEmail as serviceEmail } from "./emailService";
import { sendEmail as authEmail } from "./email";

describe("HTML output encoding", () => {
  it("escapes every character that can open markup or leave an attribute", () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')">&`))
      .toBe("&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;");
  });
  it("treats null, undefined and numbers as text", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(2450)).toBe("2450");
  });
  it("keeps multi-line text readable without letting it inject markup", () => {
    expect(escapeHtmlWithLineBreaks("line <1>\r\nline 2\nline 3")).toBe("line &lt;1&gt;<br>line 2<br>line 3");
  });
  it("truncates raw text so an entity is never cut in half", () => {
    const shortened = escapeHtml(truncateText("<".repeat(250), 200, "…"));
    expect(shortened).toBe("&lt;".repeat(200) + "…");
    expect(truncateText("short", 200)).toBe("short");
  });
});

describe("email subjects", () => {
  it.each([
    ["New Coach Application: Eve\r\nBcc: victim@example.com", "New Coach Application: Eve Bcc: victim@example.com"],
    ["Line\nfeed", "Line feed"],
    ["Carriage\rreturn", "Carriage return"],
    ["Unicode\u2028line\u2029separators\u0085", "Unicode line separators"],
    ["Tab\tand\u0000null", "Tab and null"],
    ["  Plain subject — with “quotes” & ampersand  ", "Plain subject — with “quotes” & ampersand"],
  ])("collapses %j to one header line", (subject, expected) => {
    expect(sanitizeEmailSubject(subject)).toBe(expected);
  });

  describe("at every sender", () => {
    const fetchMock = vi.fn();
    beforeEach(() => {
      resendSend.mockReset().mockResolvedValue({ data: { id: "unit" }, error: null });
      fetchMock.mockReset().mockResolvedValue(new Response("{}"));
      vi.stubGlobal("fetch", fetchMock);
      vi.spyOn(console, "log").mockImplementation(() => {});
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it("strips line breaks before the transactional service hands the subject to Resend", async () => {
      await serviceEmail({ to: "admin@example.com", subject: "Hi\r\nBcc: victim@example.com", html: "<p>x</p>" });
      expect(resendSend).toHaveBeenCalledWith(expect.objectContaining({ subject: "Hi Bcc: victim@example.com", html: "<p>x</p>" }));
    });
    it("strips line breaks before the account-email sender posts to Resend", async () => {
      await authEmail({ to: "user@example.com", subject: "Verify\nBcc: victim@example.com", html: "<p>x</p>" });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).subject).toBe("Verify Bcc: victim@example.com");
    });
  });
});
