// Test environment setup — provides safe dummy values for required env vars
// so that server modules can be imported in unit tests.

process.env.VITE_APP_ID ??= "test-app-id";
process.env.JWT_SECRET ??= "test-jwt-secret-at-least-32-chars-long";
process.env.DATABASE_URL ??= "mysql://test:test@localhost:3306/test";
process.env.OAUTH_SERVER_URL ??= "https://oauth.test.local";
process.env.VITE_FRONTEND_URL ??= "http://localhost:3000";
process.env.STRIPE_SECRET_KEY ??= "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_test_dummy";
process.env.VITE_STRIPE_PUBLISHABLE_KEY ??= "pk_test_dummy";
process.env.RESEND_API_KEY ??= "re_test_dummy";
