# Direct Stripe webhook operations

This tool inspects BooGMe's sandbox webhook configuration and can request a narrowly reviewed replay without exporting a protected webhook signing secret. It talks to the project sandbox with an independently authorized API credential. It does not change application configuration or Stripe destinations.

## Verified recovery, September 8, 2026

The delivery incident is resolved. The current platform endpoint is **we_1UD6tGDWCgTDQAOtLzqwDtjx** (six events, Your account). The separate Connect endpoint is **we_1UD5OiDWCgTDQAOtFD4KDpyJ** (Connected accounts, account.updated only). Both target https://boogme.com/api/webhooks/stripe in the project sandbox.

Following Coach's secret correction and approved same-code production redeploy, a real platform delivery returned HTTP 200 with {"received":true} at 04:02:52 UTC. Manus correlated the event with the production handler's intentionally unhandled subscription path and verified the Connect diagnostic at 04:07:48 UTC. Checkpoint cb60245e has marker 7b2019f3; only generated version metadata and task tracking differ from d2579ea7. See the [incident closure and next steps](stripe-incident-2026-09-08.md) for evidence sources and remaining limits.

This script was not used for the successful resend. Coach used the Stripe Dashboard. No additional replay is needed to close this incident. For future diagnostics, the command below requires a locally installed official Stripe CLI; do not assume the Dashboard's browser Shell supports the same operations or flags.

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

This is the only write operation: a resend of that existing event to the pinned platform endpoint we_1UD6tGDWCgTDQAOtLzqwDtjx. It re-reads the account, endpoint and event immediately before invoking the official CLI. The CLI receives the same authorized API key through its environment, never through an argument. It cannot select live mode, change destinations, replay payment/account events, or create a subscription.

The CLI's acknowledgment means only that resend was requested. Success still requires matching Stripe delivery evidence and the receiving server's HTTP result and logs. For these ignored subscription events, expect HTTP 200 with {"received":true}; {"verified":true} is reserved for the app's special evt_test_ diagnostics. Neither pending_webhooks nor an integration toast proves that this destination accepted the request.

## Reconcile historical secret retirement separately

The prior rotation and estimated September 8, 2026, 17:58 UTC overlap deadline referred to **we_1TCAt6DWCgTDQAOtMWelR3Hs**. Manus reports that endpoint is no longer present in the sandbox inventory. Its deletion/retirement history and exact expiry are not independently verified here. That historical deadline must not be applied to the current endpoint or treated as a reason to roll the working secret again.

If a retirement follow-up is needed, first identify the exact endpoint and any still-active overlapping secrets through authorized read-only Stripe evidence. The latest verification did not test or retire an old secret. An old-only rejection test, positive current-secret delivery and authorized retirement are meaningful only when tied to the same relevant endpoint. Do not request an unavailable historical secret from protected tooling or expose secret values in chat.

If there is no safe existing event or no authorized API credential for a future check, report that concrete limit instead of reusing a stale local secret or claiming protected runtime values were inspected. The resolved delivery incident is separate from that historical configuration review.

## Tests

    node --test scripts/stripe-webhook-ops.test.mjs

The node tests mock Stripe and the CLI and make no network calls. The application suite separately verifies that allowlisted events cannot enter database/payment/email business handlers. The deployment is deliberately not changed by these tests.

References: [Stripe resend command](https://docs.stripe.com/cli/events/resend), [Stripe CLI implementation](https://github.com/stripe/stripe-cli/blob/master/pkg/cmd/resource/events_resend.go), [CLI API-key environment behavior](https://github.com/stripe/stripe-cli/blob/master/pkg/config/profile.go), [Stripe secret rotation](https://docs.stripe.com/webhooks#roll-endpoint-secrets).
