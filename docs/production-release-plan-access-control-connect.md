# BooGMe Production Release Plan — Access Control and Connect Webhooks

**Prepared:** September 7, 2026  
**Scope:** Planning only. This document authorizes neither a publication nor the activation of the disabled Connected accounts endpoint.

## Release reconciliation

| Item | Identified state |
|---|---|
| Live custom-domain build marker | `18f33161` from `https://boogme.com/__manus__/version.json` |
| Managed deployment timestamp | `1788799260399` |
| Reviewed checkpoint candidate | `d18de17f` |
| Candidate source commit | `d18de17f8deefe6f497113bedc0c4cabdcf98a09` |
| Connect implementation commit | Local cherry-pick `f9d35ffc2ce88e671ac6705e1cc08c5caa642d2a`, sourced from Astra commit `52a76e748b10a7360993b94fdc0c6d2ae61af273` |
| Uncheckpointed changes | `todo.md` release-planning entry only; no application code, schema, migration, or secret change is pending |

The live version marker exactly matches the version file committed in `d18de17f`, and the production process restart corresponds to that checkpoint interval. Therefore, `d18de17f` is already the running production candidate. No manual Publish action is required or authorized for this release plan. Verify the marker again before any future checkpoint-based deployment.

## Migration and secret readiness

No database migration is required for this release. The candidate adds no `drizzle/` migration files. The latest existing migration is `0028_watery_martin_li`, which was previously applied to the managed database.

The release contains the reviewed dual-secret verifier. The existing platform destination continues to use `STRIPE_WEBHOOK_SECRET`. The disabled Connected accounts destination has a distinct `STRIPE_CONNECT_WEBHOOK_SECRET`, stored through the project-secret mechanism. The application reads environment values at process startup. A production deployment/restart after the secret was stored is required for a running production process to load both values.

## Required production-verification sequence after explicit approval

1. Confirm the live marker remains `18f33161`, matching `d18de17f`, and confirm the post-secret-update production process has restarted.
2. Do not enable `we_1UD5OiDWCgTDQAOtFD4KDpyJ` and do not modify the existing platform endpoint or `STRIPE_WEBHOOK_SECRET`.
3. Verify public routes: `/`, `/sign-in`, `/coaches`, and an existing public coach detail URL. Confirm the sign-in page renders and that coach browse/detail pages expose their expected public fields without server errors.
4. Perform two harmless signed diagnostics against `https://boogme.com/api/webhooks/stripe`: one header generated from the platform secret and one generated from the Connect secret. Each payload must use an `evt_test_` ID. The handler verifies the signature then returns before any database, payment, email, payout, or coach-onboarding processing. Record only status, response, timestamp, and non-secret diagnostic IDs.
5. Read production logs after the diagnostics for successful webhook receipt and absence of signature-verification errors. Keep the Connect destination disabled.

## Post-publication acceptance criteria

| Check | Required result |
|---|---|
| Public routes | Homepage, sign-in, coach browse, and coach detail return normally |
| Platform diagnostic | Valid platform-signed `evt_test_` request returns HTTP 200 with the verification response; no persistent state changes |
| Connect diagnostic | Valid Connect-signed `evt_test_` request returns HTTP 200 with the verification response; no persistent state changes |
| Existing payment delivery | Existing platform endpoint remains enabled and unchanged; no payment-event subscription or signing-secret modification |
| Connect delivery | Endpoint `we_1UD5OiDWCgTDQAOtFD4KDpyJ` remains `disabled` |
| Production logs | No new startup, schema, database, or webhook-signature errors |

## Rollback plan

If the candidate causes a production issue, do **not** roll back to a checkpoint before the access-control repair. Use checkpoint `9dd8853c`, which preserves Astra’s access-control security changes while removing the later Connect webhook implementation, or create an equivalent reviewed revert of `f9d35ff` only.

Keep the Connected accounts destination disabled throughout rollback. The distinct Connect secret may remain stored safely because the rollback runtime will not read it. Preserve the existing platform destination and `STRIPE_WEBHOOK_SECRET` unchanged. After rollback, verify the live version marker and the same public route checks before declaring recovery.

## Explicitly out of scope

This release plan does not activate the Connected accounts destination, send a Stripe test event, rotate the platform signing secret, alter live-mode Stripe credentials, modify database schema, or change the existing platform destination.
