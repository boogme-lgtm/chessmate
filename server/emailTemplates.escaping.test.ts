/**
 * Every outbound email template escapes every user-influenced value.
 *
 * What is covered: every get*Email template exported by the two template
 * modules, emailService.ts and email.ts — the completeness check fails when one
 * is added without a hostile-input case here. The source check at the end
 * fails when email HTML is built anywhere else in server/ (inline in a router,
 * auth.ts, a scheduler...), so every email body has to come from a covered
 * template. Plain-text subjects are sanitized by the senders (emailSafety.test.ts).
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as emailService from "./emailService";
import * as email from "./email";

const EVIL = `<img src=x onerror="alert(1)">&co's`;
const ESCAPED = "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;co&#39;s";
const frontendUrl = "https://boogme.example";
const dueDate = new Date("2026-10-20T12:00:00Z");

const templates: Record<string, () => string> = {
  getWaitlistConfirmationEmail: () => emailService.getWaitlistConfirmationEmail(EVIL, "student", "a@example.com")
    + emailService.getWaitlistConfirmationEmail(EVIL, "coach", "a@example.com"),
  getNurtureEmail1: () => emailService.getNurtureEmail1(EVIL, "a@example.com"),
  getNurtureEmail2: () => emailService.getNurtureEmail2(EVIL, "a@example.com"),
  getNurtureEmail3: () => emailService.getNurtureEmail3(EVIL, "a@example.com"),
  getNurtureEmail4: () => emailService.getNurtureEmail4(EVIL, "a@example.com"),
  getNurtureEmail5: () => emailService.getNurtureEmail5(EVIL, "a@example.com"),
  getStudentBookingReservedEmail: () => emailService.getStudentBookingReservedEmail(EVIL, EVIL, EVIL, EVIL, 60, EVIL, 7),
  getStudentBookingConfirmationEmail: () => emailService.getStudentBookingConfirmationEmail(EVIL, EVIL, EVIL, EVIL, 60, EVIL, 7),
  getCoachBookingNotificationEmail: () => emailService.getCoachBookingNotificationEmail(EVIL, EVIL, EVIL, EVIL, 60, EVIL, 7),
  getStudentLessonReminderEmail: () => emailService.getStudentLessonReminderEmail(EVIL, EVIL, EVIL, EVIL, 60, 7, EVIL),
  getCoachLessonReminderEmail: () => emailService.getCoachLessonReminderEmail(EVIL, EVIL, EVIL, EVIL, 60, 7),
  getStudentCancellationEmail: () => (["student", "coach", "system"] as const).map(cancelledBy =>
    emailService.getStudentCancellationEmail({
      studentName: EVIL, coachName: EVIL, lessonDate: EVIL, lessonTime: EVIL, durationMinutes: 60,
      amountPaid: EVIL, refundAmount: EVIL, refundPercentage: 50, cancelledBy, cancellationReason: EVIL,
    })).join(""),
  getCoachCancellationEmail: () => (["student", "coach", "system"] as const).map(cancelledBy =>
    emailService.getCoachCancellationEmail({
      coachName: EVIL, studentName: EVIL, lessonDate: EVIL, lessonTime: EVIL, durationMinutes: 60,
      cancelledBy, cancellationReason: EVIL,
    })).join(""),
  getCoachNewBookingRequestEmail: () => emailService.getCoachNewBookingRequestEmail({
    coachName: EVIL, studentName: EVIL, lessonDate: EVIL, lessonTime: EVIL, durationMinutes: 60,
    coachPayout: EVIL, confirmByDate: EVIL, confirmByTime: EVIL,
  }),
  getStudentCoachConfirmedEmail: () => emailService.getStudentCoachConfirmedEmail({
    studentName: EVIL, coachName: EVIL, lessonDate: EVIL, lessonTime: EVIL, durationMinutes: 60, amount: EVIL, lessonId: 7,
  }),
  getStudentDisputeReceivedEmail: () => emailService.getStudentDisputeReceivedEmail({
    studentName: EVIL, coachName: EVIL, lessonId: 7, category: EVIL, description: EVIL, frontendUrl,
  }),
  getCoachDisputeFiledEmail: () => emailService.getCoachDisputeFiledEmail({
    coachName: EVIL, studentName: EVIL, lessonId: 7, category: EVIL, description: EVIL, frontendUrl,
  }),
  getStudentDisputeResolvedEmail: () => (["refund_full", "refund_partial", "denied"] as const).map(resolution =>
    emailService.getStudentDisputeResolvedEmail({
      studentName: EVIL, coachName: EVIL, lessonId: 7, disputeId: 3, resolution, refundAmountCents: 2500, adminNote: EVIL, frontendUrl,
    })).join(""),
  getCoachDisputeResolvedEmail: () => (["refund_full", "refund_partial", "denied"] as const).map(resolution =>
    emailService.getCoachDisputeResolvedEmail({
      coachName: EVIL, studentName: EVIL, lessonId: 7, disputeId: 3, resolution, refundAmountCents: 2500,
      lessonAmountCents: 5000, adminNote: EVIL, frontendUrl,
    })).join(""),
  getNewContentRequestEmail: () => emailService.getNewContentRequestEmail({
    coachName: EVIL, studentName: EVIL, requestTitle: EVIL, requestDescription: EVIL,
  }),
  getNewMessageEmail: () => emailService.getNewMessageEmail({ recipientName: EVIL, senderName: EVIL, messagePreview: EVIL }),
  getCoachDeadlineReminderEmail: () => emailService.getCoachDeadlineReminderEmail({
    coachName: EVIL, studentName: EVIL, requestTitle: EVIL, dueDate, hoursRemaining: 24,
  }),
  getStudentContentOverdueEmail: () => emailService.getStudentContentOverdueEmail({
    studentName: EVIL, coachName: EVIL, requestTitle: EVIL, dueDate,
  }),
  getNewSubscriberEmail: () => emailService.getNewSubscriberEmail({ coachName: EVIL, subscriberName: EVIL, monthlyPriceCents: 900 }),
  getStudentContentPurchaseReceiptEmail: () => emailService.getStudentContentPurchaseReceiptEmail({
    studentName: EVIL, itemTitle: EVIL, itemKind: EVIL, coachName: EVIL, amountPaidCents: 1999, purchaseDate: EVIL,
  }),
  getCoachApplicationAdminEmail: () => emailService.getCoachApplicationAdminEmail({
    fullName: EVIL, email: EVIL, chessTitle: EVIL, currentRating: 2300, vettingStatus: EVIL,
    confidenceScore: 72, reviewUrl: `${frontendUrl}/admin/applications`,
  }),
  getCoachApprovedEmail: () => emailService.getCoachApprovedEmail({ fullName: EVIL, setPasswordUrl: `${frontendUrl}/reset-password?token=abc` }),
  getAccountVerificationEmail: () => emailService.getAccountVerificationEmail({
    name: EVIL, verificationUrl: `${frontendUrl}/verify-email?token=abc`,
  }),
  getVerificationResendEmail: () => emailService.getVerificationResendEmail({
    name: EVIL, verificationUrl: `${frontendUrl}/verify-email?token=abc`,
  }),
  getAccountVerifiedEmail: () => emailService.getAccountVerifiedEmail({ name: EVIL, browseCoachesUrl: `${frontendUrl}/coaches` }),
  getPasswordResetEmail: () => emailService.getPasswordResetEmail({ name: EVIL, resetUrl: `${frontendUrl}/reset-password?token=abc` }),
  getAnnotatedGameEmail: () => emailService.getAnnotatedGameEmail({ senderName: EVIL, analysisTitle: EVIL }),
  getWaitlistBroadcastEmail: () => emailService.getWaitlistBroadcastEmail({
    subject: EVIL, message: `${EVIL}\nsecond line`, recipientName: EVIL, email: `o'brien+${EVIL}@example.com`,
  }),
  getOwnerNotificationEmail: () => emailService.getOwnerNotificationEmail({ content: EVIL }),
  // Not-yet-payable variant: renders the extra payout-setup copy as well.
  getCoachWelcomeEmail: () => email.getCoachWelcomeEmail(EVIL, { acceptingPayments: false }),
};

const templateModules = { emailService, email };

describe("email templates escape user-controlled values", () => {
  it("covers every exported template", () => {
    const exported = Object.values(templateModules)
      .flatMap(module => Object.keys(module).filter(name => /^get\w+Email\d*$/.test(name)))
      .sort();
    expect(Object.keys(templates).sort()).toEqual(exported);
  });

  it.each(Object.entries(templates))("%s renders hostile input only as text", (_name, render) => {
    const html = render();
    expect(html).toContain(ESCAPED);
    // (Templates legitimately contain the logo <img>; the payload's must not appear.)
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain(`onerror="`);
    // Escaped exactly once: never &amp;lt; / &amp;amp; / &amp;quot; / &amp;#39;
    expect(html).not.toMatch(/&amp;(lt|gt|amp|quot|#39);/);
  });

  it("keeps a broadcast's line breaks and a quoted address's unsubscribe link intact", () => {
    const html = emailService.getWaitlistBroadcastEmail({
      subject: "News", message: "line 1\nline 2", recipientName: "Ann", email: "o'brien+x@example.com",
    });
    expect(html).toContain("line 1<br>line 2");
    expect(html).toContain(`/unsubscribe?email=o&#39;brien%2Bx%40example.com"`);
  });

  it("escapes the payable coach welcome email exactly once", () => {
    const html = email.getCoachWelcomeEmail(EVIL, { acceptingPayments: true });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toMatch(/&amp;(lt|gt|amp|quot|#39);/);
  });

  it("encodes the reminder cancel token as a URL component", () => {
    const html = emailService.getStudentLessonReminderEmail("Ann", "Bob", "Monday", "5 PM", 60, 7, `x"><script>alert(1)</script>`);
    expect(html).toContain(`/lessons/7/cancel?token=x%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E"`);
    expect(html).not.toContain("<script");
  });

  it("truncates long user text before escaping it", () => {
    const html = emailService.getNewMessageEmail({ recipientName: "Ann", senderName: "Bob", messagePreview: "<".repeat(250) });
    expect(html).toContain(`"${"&lt;".repeat(200)}..."`);
    const dispute = emailService.getStudentDisputeReceivedEmail({
      studentName: "Ann", coachName: "Bob", lessonId: 7, category: "Coach No-Show", description: "&".repeat(250), frontendUrl,
    });
    expect(dispute).toContain(`${"&amp;".repeat(200)}…`);
    expect(dispute).not.toContain(`${"&amp;".repeat(201)}`);
  });

  it("keeps ordinary names readable", () => {
    const html = emailService.getNewSubscriberEmail({ coachName: "Zoë O'Brien", subscriberName: "Ann & Bob", monthlyPriceCents: 0 });
    expect(html).toContain("Hi Zoë O&#39;Brien,");
    expect(html).toContain("<strong>Ann &amp; Bob</strong>");
  });
});

describe("email HTML is built only in the template modules", () => {
  // Template literals mixing an HTML tag with an interpolation. LLM prompts,
  // SQL and log lines do not use these tags.
  const HTML_TAG = /<\/?(?:html|head|body|title|meta|table|tbody|thead|tr|td|th|div|span|p|a|h[1-6]|strong|em|b|i|u|br|hr|img|ul|ol|li|pre|code|blockquote|style)\b[^>]*>/i;
  const TEMPLATE_LITERAL = /`(?:\\[\s\S]|[^`\\])*`/g;
  const serverDir = fileURLToPath(new URL(".", import.meta.url));
  const templateFiles = new Set(["emailService.ts", "email.ts"]);

  function inlineHtml(source: string): number[] {
    const lines: number[] = [];
    for (const match of source.matchAll(TEMPLATE_LITERAL)) {
      if (match[0].includes("${") && HTML_TAG.test(match[0])) {
        lines.push(source.slice(0, match.index).split("\n").length);
      }
    }
    return lines;
  }

  it("finds inline email HTML when it is there", () => {
    expect(inlineHtml("const html = `<p>Hi ${name}</p>`;")).toEqual([1]);
    expect(inlineHtml("sendEmail({\n  html: `\n    <h1>Hello</h1><a href=\"${url}\">x</a>`,\n});")).toEqual([2]);
    expect(inlineHtml("const prompt = `Score: <number 0-25> for ${name}`;")).toEqual([]);
    expect(inlineHtml("const html = `<p>Static</p>`;")).toEqual([]);
  });

  it("leaves no email body outside emailService.ts and email.ts", () => {
    const offenders = readdirSync(serverDir, { recursive: true, encoding: "utf8" })
      .filter(file => file.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(file) && !templateFiles.has(file))
      .flatMap(file => inlineHtml(readFileSync(`${serverDir}/${file}`, "utf8")).map(line => `${file}:${line}`));
    // Move the body into a get*Email template (and add its case above).
    expect(offenders).toEqual([]);
  });
});
