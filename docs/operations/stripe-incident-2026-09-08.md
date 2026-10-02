# Sandbox webhook incident closure

Status: operationally resolved on September 8, 2026. This record does not authorize a production release, Stripe change, data cleanup, or live-payment launch.

## Verified state

| Item | Evidence |
| --- | --- |
| Stripe account | Project sandbox Manus chessmate-xkyng35x, separate from live BooGMe |
| Current platform endpoint | we_1UD6tGDWCgTDQAOtLzqwDtjx, enabled, Your account scope, six events |
| Connect endpoint | we_1UD5OiDWCgTDQAOtFD4KDpyJ, enabled, Connected accounts scope, account.updated only |
| Receiver for both | https://boogme.com/api/webhooks/stripe |
| Saved variables | STRIPE_WEBHOOK_SECRET for platform; STRIPE_CONNECT_WEBHOOK_SECRET for Connect; separate values |
| Production checkpoint | cb60245e, generated marker 7b2019f3 |
| Application code basis | d2579ea730c09e206ac75c286630f367d7d83074; GitHub comparison shows only todo.md and client/public/__manus__/version.json changed |
| Public routes | Astra independently observed HTTP 200 for / and /sign-in and the matching new public marker |
| Backend restart | Manus reports a new production server-start entry and scheduler initialization after Coach clicked Publish |
| Real platform delivery | evt_1UDB5ODWCgTDQAOtKLlXrZgk, customer.subscription.created, 2026-09-08T04:02:52Z; HTTP 200, {"received":true}; Stripe shows Delivered / Recovered |
| Platform server evidence | Manus reports receipt of that event ID at the same time followed by the intentionally unhandled subscription path, with no webhook error |
| Connect diagnostic | evt_test_connect_production_redeploy_validation, 2026-09-08T04:07:48Z; HTTP 200, {"verified":true}; Manus reports the early-return log before database/business work |

Evidence provenance matters: Astra inspected Coach's Stripe screenshot, the GitHub comparison and public HTTP responses directly. Endpoint inventory/scope, production logs, restart evidence and the Connect diagnostic were supplied by Manus. Astra did not independently access Stripe or production secrets/logs through a connector. The operations script in this draft was not used for the successful resend.

## What resolved the failure

The current six-event endpoint initially targeted an ephemeral Manus preview URL. Coach corrected it to the existing BooGMe receiver; failures changed from an upstream 502 to the application's generic 400. Production logs for the later retries showed signature verification failing before business processing.

Coach saved the current platform destination's signing secret through Settings > Integrations > Stripe > claimed sandbox > Advanced settings > Webhook Secret > Save. Coach also confirmed the persisted value matched the current endpoint. Repeated requests to compare or copy it again added no useful evidence.

The managed UI save did not establish what the serving process had loaded. The app reads STRIPE_WEBHOOK_SECRET when its configuration module is initialized. Manus exposed no agent-accessible same-version production reload; the available restart affected preview only. Coach therefore authorized the normal Publish workflow with unchanged application code, allowing a new checkpoint and generated marker. After publication, the real platform event succeeded and the Connect diagnostic remained valid.

This supports stale production configuration as the remaining cause after the saved-secret correction. A static build marker alone never proved a backend restart; the closure combines the real delivery with Manus's production logs. A new deployment identifier is acceptable for a same-code configuration refresh when the code diff and release action are explicitly reviewed.

## Scope of the pass

The platform check was a real Stripe-originated sandbox subscription event, not an evt_test_ request. The reviewed handler verifies it and intentionally ignores its type, so the pass establishes receipt and signature verification without exercising lesson/payment business handlers.

The Connect check was locally signed and used the authenticated evt_test_ early-return path. It establishes current Connect-secret verification in production. A real Stripe-originated account.updated event and its onboarding-record update remain untested. Live-mode payments, booking settlement, refunds, payouts and the three-account browser rehearsal are not validated by this incident test.

## Historical endpoint and retirement follow-up

The earlier platform destination, we_1TCAt6DWCgTDQAOtMWelR3Hs, no longer appears in Manus's reported sandbox inventory. The old rotation and estimated September 8 at 17:58 UTC overlap deadline referred to that former destination. The current platform destination was created separately on September 7 at 18:03:34 UTC, per Manus.

The latest recovery pass did not perform an old-only rejection check or retire any secret. Do not infer that the earlier endpoint was deleted, its secret was manually retired, or an overlap remains active without appropriate Stripe evidence. Reconcile that history through authorized read-only inventory/UI evidence first. Do not carry an obsolete deadline onto the current endpoint or roll the working secret again to satisfy an old task list. The delivery incident is closed independently of that historical review.

## Remaining test-fixture cleanup

These are sandbox Stripe records created during the controlled $0 verification, not application users or production database fixtures:

| Resource | Known ID |
| --- | --- |
| Test customer | cus_VDcB6fTkqIOpnD |
| Product | prod_VDcCiiwe8kaJCg, BooGMeWebhookVerification |
| Confirmed subscription | sub_1UDB5ODWCgTDQAOt3Vg22VxQ |
| Zero-dollar price | price_1UDB5NDWCgTDQAOtyuzOX9FO |
| Pending SetupIntent | seti_1UDB5ODWCgTDQAOtA5xVWOVm |

The confirmed subscription was active with cancel_at_period_end=true; a cancellation request is not completed cancellation. Several creation events appeared during troubleshooting, so enumerate only this test customer's subscriptions before assuming there is just one. Plan cleanup of the identified $0 fixtures, including any still-pending SetupIntent, through an authorized sandbox action. Do not delete unrelated records, retry historical payment events, or change the persistent BooGMe database. No cleanup was performed as part of this documentation update.

## Next engineering change

Prepare an isolated preview before coach onboarding or booking tests. Add explicit environment validation, a reproducible disposable MySQL baseline, separate storage, controlled email delivery and disabled background jobs. Use synthetic Student A/B/Coach C accounts only there. The current managed database Xkyng35xnYFybYAdmyVo96 is persistent, and Stripe sandbox mode does not isolate it.

The draft [ownership transition](../astra-ownership-transition.md) already supplies standalone runtime controls and maps the remaining Manus dependencies. Continue in unmerged GitHub branches; this handoff does not publish those changes or repoint either working Stripe destination.
