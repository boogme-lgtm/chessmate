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

export function getCoachWelcomeEmail(coachName: string): string {
  const dashboardUrl = `${ENV.frontendUrl || "https://boogme.com"}/coach/dashboard`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BooGMe, Coach!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" style="height: 48px; width: auto; margin-bottom: 20px;" />
              <h1 style="margin: 0; font-size: 28px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">
                Congratulations, Coach!
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Hi ${coachName},
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Your coach profile is now <strong>live</strong> on BooGMe! Students can find you, view your availability, and book lessons immediately.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 28px; background-color: #8b4513; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 500;">
                  Go to Your Dashboard
                </a>
              </div>
              <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                From your dashboard you can:
              </p>
              <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #e0e0e0;">
                <li style="margin-bottom: 8px; font-size: 15px; line-height: 1.6;">Update your availability and hourly rate</li>
                <li style="margin-bottom: 8px; font-size: 15px; line-height: 1.6;">Manage incoming lesson requests</li>
                <li style="margin-bottom: 8px; font-size: 15px; line-height: 1.6;">Track your earnings and payouts</li>
              </ul>
              <p style="margin: 30px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Welcome aboard,<br>
                <strong>The BooGMe Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #0f0f0f; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #808080;">
                BooGMe - AI-Powered Chess Coaching Marketplace
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
