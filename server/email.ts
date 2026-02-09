import { ENV } from "./_core/env";

interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send email using Resend API
 */
export async function sendEmail(params: EmailParams): Promise<void> {
  if (!ENV.resendApiKey) {
    console.warn("[Email] Resend API key not configured, skipping email send");
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.resendApiKey}`,
      },
      body: JSON.stringify({
        from: "BooGMe <noreply@contact.boogme.com>",
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Email] Failed to send email:", error);
      throw new Error(`Failed to send email: ${response.statusText}`);
    }

    console.log(`[Email] Sent to ${params.to}: ${params.subject}`);
  } catch (error) {
    console.error("[Email] Error sending email:", error);
    throw error;
  }
}
