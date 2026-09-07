# BooGMe Connect webhook: Manus handoff

Prepared September 7, 2026.

## Decision and direct answers

Manus's addendum is correct. The current Your account destination must keep receiving platform payments. Coach v1 account.updated events need a separate Connected accounts destination. Sharing the HTTP URL does not mean sharing a signing secret. [Stripe Connect reference](https://docs.stripe.com/connect/webhooks), [Stripe signature reference](https://docs.stripe.com/webhooks#verify-signature).

The previous handleAccountUpdated implementation looked up the coach using event.data.object.id. That identifies the correct account for a normal account.updated event, but the code did not validate the top-level event.account value. The old verifier accepted only STRIPE_WEBHOOK_SECRET, so it could not verify a second destination's signature.

This patch adds the missing support. It does not configure Stripe or publish a website.

## Code to synchronize

- Repository: boogme-lgtm/chessmate
- Branch: astra/stripe-connect-webhooks-1
- Base: 17b2f198463e90cf29235329ad6702b69455c2d7
- Use and report the exact commit at this branch's head.
- No database migration or dependency update.

| Destination | Event source | Events in this scope | Signing-secret variable |
| --- | --- | --- | --- |
| Existing sandbox platform destination | Your account | Existing event list remains intact | STRIPE_WEBHOOK_SECRET |
| New sandbox coach destination | Connected accounts | account.updated only | STRIPE_CONNECT_WEBHOOK_SECRET |

Both destinations can ultimately target https://boogme.com/api/webhooks/stripe. Both supported HTTP route aliases already invoke the same handler. The deployed application must first contain this patch and have both secrets configured.

STRIPE_CONNECT_WEBHOOK_SECRET is a new, server-only application secret. Store the new Connect destination's signing secret under that name using Manus's secret mechanism. Keep the integration-managed Test STRIPE_WEBHOOK_SECRET for the existing platform destination. Do not replace it with the Connect secret or create a duplicate override. The two values must be distinct.

Leaving the Connect variable unset preserves platform payment handling and rejects Connect signatures until configured. Account events signed only by the platform secret cannot update coaches. Connect-signed events never enter platform checkout or payment handlers. Valid account.updated events must have event.account equal to event.data.object.id before any database access.

The existing readiness rule is retained: a coach becomes onboarded when both charges_enabled and payouts_enabled are true. Disabling previously enabled capabilities remains a separate audit repair. Database lookup/write failures now return a non-success response so Stripe can retry the update. An unknown account or already-onboarded coach is acknowledged without a write.

## Preview task now

1. Synchronize this exact patch into the existing preview, preserving newer work. Report any additional diff.
2. Run the focused test server/stripe-connect-webhook.test.ts, TypeScript, the build, and the existing suite in an environment with external effects disabled. This new test uses real Stripe signature generation/verification with synthetic local secrets; provider and database operations are mocked.
3. Confirm how a separate server-only STRIPE_CONNECT_WEBHOOK_SECRET is configured in Manus and how changes reach each running environment. ENV values are read at process startup, so a stored value alone is not proof that the running server uses it.
4. Return the preview URL, exact commit, test results, and the concrete deployment/activation steps for review. The current user instruction keeps production publication on hold. Do not activate a Connect destination aimed at boogme.com while it is still running the old single-secret verifier.

## Activation sequence after production publication is authorized

1. Keep the existing platform destination's URL, event scope, and event list unchanged. Any approved rotation of its exposed signing secret is an independent operation using the platform variable, not the new Connect variable.
2. Arrange the new Connected accounts destination with account.updated only and a separate signing secret. Keep delivery disabled or paused while preparing, where Stripe supports that workflow. If creation cannot be staged without immediate delivery, report the required coordinated cutover before proceeding.
3. Store STRIPE_CONNECT_WEBHOOK_SECRET securely, deploy the reviewed code to the endpoint's actual application, and verify the running process received the configuration. Account for any other pending changes in the deployment; this branch includes the earlier access-control repair in its base.
4. Enable the new destination only when that receiver is ready. Verify signatures with a deliberately harmless event whose exact path cannot modify persistent project records or send email. Report signature verification separately from coach-onboarding behavior.
5. Verify real coach-onboarding updates later using an isolated synthetic database/account setup. The current managed project database is persistent; sandbox Stripe mode does not make database writes disposable.
6. Return destination IDs, scopes, event lists, deployed commit, delivery IDs/results, and confirmation that existing platform events still verify. Never include signing-secret values.

For a rollback, disable the new Connect destination first. Preserve the platform secret and existing payment destination. Do not revert earlier security fixes as part of this configuration rollback.

## Validation and limits

Completed locally: TypeScript passed, the production build passed, and the full isolated suite passed 728 tests with 0 failures. One opt-in Resend connection test was skipped, as intended. The 22 new focused tests also passed independently. No live integrations or database were exercised.

The patch includes 22 focused cases covering both signatures, platform compatibility with Connect configured/unset, tampered/stale/unsigned requests, unconfigured or duplicate secrets, account identity, cross-scope payment isolation, safe diagnostic acknowledgment, unknown accounts, repeat delivery, incomplete onboarding, and retryable database failures.

The new tests do not call Stripe, Resend, or a real database. Their passing results do not establish live destination delivery, secret propagation, or MySQL health. The pre-existing opt-in Resend connection test must remain disabled during the isolated suite. An isolated database remains the next prerequisite for the full three-person rehearsal.

The Stripe connector in ChatGPT may help with account/payment inspection once connected to the correct account. Its available webhook-management capabilities must be checked after connection. It cannot update Manus application secrets unless an independently exposed Manus capability supports that operation.
