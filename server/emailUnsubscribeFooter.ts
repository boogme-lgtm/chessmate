/**
 * Generate unsubscribe footer HTML for emails
 */
export function getUnsubscribeFooter(email: string): string {
  const unsubscribeUrl = `${process.env.VITE_FRONTEND_URL || 'https://boogme.com'}/unsubscribe?email=${encodeURIComponent(email)}`;
  
  return `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">
        You're receiving this email because you signed up for the BooGMe waitlist.
      </p>
      <p style="margin: 0;">
        <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe from these emails</a>
      </p>
    </div>
  `;
}
