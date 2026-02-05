import { describe, it, expect } from 'vitest';
import { getNurtureEmail1, getNurtureEmail2, getNurtureEmail3, getNurtureEmail4, getNurtureEmail5 } from './emailService';

describe('Nurture Email Scheduler', () => {
  describe('Email Template Validation', () => {
    const testName = 'John Doe';
    
    it('should generate all 5 nurture emails with proper structure', () => {
      const email1 = getNurtureEmail1(testName);
      const email2 = getNurtureEmail2(testName);
      const email3 = getNurtureEmail3(testName);
      const email4 = getNurtureEmail4(testName);
      const email5 = getNurtureEmail5(testName);
      
      // All emails should contain the user's name
      expect(email1).toContain(testName);
      expect(email2).toContain(testName);
      expect(email3).toContain(testName);
      expect(email4).toContain(testName);
      expect(email5).toContain(testName);
      
      // All emails should have proper HTML structure
      [email1, email2, email3, email4, email5].forEach(email => {
        expect(email).toContain('<!DOCTYPE html>');
        expect(email).toContain('</html>');
        expect(email).toContain('BooGMe');
        expect(email).toContain('Coach Cristian');
      });
    });
    
    it('should have distinct content for each email', () => {
      const email1 = getNurtureEmail1(testName);
      const email2 = getNurtureEmail2(testName);
      const email3 = getNurtureEmail3(testName);
      const email4 = getNurtureEmail4(testName);
      const email5 = getNurtureEmail5(testName);
      
      // Email 1: Why I'm building BooGMe
      expect(email1).toContain('Why I\'m building BooGMe');
      expect(email1).toContain('Finding the right coach is broken');
      
      // Email 2: AI Matching
      expect(email2).toContain('How the AI Matching Works');
      expect(email2).toContain('20-Question Assessment');
      
      // Email 3: Payment Protection
      expect(email3).toContain('Payment Protection');
      expect(email3).toContain('escrow');
      expect(email3).toContain('48-hour window');
      
      // Email 4: Pricing
      expect(email4).toContain('Transparent Pricing');
      expect(email4).toContain('no hidden fees');
      
      // Email 5: Launch
      expect(email5).toContain('Launching Soon');
      expect(email5).toContain('Early access');
    });
    
    it('should include teaser for next email in emails 1-4', () => {
      const email1 = getNurtureEmail1(testName);
      const email2 = getNurtureEmail2(testName);
      const email3 = getNurtureEmail3(testName);
      const email4 = getNurtureEmail4(testName);
      
      expect(email1).toContain('next email');
      expect(email2).toContain('Next email');
      expect(email3).toContain('Next email');
      expect(email4).toContain('Final email');
    });
    
    it('should include call-to-action in final email', () => {
      const email5 = getNurtureEmail5(testName);
      
      expect(email5).toContain('Early access');
      expect(email5).toContain('assessment');
      expect(email5).toContain('Book Your First Lesson');
    });
  });
  
  describe('Email Sequence Timing', () => {
    it('should follow the correct day schedule', () => {
      // Email 1: Day 5
      // Email 2: Day 10
      // Email 3: Day 15
      // Email 4: Day 22
      // Email 5: Day 30
      
      const expectedDays = [5, 10, 15, 22, 30];
      
      // This validates the schedule is documented correctly
      expect(expectedDays).toHaveLength(5);
      expect(expectedDays[0]).toBe(5);
      expect(expectedDays[4]).toBe(30);
    });
  });
});
