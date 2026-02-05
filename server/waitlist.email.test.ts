import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail, getWaitlistConfirmationEmail } from './emailService';

describe('Waitlist Email Integration', () => {
  describe('Email Template Generation', () => {
    it('should generate student waitlist confirmation email', () => {
      const html = getWaitlistConfirmationEmail('John Doe', 'student');
      
      expect(html).toContain('Welcome to BooGMe');
      expect(html).toContain('John Doe');
      expect(html).toContain('AI-powered matching');
      expect(html).toContain('payment protection');
      expect(html).not.toContain('Build your coaching business'); // Coach-specific content
    });

    it('should generate coach waitlist confirmation email', () => {
      const html = getWaitlistConfirmationEmail('Jane Smith', 'coach');
      
      expect(html).toContain('Welcome to BooGMe');
      expect(html).toContain('Jane Smith');
      expect(html).toContain('Build your coaching business');
      expect(html).toContain('minimal fees');
      expect(html).not.toContain('Know a chess coach'); // Student-specific content
    });

    it('should include Coach Cristian signature in all emails', () => {
      const studentEmail = getWaitlistConfirmationEmail('Test User', 'student');
      const coachEmail = getWaitlistConfirmationEmail('Test Coach', 'coach');
      
      expect(studentEmail).toContain('Coach Cristian');
      expect(studentEmail).toContain('Fabiano Caruana');
      expect(coachEmail).toContain('Coach Cristian');
      expect(coachEmail).toContain('Mizzou Chess');
    });
  });

  describe('Nurture Email Template', () => {
    it('should generate first nurture email with proper content', async () => {
      const { getNurtureEmail1 } = await import('./emailService');
      const html = getNurtureEmail1('Test User');
      
      expect(html).toContain('Why I\'m building BooGMe');
      expect(html).toContain('Test User');
      expect(html).toContain('AI Matching');
      expect(html).toContain('Payment Protection');
      expect(html).toContain('Minimal Fees');
    });
  });
});
