import { describe, it, expect } from 'vitest';
import { ENV } from './_core/env';

describe('Email Service Configuration', () => {
  it('should have RESEND_API_KEY configured', () => {
    expect(ENV.resendApiKey).toBeDefined();
    expect(ENV.resendApiKey).not.toBe('');
    expect(ENV.resendApiKey).toMatch(/^re_/); // Resend API keys start with "re_"
  });
});
