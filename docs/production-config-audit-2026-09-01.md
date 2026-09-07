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

## Connect webhook preview preparation

Astra's Connect webhook repair from commit `52a76e748b10a7360993b94fdc0c6d2ae61af273` was integrated into the preview as local cherry-pick `f9d35ffc2ce88e671ac6705e1cc08c5caa642d2a`. The patch adds the server-only `STRIPE_CONNECT_WEBHOOK_SECRET`, independently verifies platform versus Connect signatures, prevents Connect-signed events from entering platform payment handlers, validates that `event.account` matches the account payload before database access, and returns a retryable non-success response for database failures.

Validation used synthetic local secrets with provider effects disabled: TypeScript passed; the focused Connect suite passed 22/22; the isolated full suite passed 728 tests with one opt-in Resend connectivity test skipped; and the production build passed. The direct managed preview URL rendered normally after restart. No Stripe destination, Stripe secret, live-mode credential, or production publication was changed.

## Disabled sandbox Connect destination staging

After confirming that the deployed `https://boogme.com/api/webhooks/stripe` endpoint rejects unsigned requests with HTTP 400 before application processing, and confirming that no Connect signing secret was configured, a separate sandbox Connected accounts endpoint was created using the existing project sandbox account. Stripe created the endpoint at `2026-09-07T16:27:56Z`; it was disabled immediately after creation and independently retrieved with status `disabled` at `2026-09-07T16:28:06Z`.

The endpoint is scoped to Connected accounts, targets the existing BooGMe webhook URL, and subscribes only to `account.updated`. The existing platform endpoint and its signing secret were not changed. The new signing secret was stored as `STRIPE_CONNECT_WEBHOOK_SECRET` through the project secret mechanism and validated locally using a signed `evt_test_` diagnostic that returns before database access. No secret value is recorded here.

For reconciliation, the sandbox event list contained no Stripe event records in the ten-second active creation-to-disable window. Stripe’s connector does not expose webhook-delivery logs for this endpoint type; the endpoint is now disabled, and no test event was sent through Stripe. No application publication or live-mode configuration occurred.
