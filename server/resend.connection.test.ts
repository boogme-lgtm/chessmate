import { describe, expect, it } from "vitest";

const runConnectionCheck = process.env.VALIDATE_RESEND_CONNECTION === "true";

describe.runIf(runConnectionCheck)("Resend production connection", () => {
  it("accepts the configured Sending access API key", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey).toMatch(/^re_/);

    // An empty email payload is deliberately invalid (422/400) but does not
    // send email. Authentication failures are 401/403.
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    expect([400, 422]).toContain(response.status);
  }, 20_000);
});
