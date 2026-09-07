# Direct Stripe webhook operations

This tool helps finish BooGMe's platform-secret rotation without exporting a protected webhook signing secret. It talks to the project sandbox with an independently authorized API credential. It does not change application configuration or Stripe destinations.

## Inspect first

Supply BOOGME_STRIPE_OPS_KEY through an authorized secret manager, then run:

    node scripts/stripe-webhook-ops.mjs inspect

Do not extract a protected Manus key, place a key in command-line arguments, or put secrets in chat. Use an owner-provided test API credential. The inspection needs read access to the account, webhook endpoints and events. A read-only API credential is sufficient for inspection; resend additionally requires the appropriate Stripe permission.

The output is restricted to account ID, the two pinned endpoint configurations, and replay-candidate event IDs/types/times. It does not print signing secrets, API keys, customer records, event bodies or headers. Live keys and unexpected URLs/resources are refused. The v1 endpoint object does not expose the original connect creation flag; the tool explicitly does not pretend to re-verify that scope field.

The event search looks at up to 100 already-existing subscription events from the last 29 days and marks truncation. No candidates means this inspected page has no eligible event. It never fabricates a successful result or creates a paid fixture to fill the gap.

## Deliberately resend one reviewed candidate

The current server ignores customer.subscription.created, customer.subscription.updated and customer.subscription.deleted after signature verification. Tests link this allowlist to the real handler so introducing billing later breaks the assumption visibly.

Install the official Stripe CLI separately if this operation is needed. Use the account ID and an event ID from inspection:

    node scripts/stripe-webhook-ops.mjs replay \
      --event evt_REVIEWED \
      --expected-account acct_VERIFIED \
      --confirm-replay

This is the only write operation: a resend of that existing event to the pinned platform endpoint we_1TCAt6DWCgTDQAOtMWelR3Hs. It re-reads the account, endpoint and event immediately before invoking the official CLI. The CLI receives the same authorized API key through its environment, never through an argument. It cannot select live mode, change destinations, replay payment/account events, or create a subscription.

The CLI's acknowledgment means only that resend was requested. Success still requires matching Stripe delivery evidence and the receiving server's HTTP result and logs. For these ignored subscription events, expect HTTP 200 with {"received":true}; {"verified":true} is reserved for the app's special evt_test_ diagnostics. Neither pending_webhooks nor an integration toast proves that this destination accepted the request.

## Finish the existing rotation

1. Confirm the real platform delivery succeeded and the serving release/configuration is consistent across instances.
2. Confirm a fresh old-only diagnostic is rejected and the separate Connect diagnostic still succeeds.
3. Retire the old platform key under the existing authorization and confirm retirement in Stripe. Do not infer a secret-expiry timestamp from endpoint metadata.
4. Preserve the Connect secret/destination, platform event list and application code.

The old key's estimated automatic expiration is September 8, 2026, at 17:58 UTC. Its exact deadline remains unverified. If there is no safe existing event or no authorized API credential, the script cannot prove delivery; report that concrete limit instead of reusing the stale local secret or claiming that protected runtime values were inspected.

## Tests

    node --test scripts/stripe-webhook-ops.test.mjs

The node tests mock Stripe and the CLI and make no network calls. The application suite separately verifies that allowlisted events cannot enter database/payment/email business handlers. The deployment is deliberately not changed by these tests.

References: [Stripe resend command](https://docs.stripe.com/cli/events/resend), [Stripe CLI implementation](https://github.com/stripe/stripe-cli/blob/master/pkg/cmd/resource/events_resend.go), [CLI API-key environment behavior](https://github.com/stripe/stripe-cli/blob/master/pkg/config/profile.go), [Stripe secret rotation](https://docs.stripe.com/webhooks#roll-endpoint-secrets).
