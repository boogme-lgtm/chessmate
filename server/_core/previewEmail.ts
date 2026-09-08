import { ENV } from "./env";

type CapturedEmail = { to: string; subject: string; html: string };

/** Mailpit receives the message locally; no Resend/SMTP delivery is attempted. */
export async function capturePreviewEmail(message: CapturedEmail): Promise<string> {
  if (!ENV.preview) throw new Error("Preview email capture is unavailable outside preview");
  try {
    const response = await fetch(`${ENV.preview.mailOrigin}/api/v1/send`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: "preview@boogme.invalid", Name: "BooGMe Preview" },
        To: [{ Email: message.to }],
        Subject: message.subject,
        HTML: message.html,
      }),
    });
    if (!response.ok) throw new Error("Capture inbox rejected the message");
    const data = await response.json();
    if (typeof data.ID !== "string" || !data.ID) throw new Error("Missing capture receipt");
    // Password/reset links belong in the private inbox, never in server logs.
    return data.ID;
  } catch {
    throw new Error("Preview capture inbox is unavailable; no external email was sent");
  }
}
