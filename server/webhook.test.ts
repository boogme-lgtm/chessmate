/**
 * Tests for Stripe webhook endpoint
 */

import { describe, it, expect } from 'vitest';

describe('Stripe Webhook Endpoint', () => {
  it('should have webhook endpoint registered at /api/stripe/webhook', async () => {
    const response = await fetch('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ test: 'data' })
    });
    
    // Should return 400 (no signature) rather than 404 (not found)
    // This confirms the endpoint exists
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.error).toBe('No signature');
  });

  it('should reject requests without Stripe signature', async () => {
    const response = await fetch('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'checkout.session.completed',
        data: { object: {} }
      })
    });
    
    expect(response.status).toBe(400);
  });
});
