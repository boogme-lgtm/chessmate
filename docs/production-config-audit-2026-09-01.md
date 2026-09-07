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

## Pre-change Stripe mapping and rollout plan

The configured Stripe account is the project-specific `Manus chessmate-xkyng35x` sandbox associated with `chessaesthetics@gmail.com`. Its active event destination posts test-mode events to the public production hostname `https://boogme.com/api/webhooks/stripe`. That destination reaches the deployed application route, which requires the raw request body and verifies the Stripe signature using `STRIPE_WEBHOOK_SECRET`. The project database identified by the managed project connection is `Xkyng35xnYFybYAdmyVo96`; sandbox events sent to the production hostname can therefore mutate this persistent project database. They do not target the ephemeral preview hostname.

Before any event is sent, the proposed destination change is limited to adding `account.updated` to the existing event list. The current application handler already consumes `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, and `account.updated`. The existing subscription events are not used by current application code and should remain unchanged in this scope.

The signing secret should be rolled because it appeared in a shared screenshot. Stripe's documented rollover supports keeping the prior and replacement secrets valid concurrently for up to 24 hours and sends one signature for each active secret during that period. BooGMe already uses Stripe's `webhooks.constructEvent` verifier, which accepts the signature matching the configured replacement secret when both signatures are present. The rollout therefore requires no overlap-specific application code: roll the secret with delayed expiration, replace `STRIPE_WEBHOOK_SECRET` in the deployed application with the replacement secret, verify a harmless test-mode event, then expire the previous secret in Stripe when successful or let the bounded overlap period end. The existing production and preview environments use different hostnames, but only the public deployment receives this destination; no preview endpoint or database receives Stripe events from this destination.

References: [Stripe webhook secret rollover](https://docs.stripe.com/webhooks#roll-endpoint-secrets).
