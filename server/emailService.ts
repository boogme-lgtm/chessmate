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
      from: options.from || 'BooGMe <onboarding@resend.dev>',
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

export function getWaitlistConfirmationEmail(name: string, userType: 'student' | 'coach'): string {
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
              <h1 style="margin: 0; font-size: 32px; font-weight: 300; color: #ffffff; letter-spacing: -0.5px;">
                Welcome to BooGMe ♟️
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

export function getNurtureEmail1(name: string): string {
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

export function getNurtureEmail2(name: string): string {
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

export function getNurtureEmail3(name: string): string {
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

export function getNurtureEmail4(name: string): string {
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

export function getNurtureEmail5(name: string): string {
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
