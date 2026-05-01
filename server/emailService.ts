import { Resend } from 'resend';
import { ENV } from './_core/env';

// Initialize Resend client
const resend = new Resend(ENV.resendApiKey);

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: EmailOptions) {
  try {
    const { data, error } = await resend.emails.send({
      from: options.from || 'BooGMe <noreply@contact.boogme.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.error('[Email Service] Failed to send email:', error);
      return { success: false, error };
    }

    console.log('[Email Service] Email sent successfully:', data?.id);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error('[Email Service] Exception sending email:', error);
    return { success: false, error };
  }
}

/**
 * Email Templates
 */

export function getWaitlistConfirmationEmail(name: string, userType: 'student' | 'coach', email: string): string {
  const isCoach = userType === 'coach';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BooGMe</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" style="height: 48px; width: auto; margin-bottom: 20px;" />
              <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">
                Welcome to BooGMe
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Hi ${name},
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Thanks for joining the BooGMe waitlist! You're officially in.
              </p>
              
              <div style="background-color: #2a2a2a; border-left: 3px solid: #8b4513; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <h2 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
                  What is BooGMe?
                </h2>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  ${isCoach 
                    ? 'The first chess coaching marketplace with AI-powered student matching and payment protection. Build your coaching business with minimal fees and zero payment risk.'
                    : 'The first chess coaching marketplace with AI-powered matching and payment protection. No upfront fees, no risk—pay only after your lesson.'
                  }
                </p>
              </div>
              
              <h3 style="margin: 30px 0 15px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
                What happens next?
              </h3>
              
              <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #e0e0e0;">
                <li style="margin-bottom: 10px; font-size: 15px; line-height: 1.6;">
                  We're launching soon
                </li>
                <li style="margin-bottom: 10px; font-size: 15px; line-height: 1.6;">
                  You'll get early access before the public
                </li>
                <li style="margin-bottom: 10px; font-size: 15px; line-height: 1.6;">
                  I'll share behind-the-scenes updates as we build
                </li>
              </ul>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                In the meantime, I'll send you a few emails about how BooGMe works, why I built it, and how it's different from every other coaching platform.
              </p>
              
              <p style="margin: 30px 0 10px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Talk soon,
              </p>
              
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                <strong>Coach Cristian</strong><br>
                <span style="font-size: 14px; color: #a0a0a0;">
                  Founder, BooGMe | Head Coach, Mizzou Chess | Second to Fabiano Caruana
                </span>
              </p>
              
              ${!isCoach ? `
              <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #2a2a2a;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a0a0a0;">
                  <strong>P.S.</strong> - Know a chess coach who'd be perfect for BooGMe? Forward this email—we're hand-selecting our founding coaches.
                </p>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0f0f0f; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #808080;">
                BooGMe - AI-Powered Chess Coaching Marketplace
              </p>
              <p style="margin: 0; font-size: 12px; color: #606060;">
                You're receiving this because you joined our waitlist.
              </p>
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #505050;">
                <a href="${process.env.VITE_FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #808080; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function getNurtureEmail1(name: string, email: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Why I'm building BooGMe</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 30px 0; font-size: 28px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">
                Why I'm building BooGMe<br>(and why it matters)
              </h1>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Hi ${name},
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                I'm Coach Cristian—grandmaster, head coach at Mizzou Chess, and second to Fabiano Caruana.
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                For the past decade, I've coached hundreds of students. And I kept seeing the same problem:
              </p>
              
              <div style="background-color: #2a2a2a; padding: 20px; margin: 30px 0; border-radius: 4px; border-left: 3px solid #8b4513;">
                <p style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; text-align: center;">
                  Finding the right coach is broken.
                </p>
              </div>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Students waste money on mismatched coaches. Coaches spend hours on admin instead of teaching. Platforms take 30-50% cuts and offer zero protection.
              </p>
              
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                So I built BooGMe.
              </p>
              
              <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                Here's what makes us different:
              </h2>
              
              <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  1. AI Matching
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  20-question assessment finds your ideal coach based on learning style, goals, and personality (not just rating)
                </p>
              </div>
              
              <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  2. Payment Protection
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  Money held in escrow until your lesson is complete. No upfront risk.
                </p>
              </div>
              
              <div style="margin-bottom: 30px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  3. Minimal Fees
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  Coaches keep more of their earnings. Students pay fair prices.
                </p>
              </div>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                This isn't just another marketplace. It's the coaching platform I wish existed when I started.
              </p>
              
              <div style="background-color: #2a2a2a; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  Want to see how the AI matching works?
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  I'll walk you through it in my next email (coming in 5 days).
                </p>
              </div>
              
              <p style="margin: 30px 0 10px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Best,
              </p>
              
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                <strong>Coach Cristian</strong>
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 30px 40px; background-color: #0f0f0f; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #808080;">
                BooGMe - AI-Powered Chess Coaching Marketplace
              </p>
              <p style="margin: 0; font-size: 12px; color: #606060;">
                You're receiving this because you joined our waitlist.
              </p>
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #505050;">
                <a href="${process.env.VITE_FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #808080; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Additional email templates would go here (nurture emails 2-5)
// For brevity, I'm showing the pattern - you can expand these similarly

export function getNurtureEmail2(name: string, email: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>How AI Matching Works</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 30px 0; font-size: 28px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">
                How the AI Matching Works<br>(and why it matters)
              </h1>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Hi ${name},
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Most platforms match you with a coach based on one thing: rating.
              </p>
              
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                That's like choosing a doctor based only on their medical school ranking. It completely ignores fit.
              </p>
              
              <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                Here's what BooGMe does differently:
              </h2>
              
              <div style="background-color: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  20-Question Assessment
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  We ask about your chess journey, learning style, goals, schedule, and personality. Not just your rating.
                </p>
              </div>
              
              <div style="background-color: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  AI Analysis
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  Our system analyzes your answers against every coach's teaching style, specializations, and approach.
                </p>
              </div>
              
              <div style="background-color: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  Personalized Matches
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  You get 3-5 coaches ranked by compatibility—not just availability or price.
                </p>
              </div>
              
              <p style="margin: 30px 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                <strong>Example:</strong> If you're a visual learner who struggles with openings and prefers evening lessons, we'll match you with coaches who excel at visual teaching, specialize in openings, and have evening availability.
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                It's not magic. It's just better matching.
              </p>
              
              <div style="background-color: #2a2a2a; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  Next email: Payment Protection
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  I'll explain how our escrow system protects your money (coming in 5 days).
                </p>
              </div>
              
              <p style="margin: 30px 0 10px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Best,
              </p>
              
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                <strong>Coach Cristian</strong>
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 30px 40px; background-color: #0f0f0f; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #808080;">
                BooGMe - AI-Powered Chess Coaching Marketplace
              </p>
              <p style="margin: 0; font-size: 12px; color: #606060;">
                You're receiving this because you joined our waitlist.
              </p>
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #505050;">
                <a href="${process.env.VITE_FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #808080; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function getNurtureEmail3(name: string, email: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Protection Explained</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 30px 0; font-size: 28px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">
                How Payment Protection Works<br>(and why you need it)
              </h1>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Hi ${name},
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Here's a problem nobody talks about: <strong>prepaid lessons with no recourse.</strong>
              </p>
              
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                You pay upfront. Coach no-shows or delivers a terrible lesson. You're stuck.
              </p>
              
              <div style="background-color: #2a2a2a; border-left: 3px solid #8b4513; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; text-align: center;">
                  BooGMe holds your money in escrow until after your lesson.
                </p>
              </div>
              
              <h2 style="margin: 30px 0 20px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                Here's how it works:
              </h2>
              
              <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  1. You book a lesson
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  Your payment is held securely (not sent to the coach yet).
                </p>
              </div>
              
              <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  2. Lesson happens
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  You and your coach meet. Lesson completes.
                </p>
              </div>
              
              <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  3. 48-hour window
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  If there's an issue, you can dispute within 48 hours. We review and resolve.
                </p>
              </div>
              
              <div style="margin-bottom: 30px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  4. Coach gets paid
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  After 48 hours (or dispute resolution), funds are released to the coach.
                </p>
              </div>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                <strong>No upfront risk. No payment disputes. No awkward conversations.</strong>
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                This protects both students and coaches. It's how marketplaces should work.
              </p>
              
              <div style="background-color: #2a2a2a; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  Next email: Pricing & Fees
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  I'll break down exactly what you pay (and what coaches keep). Coming in 7 days.
                </p>
              </div>
              
              <p style="margin: 30px 0 10px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Best,
              </p>
              
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                <strong>Coach Cristian</strong>
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 30px 40px; background-color: #0f0f0f; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #808080;">
                BooGMe - AI-Powered Chess Coaching Marketplace
              </p>
              <p style="margin: 0; font-size: 12px; color: #606060;">
                You're receiving this because you joined our waitlist.
              </p>
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #505050;">
                <a href="${process.env.VITE_FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #808080; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function getNurtureEmail4(name: string, email: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transparent Pricing</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 30px 0; font-size: 28px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">
                Transparent Pricing<br>(no hidden fees)
              </h1>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Hi ${name},
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Let's talk money. Because transparency matters.
              </p>
              
              <h2 style="margin: 30px 0 20px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                How BooGMe pricing works:
              </h2>
              
              <div style="background-color: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  For Students
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  You pay the coach's hourly rate. That's it. No booking fees, no hidden charges, no surprises.
                </p>
              </div>
              
              <div style="background-color: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  For Coaches
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  We take a small commission from each lesson. Coaches keep more of their earnings compared to other platforms.
                </p>
              </div>
              
              <div style="background-color: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  Payment Processing
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  Standard payment processing fees apply (handled by Stripe). This is unavoidable for any platform.
                </p>
              </div>
              
              <p style="margin: 30px 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                <strong>Why minimal fees matter:</strong>
              </p>
              
              <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #e0e0e0;">
                <li style="margin-bottom: 10px; font-size: 15px; line-height: 1.6;">
                  Students get fair prices (coaches don't inflate rates to cover platform fees)
                </li>
                <li style="margin-bottom: 10px; font-size: 15px; line-height: 1.6;">
                  Coaches earn more per lesson (sustainable coaching business)
                </li>
                <li style="margin-bottom: 10px; font-size: 15px; line-height: 1.6;">
                  Everyone wins (better matches + fair economics = long-term relationships)
                </li>
              </ul>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                No fine print. No gotchas. Just honest pricing.
              </p>
              
              <div style="background-color: #2a2a2a; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  Final email: Launch Timeline
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  I'll share when we're launching and how to get early access. Coming in 8 days.
                </p>
              </div>
              
              <p style="margin: 30px 0 10px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Best,
              </p>
              
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                <strong>Coach Cristian</strong>
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 30px 40px; background-color: #0f0f0f; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #808080;">
                BooGMe - AI-Powered Chess Coaching Marketplace
              </p>
              <p style="margin: 0; font-size: 12px; color: #606060;">
                You're receiving this because you joined our waitlist.
              </p>
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #505050;">
                <a href="${process.env.VITE_FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #808080; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function getNurtureEmail5(name: string, email: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We're Launching Soon</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 30px 0; font-size: 28px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">
                We're Launching Soon<br>(here's what happens next)
              </h1>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Hi ${name},
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Over the past month, I've shared why BooGMe exists, how it works, and what makes it different.
              </p>
              
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Now it's time to launch.
              </p>
              
              <div style="background-color: #2a2a2a; border-left: 3px solid #8b4513; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0 0 15px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                  You're on the waitlist. Here's what that means:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #e0e0e0;">
                  <li style="margin-bottom: 10px; font-size: 15px; line-height: 1.6;">
                    Early access before the public launch
                  </li>
                  <li style="margin-bottom: 10px; font-size: 15px; line-height: 1.6;">
                    First pick of our founding coaches
                  </li>
                  <li style="margin-bottom: 10px; font-size: 15px; line-height: 1.6;">
                    Direct line to me for feedback and feature requests
                  </li>
                </ul>
              </div>
              
              <h2 style="margin: 30px 0 20px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                What to expect:
              </h2>
              
              <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  1. Launch Announcement
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  You'll get an email when we go live (likely within the next few weeks).
                </p>
              </div>
              
              <div style="margin-bottom: 20px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  2. Take the Assessment
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  Complete the 20-question assessment to get matched with coaches.
                </p>
              </div>
              
              <div style="margin-bottom: 30px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  3. Book Your First Lesson
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  Browse your matches, book a lesson, and experience the difference.
                </p>
              </div>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                I've spent the last year building this. It's not perfect, but it's better than what exists today.
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Thanks for being part of the journey.
              </p>
              
              <div style="background-color: #2a2a2a; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #ffffff;">
                  Questions? Reply to this email.
                </p>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  I read every message. Seriously.
                </p>
              </div>
              
              <p style="margin: 30px 0 10px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                See you on the other side,
              </p>
              
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                <strong>Coach Cristian</strong><br>
                <span style="font-size: 14px; color: #a0a0a0;">
                  Founder, BooGMe
                </span>
              </p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 30px 40px; background-color: #0f0f0f; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #808080;">
                BooGMe - AI-Powered Chess Coaching Marketplace
              </p>
              <p style="margin: 0; font-size: 12px; color: #606060;">
                You're receiving this because you joined our waitlist.
              </p>
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #505050;">
                <a href="${process.env.VITE_FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #808080; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}


/**
 * Booking Confirmation Email for Student
 */
export function getStudentBookingConfirmationEmail(
  studentName: string,
  coachName: string,
  lessonDate: string,
  lessonTime: string,
  duration: number,
  amount: string,
  lessonId: number
): string {
  const frontendUrl = process.env.VITE_FRONTEND_URL || 'http://localhost:3000';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lesson Booked Successfully</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" style="height: 48px; width: auto; margin-bottom: 20px;" />
              <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">
                ✓ Lesson Booked!
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Hi ${studentName},
              </p>
              
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Your chess lesson with <strong>${coachName}</strong> has been successfully booked!
              </p>
              
              <!-- Lesson Details Card -->
              <div style="background-color: #2a2a2a; padding: 25px; margin: 30px 0; border-radius: 8px; border-left: 4px solid #8b4513;">
                <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                  Lesson Details
                </h2>
                
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Coach:</td>
                    <td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${coachName}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Date:</td>
                    <td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${lessonDate}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Time:</td>
                    <td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${lessonTime}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Duration:</td>
                    <td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${duration} minutes</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0; border-top: 1px solid #3a3a3a; padding-top: 15px;">Amount Paid:</td>
                    <td style="font-size: 18px; color: #8b4513; font-weight: 700; padding: 8px 0; text-align: right; border-top: 1px solid #3a3a3a; padding-top: 15px;">${amount}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Payment Protection Notice -->
              <div style="background-color: #1f2937; padding: 20px; margin: 30px 0; border-radius: 6px; border: 1px solid #374151;">
                <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #10b981;">
                  🛡️ Payment Protection Active
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #d1d5db;">
                  Your payment has been collected and is held securely. Your coach will now review and confirm the booking. If the coach declines, you'll receive a full refund. After the lesson, you have 24 hours to raise any issues.
                </p>
              </div>
              
              <!-- Cancellation Policy -->
              <div style="background-color: #2a2a2a; padding: 20px; margin: 30px 0; border-radius: 6px;">
                <p style="margin: 0 0 15px 0; font-size: 15px; font-weight: 600; color: #ffffff;">
                  Cancellation Policy
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #e0e0e0; font-size: 14px; line-height: 1.8;">
                  <li>More than 48 hours before: <strong>Full refund</strong></li>
                  <li>24-48 hours before: <strong>50% refund</strong></li>
                  <li>Less than 24 hours: <strong>No refund</strong></li>
                </ul>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${frontendUrl}/lessons/${lessonId}" style="display: inline-block; padding: 14px 32px; background-color: #8b4513; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                  View Lesson Details
                </a>
              </div>
              
              <!-- Reminder Notice -->
              <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.6; color: #a0a0a0; text-align: center;">
                You'll receive a reminder email 24 hours before your lesson.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0f0f0f; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #808080;">
                BooGMe - AI-Powered Chess Coaching Marketplace
              </p>
              <p style="margin: 0; font-size: 12px; color: #606060;">
                Questions? Reply to this email or visit our <a href="${frontendUrl}/help" style="color: #8b4513; text-decoration: none;">Help Center</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Booking Notification Email for Coach
 */
export function getCoachBookingNotificationEmail(
  coachName: string,
  studentName: string,
  lessonDate: string,
  lessonTime: string,
  duration: number,
  coachPayout: string,
  lessonId: number
): string {
  const frontendUrl = process.env.VITE_FRONTEND_URL || 'http://localhost:3000';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lesson Booking</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" style="height: 48px; width: auto; margin-bottom: 20px;" />
              <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">
                🎓 New Lesson Booking!
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Hi ${coachName},
              </p>
              
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Great news! <strong>${studentName}</strong> has booked a lesson with you.
              </p>
              
              <!-- Lesson Details Card -->
              <div style="background-color: #2a2a2a; padding: 25px; margin: 30px 0; border-radius: 8px; border-left: 4px solid #8b4513;">
                <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                  Lesson Details
                </h2>
                
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Student:</td>
                    <td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${studentName}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Date:</td>
                    <td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${lessonDate}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Time:</td>
                    <td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${lessonTime}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Duration:</td>
                    <td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${duration} minutes</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0; border-top: 1px solid #3a3a3a; padding-top: 15px;">Your Payout:</td>
                    <td style="font-size: 18px; color: #10b981; font-weight: 700; padding: 8px 0; text-align: right; border-top: 1px solid #3a3a3a; padding-top: 15px;">${coachPayout}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Payment Protection Notice -->
              <div style="background-color: #1f2937; padding: 20px; margin: 30px 0; border-radius: 6px; border: 1px solid #374151;">
                <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #10b981;">
                  🛡️ Payment Collected
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #d1d5db;">
                  The student's payment has been collected and is held securely. Please accept or decline this booking in your dashboard. Your payout will be released after the lesson is completed and the review window closes.
                </p>
              </div>
              
              <!-- Next Steps -->
              <div style="background-color: #2a2a2a; padding: 20px; margin: 30px 0; border-radius: 6px;">
                <p style="margin: 0 0 15px 0; font-size: 15px; font-weight: 600; color: #ffffff;">
                  Next Steps
                </p>
                <ol style="margin: 0; padding-left: 20px; color: #e0e0e0; font-size: 14px; line-height: 1.8;">
                  <li>Accept or decline this booking in your coach dashboard</li>
                  <li>If accepted, prepare your lesson materials</li>
                  <li>You'll receive a reminder 24 hours before the lesson</li>
                  <li>After the lesson, the student confirms completion and your payout is released after 24 hours</li>
                </ol>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${frontendUrl}/lessons/${lessonId}" style="display: inline-block; padding: 14px 32px; background-color: #8b4513; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                  View Lesson Details
                </a>
              </div>
              
              <!-- Support -->
              <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.6; color: #a0a0a0; text-align: center;">
                Need to reschedule? Contact the student directly or reach out to our support team.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0f0f0f; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #808080;">
                BooGMe - AI-Powered Chess Coaching Marketplace
              </p>
              <p style="margin: 0; font-size: 12px; color: #606060;">
                Questions? Reply to this email or visit your <a href="${frontendUrl}/coach/dashboard" style="color: #8b4513; text-decoration: none;">Coach Dashboard</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}


/**
 * 24-Hour Lesson Reminder Email for Student
 */
export function getStudentLessonReminderEmail(
  studentName: string,
  coachName: string,
  lessonDate: string,
  lessonTime: string,
  duration: number,
  lessonId: number,
  cancelToken: string
): string {
  const frontendUrl = process.env.VITE_FRONTEND_URL || 'http://localhost:3000';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lesson Reminder - Tomorrow!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" style="height: 48px; width: auto; margin-bottom: 20px;" />
              <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">
                ⏰ Lesson Tomorrow!
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Hi ${studentName},
              </p>
              
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                This is a friendly reminder that your chess lesson with <strong>${coachName}</strong> is scheduled for tomorrow!
              </p>
              
              <!-- Lesson Details Card -->
              <div style="background-color: #2a2a2a; padding: 25px; margin: 30px 0; border-radius: 8px; border-left: 4px solid #8b4513;">
                <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                  Lesson Details
                </h2>
                
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Coach:</td>
                    <td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${coachName}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Date:</td>
                    <td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${lessonDate}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Time:</td>
                    <td style="font-size: 18px; color: #8b4513; font-weight: 700; padding: 8px 0; text-align: right;">${lessonTime}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Duration:</td>
                    <td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${duration} minutes</td>
                  </tr>
                </table>
              </div>
              
              <!-- Preparation Tips -->
              <div style="background-color: #1f2937; padding: 20px; margin: 30px 0; border-radius: 6px; border: 1px solid #374151;">
                <p style="margin: 0 0 15px 0; font-size: 15px; font-weight: 600; color: #ffffff;">
                  📝 Prepare for Your Lesson
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #d1d5db; font-size: 14px; line-height: 1.8;">
                  <li>Review your recent games or positions you'd like to discuss</li>
                  <li>Prepare any questions for your coach</li>
                  <li>Have a chess board or analysis tool ready</li>
                  <li>Join a few minutes early to test your connection</li>
                </ul>
              </div>
              
              <!-- CTA Buttons -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${frontendUrl}/lessons/${lessonId}" style="display: inline-block; padding: 14px 32px; background-color: #8b4513; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; margin-right: 10px;">
                  View Lesson Details
                </a>
              </div>
              
              <!-- Cancellation Warning -->
              <div style="background-color: #7f1d1d; padding: 20px; margin: 30px 0; border-radius: 6px; border: 1px solid #991b1b;">
                <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #fecaca;">
                  ⚠️ Last Chance to Cancel
                </p>
                <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.6; color: #fecaca;">
                  If you need to cancel, you must do so within the next 24 hours to avoid charges. Cancellations made less than 24 hours before the lesson are non-refundable.
                </p>
                <div style="text-align: center;">
                  <a href="${frontendUrl}/lessons/${lessonId}/cancel?token=${cancelToken}" style="display: inline-block; padding: 10px 24px; background-color: #991b1b; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 600;">
                    Cancel Lesson
                  </a>
                </div>
              </div>
              
              <!-- Support -->
              <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.6; color: #a0a0a0; text-align: center;">
                Looking forward to your lesson! If you have any questions, feel free to reach out.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0f0f0f; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #808080;">
                BooGMe - AI-Powered Chess Coaching Marketplace
              </p>
              <p style="margin: 0; font-size: 12px; color: #606060;">
                Questions? Reply to this email or visit our <a href="${frontendUrl}/help" style="color: #8b4513; text-decoration: none;">Help Center</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * 24-Hour Lesson Reminder Email for Coach
 */
export function getCoachLessonReminderEmail(
  coachName: string,
  studentName: string,
  lessonDate: string,
  lessonTime: string,
  duration: number,
  lessonId: number
): string {
  const frontendUrl = process.env.VITE_FRONTEND_URL || 'http://localhost:3000';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lesson Reminder - Tomorrow!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" style="height: 48px; width: auto; margin-bottom: 20px;" />
              <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">
                ⏰ Lesson Tomorrow!
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Hi ${coachName},
              </p>
              
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                This is a friendly reminder that you have a lesson with <strong>${studentName}</strong> scheduled for tomorrow!
              </p>
              
              <!-- Lesson Details Card -->
              <div style="background-color: #2a2a2a; padding: 25px; margin: 30px 0; border-radius: 8px; border-left: 4px solid #8b4513;">
                <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #ffffff;">
                  Lesson Details
                </h2>
                
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Student:</td>
                    <td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${studentName}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Date:</td>
                    <td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${lessonDate}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Time:</td>
                    <td style="font-size: 18px; color: #8b4513; font-weight: 700; padding: 8px 0; text-align: right;">${lessonTime}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Duration:</td>
                    <td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${duration} minutes</td>
                  </tr>
                </table>
              </div>
              
              <!-- Preparation Checklist -->
              <div style="background-color: #1f2937; padding: 20px; margin: 30px 0; border-radius: 6px; border: 1px solid #374151;">
                <p style="margin: 0 0 15px 0; font-size: 15px; font-weight: 600; color: #ffffff;">
                  📋 Preparation Checklist
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #d1d5db; font-size: 14px; line-height: 1.8;">
                  <li>Review the student's profile and learning goals</li>
                  <li>Prepare lesson materials and exercises</li>
                  <li>Test your video conferencing setup</li>
                  <li>Have analysis tools ready (engine, database, etc.)</li>
                </ul>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${frontendUrl}/lessons/${lessonId}" style="display: inline-block; padding: 14px 32px; background-color: #8b4513; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                  View Lesson Details
                </a>
              </div>
              
              <!-- Support -->
              <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.6; color: #a0a0a0; text-align: center;">
                Need to reschedule? Contact your student or our support team as soon as possible.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0f0f0f; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #808080;">
                BooGMe - AI-Powered Chess Coaching Marketplace
              </p>
              <p style="margin: 0; font-size: 12px; color: #606060;">
                Questions? Reply to this email or visit your <a href="${frontendUrl}/coach/dashboard" style="color: #8b4513; text-decoration: none;">Coach Dashboard</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Cancellation confirmation email — sent to the student after a lesson is cancelled.
 * Includes the refund breakdown based on cancellation timing.
 */
export function getStudentCancellationEmail(params: {
  studentName: string;
  coachName: string;
  lessonDate: string;
  lessonTime: string;
  durationMinutes: number;
  amountPaid: string;
  refundAmount: string;
  refundPercentage: number;
  cancelledBy: "student" | "coach" | "system";
  cancellationReason?: string | null;
}): string {
  const {
    studentName,
    coachName,
    lessonDate,
    lessonTime,
    durationMinutes,
    amountPaid,
    refundAmount,
    refundPercentage,
    cancelledBy,
    cancellationReason,
  } = params;

  const refundLine =
    refundPercentage === 100
      ? `You will receive a full refund of <strong>${refundAmount}</strong>.`
      : refundPercentage > 0
        ? `You will receive a ${refundPercentage}% refund of <strong>${refundAmount}</strong>.`
        : `No refund will be issued (cancellation was within 24 hours of the lesson).`;

  const cancelledByLine =
    cancelledBy === "coach"
      ? `Unfortunately your coach ${coachName} had to cancel this lesson. You will receive a full refund regardless of timing.`
      : cancelledBy === "system"
        ? `This lesson was automatically cancelled by BooGMe.`
        : `Your cancellation has been processed.`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lesson Cancelled</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" style="height: 48px; width: auto; margin-bottom: 20px;" />
              <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">Lesson Cancelled</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">Hi ${studentName},</p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">${cancelledByLine}</p>
              <div style="background-color: #2a2a2a; padding: 25px; margin: 30px 0; border-radius: 8px; border-left: 4px solid #8b4513;">
                <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #ffffff;">Lesson Details</h2>
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Coach:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${coachName}</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Date:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${lessonDate}</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Time:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${lessonTime}</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Duration:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${durationMinutes} minutes</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Amount Paid:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${amountPaid}</td></tr>
                </table>
              </div>
              <div style="background-color: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">${refundLine}</p>
                ${refundPercentage > 0 ? `<p style="margin: 10px 0 0 0; font-size: 13px; color: #a0a0a0;">Refunds typically appear in your account within 5\u201310 business days.</p>` : ""}
              </div>
              ${cancellationReason ? `<p style="margin: 20px 0 0 0; font-size: 14px; color: #a0a0a0;"><em>Reason: ${cancellationReason}</em></p>` : ""}
              <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.6; color: #a0a0a0;">Questions? Reply to this email and we'll help.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Cancellation notification email — sent to the coach when a lesson is cancelled.
 */
export function getCoachCancellationEmail(params: {
  coachName: string;
  studentName: string;
  lessonDate: string;
  lessonTime: string;
  durationMinutes: number;
  cancelledBy: "student" | "coach" | "system";
  cancellationReason?: string | null;
}): string {
  const {
    coachName,
    studentName,
    lessonDate,
    lessonTime,
    durationMinutes,
    cancelledBy,
    cancellationReason,
  } = params;

  const cancelledByLine =
    cancelledBy === "student"
      ? `${studentName} has cancelled their upcoming lesson with you.`
      : cancelledBy === "coach"
        ? `You have cancelled this lesson. A confirmation has also been sent to ${studentName}.`
        : `This lesson was automatically cancelled by BooGMe.`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lesson Cancelled</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" style="height: 48px; width: auto; margin-bottom: 20px;" />
              <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">Lesson Cancelled</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">Hi ${coachName},</p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">${cancelledByLine}</p>
              <div style="background-color: #2a2a2a; padding: 25px; margin: 30px 0; border-radius: 8px; border-left: 4px solid #8b4513;">
                <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #ffffff;">Lesson Details</h2>
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Student:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${studentName}</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Date:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${lessonDate}</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Time:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${lessonTime}</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Duration:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${durationMinutes} minutes</td></tr>
                </table>
              </div>
              ${cancellationReason ? `<p style="margin: 20px 0 0 0; font-size: 14px; color: #a0a0a0;"><em>Reason: ${cancellationReason}</em></p>` : ""}
              <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.6; color: #a0a0a0;">Your availability has been freed up. Students can now book this slot again.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Paid booking request — sent to the coach when a student pays for a lesson.
 * The coach must accept/decline within 24 hours or the system auto-declines.
 * In the payment-first model, the student has already paid at this point.
 */
export function getCoachNewBookingRequestEmail(params: {
  coachName: string;
  studentName: string;
  lessonDate: string;
  lessonTime: string;
  durationMinutes: number;
  coachPayout: string;
  confirmByDate: string;
  confirmByTime: string;
}): string {
  const {
    coachName,
    studentName,
    lessonDate,
    lessonTime,
    durationMinutes,
    coachPayout,
    confirmByDate,
    confirmByTime,
  } = params;
  const frontendUrl = process.env.VITE_FRONTEND_URL || 'http://localhost:3000';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lesson Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" style="height: 48px; width: auto; margin-bottom: 20px;" />
              <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">New Lesson Request</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">Hi ${coachName},</p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                ${studentName} has booked and paid for a lesson with you. Please accept or decline in your coach dashboard. If you decline, the student will receive a full refund.
              </p>
              <div style="background-color: #2a2a2a; padding: 25px; margin: 30px 0; border-radius: 8px; border-left: 4px solid #8b4513;">
                <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #ffffff;">Lesson Details</h2>
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Student:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${studentName}</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Date:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${lessonDate}</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Time:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${lessonTime}</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Duration:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${durationMinutes} minutes</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Your payout:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${coachPayout}</td></tr>
                </table>
              </div>
              <div style="background-color: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #b8860b;">
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #e0e0e0;">
                  <strong>Action required by ${confirmByDate} at ${confirmByTime}.</strong><br />
                  If you don't respond within 24 hours, the booking will be automatically declined and the student will be notified.
                </p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${frontendUrl}/coach/dashboard" style="display: inline-block; padding: 14px 32px; background-color: #8b4513; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Open Coach Dashboard</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Coach accepted the booking — sent to the student after coach confirms.
 * In the payment-first model, the student has already paid. This email
 * confirms the coach accepted and the lesson is locked in.
 */
export function getStudentCoachConfirmedEmail(params: {
  studentName: string;
  coachName: string;
  lessonDate: string;
  lessonTime: string;
  durationMinutes: number;
  amount: string;
  lessonId: number;
}): string {
  const {
    studentName,
    coachName,
    lessonDate,
    lessonTime,
    durationMinutes,
    amount,
    lessonId,
  } = params;
  const frontendUrl = process.env.VITE_FRONTEND_URL || 'http://localhost:3000';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lesson Confirmed!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663188415081/xRYfqyUGHSJUlDcu.png" alt="BooGMe" style="height: 48px; width: auto; margin-bottom: 20px;" />
              <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">Lesson Confirmed!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">Hi ${studentName},</p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                Great news — <strong>${coachName}</strong> has confirmed your lesson. Your booking is locked in and ready to go.
              </p>
              <div style="background-color: #2a2a2a; padding: 25px; margin: 30px 0; border-radius: 8px; border-left: 4px solid #8b4513;">
                <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #ffffff;">Lesson Details</h2>
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Coach:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${coachName}</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Date:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${lessonDate}</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Time:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${lessonTime}</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Duration:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${durationMinutes} minutes</td></tr>
                  <tr><td style="font-size: 15px; color: #a0a0a0; padding: 8px 0;">Total:</td><td style="font-size: 15px; color: #ffffff; font-weight: 600; padding: 8px 0; text-align: right;">${amount}</td></tr>
                </table>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${frontendUrl}/dashboard" style="display: inline-block; padding: 14px 32px; background-color: #8b4513; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">View Your Dashboard</a>
              </div>
              <div style="background-color: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a0a0a0;">
                  Your payment is held securely. After the lesson, you'll have 24 hours to raise any issues. If everything went well, the coach's payout will be released automatically.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
