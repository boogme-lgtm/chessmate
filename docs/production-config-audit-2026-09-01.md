# Production Configuration Audit — 2026-09-01

## Initial findings

- `https://boogme.com` loads successfully over HTTPS and renders the BooGMe homepage.
- Production logs show the application server, reminder scheduler, and database-backed scheduler queries starting normally.
- Core secret presence check passed for `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, `VITE_FRONTEND_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, and `ADMIN_EMAIL`.
- Stripe account API authentication returned HTTP 200.
- The original Resend key rejected a read-only domains request. It was replaced with a least-privilege Sending access key, and a controlled invalid-payload request to Resend's email API authenticated successfully without sending mail.

## Public endpoint validation

Both `https://boogme.com` and `https://www.boogme.com` now resolve securely to the BooGMe homepage; the `www` hostname redirects to the canonical `https://boogme.com` URL. The production `/coaches` page also loads successfully and returns the currently active coach profiles. Public-domain routing and the database-backed coach query are therefore healthy.

## Stripe webhook finding

The Stripe sandbox includes one active Event Destination at `https://boogme.com/api/webhooks/stripe`, subscribed to six events. The application deliberately serves both this legacy-compatible URL and `https://boogme.com/api/stripe/webhook`; a signed request is therefore expected to succeed on the existing destination. An unsigned POST to the active destination returned HTTP 400, which confirms the production request reaches the webhook handler and signature validation is enforced. No second destination should be created. The remaining verification is a Stripe Dashboard test event, which will confirm the stored signing secret and subscribed event set.
