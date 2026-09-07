# BooGMe ownership transition

Prepared September 7, 2026. This supersedes earlier assumptions that GitHub checkpoints cannot affect boogme.com. It does not authorize a DNS change, production deployment, data migration, or secret disclosure.

## What Coach asked for

Move engineering and service access to Coach-owned accounts operated through Astra and Claude. Use GitHub as the shared source of truth. Manus can remain the current host while we replace its services in small, testable steps. Avoid another rewrite of an existing marketplace.

The immediate incident is platform webhook-secret verification. The broader dependency problem is that the source, managed secret store, workspace environment, public assets, and serving process are different things. A successful save or matching frontend version file does not establish what the running backend verifies.

## Current incident, evidence and limits

| Item | Last reported state |
| --- | --- |
| Stripe account | Project sandbox Manus chessmate-xkyng35x; separate from live BooGMe |
| Platform destination | we_1TCAt6DWCgTDQAOtMWelR3Hs, enabled, existing platform event set |
| Connect destination | we_1UD5OiDWCgTDQAOtFD4KDpyJ, enabled, account.updated only |
| Receiver | https://boogme.com/api/webhooks/stripe |
| Production marker/source | 03d9d887 / d2579ea7, per latest verification |
| Old platform secret | Fresh old-only diagnostic rejected before processing |
| Replacement platform secret | Not yet proven at the receiver |
| Connect secret | Harmless signed diagnostic accepted; genuine account update still pending |
| Old-key overlap | Estimated expiration September 8, 2026, 17:58 UTC; exact UI deadline not verified |

Old-key rejection and Connect success do not prove that the replacement platform key is present or correct. A missing or different platform key produces the same result. Do not call the platform channel healthy until there is positive evidence. Do not prematurely retire the old key or repeat rotation to hide an unresolved problem. The existing overlap still expires automatically.

The new operations tool is documented in [Stripe operations](operations/stripe-webhook-ops.md). It inspects the correct sandbox and identifies previously existing subscription events that the current handler ignores. A reviewed replay is delivered by Stripe and does not require the webhook signing secret. It never creates payment/subscription fixtures, changes destinations, retires secrets, or infers delivery success from a queued resend.

## Where the dependencies actually are

| Capability | Source | Current dependency | Ownership action |
| --- | --- | --- | --- |
| Website and API | server/_core/index.ts, client/src, package.json | Express 5, React 19, Vite; Manus hosting and injection | Run the existing app on an independently controlled Node host behind HTTPS |
| Payment API | server/stripe.ts, server/stripeConnect.ts | Official Stripe SDK using STRIPE_SECRET_KEY | Keep the integration and sandbox; connect account administration directly |
| Webhook verification | server/_core/env.ts, server/stripeWebhookVerification.ts, server/webhooks.ts | Two separate endpoint secrets, read when the process imports configuration | Set these exact variables in the chosen host's secret manager; verify actual delivery |
| Database | server/db.ts, drizzle/schema.ts, drizzle/*.sql | Standard MySQL/mysql2/Drizzle, currently a managed persistent database | Export schema/data with owner authorization, restore a disposable copy, then prepare a verified migration |
| Email/password accounts | server/auth.ts, server/authRouter.ts, server/_core/sdk.ts | Local password hashes and JWT sessions | Preserve user IDs/hashes; plan deliberate session continuity or reauthentication |
| Google/social sign-in | client/src/const.ts, server/_core/oauth.ts, server/_core/sdk.ts | Manus OAuth broker and project identity | Replace broker separately; map existing users without creating duplicate accounts |
| Uploads/downloads | server/storage.ts and content/profile routes in server/routers.ts | Manus Forge storage proxy, not a working direct S3 driver | Add owned object storage, export files with a key/URL manifest, preserve entitlements and legacy references |
| AI coach vetting | server/aiVettingService.ts, server/_core/llm.ts | Forge AI endpoint and credential | Add a direct AI-provider adapter and rerun vetting contracts before switching |
| Owner notifications | server/_core/notification.ts and router/webhook call sites | Manus owner-notification API | Replace with owned transactional email or an internal notification queue |
| Transactional email | server/emailService.ts, server/email.ts | Direct Resend account and sender domain | Reuse verified sender and an appropriately scoped owner-managed key |
| Background work | server/reminderScheduler.ts; server/nurtureEmailScheduler.ts | In-process jobs; external nurture scheduling remains to be confirmed | Assign one job runner; keep preview workers off |
| Build/editor integration | vite.config.ts | Manus runtime plugin and debug collector | MANUS_DEV_TOOLS_ENABLED=false omits their instrumentation in standalone builds |
| Images and branding | client/index.html, Footer/CoachBrowse, email templates | Hardcoded Manus CDN/CloudFront assets | Copy owned assets and update references after verifying ownership and cache behavior |
| DNS | Prior handoff identifies Cloudflare | Current record ownership/routes not freshly verified | Inspect records before any cutover; preserve email records |

Map/voice/image/data API helpers exist under server/_core, but the inspected app has no active call sites for most of them. Inventory them before deleting scaffolding; focus on storage, auth, vetting and notifications first. Stockfish is served from installed package assets, and Lichess requests already go directly to Lichess.

The repository contains a historical BUILD_PLAN.md with outdated behavior and paths. Current source, the September audit, and the access-control/Connect handoffs take precedence for this work. In particular, the legacy booking routes were retired and storage is currently a Forge proxy.

## Changes prepared in this branch

1. A direct Stripe inspection/replay tool with account, mode, destination and event checks. It needs an explicitly supplied sandbox API credential, not a signing secret. Its unit tests use fake clients; handler tests exercise official Stripe signatures against the actual no-write subscription paths.
2. BACKGROUND_JOBS_ENABLED=false prevents loading or starting the reminder/recovery scheduler. Existing deployments retain their current default when the variable is absent. AUTO_RELEASE_PAYOUTS_ENABLED alone is insufficient: recovery, email reminders, auto-decline and auto-complete still ran on every startup.
3. MANUS_DEV_TOOLS_ENABLED=false produces the same application without Manus editor/debug instrumentation.
4. A Dockerfile for the current Node 24 runtime and pinned pnpm 10.4.1, plus a secret-free environment template and Docker exclusions. The image defaults background jobs off and does not run migrations.

These are reviewed source changes, not a completed move off Manus. The Docker recipe still includes the current dependency set because the server bundle imports development packages. Optimizing that bundle is separate from making the first standalone server work.

## Validation completed for this change

- TypeScript passed.
- The isolated application suite passed 738 tests; two opt-in connectivity tests were skipped. Outbound networking was denied by an inherited kernel filter and credentials were synthetic.
- The standalone operations tests passed 13 cases with mocked Stripe/CLI dependencies.
- A production build with Manus instrumentation disabled passed.
- The compiled server booted locally with background jobs disabled, synthetic credentials, an unavailable dummy database, and outbound connect calls blocked. Homepage and sign-in HTML returned 200; platform and Connect diagnostics each returned 200 with verified=true; an unknown signature returned 400. No scheduler started. These are HTTP/server checks, not a browser or real-service rehearsal.
- Docker is unavailable in this workspace, so the image recipe has not been built or deployed. The successful standalone check ran the compiled Node server directly.

No Stripe account request, real webhook replay, database connection, email, production restart, DNS change or Manus checkpoint was performed by Astra during this change. Direct Stripe access has been offered but remains unconfirmed at the time this report was written.

## Build and run outside Manus

Use Node 24 and the pnpm version in package.json. Do not use an arbitrary global pnpm version: the available global pnpm 11 ignores this repository's existing patch/override configuration.

    npx --yes pnpm@10.4.1 install --frozen-lockfile
    MANUS_DEV_TOOLS_ENABLED=false npx --yes pnpm@10.4.1 run build

Supply runtime variables through an owned host's secret manager using .env.example as a names-only guide. VITE values are public and baked in at build time. The actual server entry point is server/_core/index.ts, built to dist/index.js; server/index.ts is a separate static-server stub and is not the application entry point.

    docker build -t boogme:review \
      --build-arg VITE_APP_ID=boogme \
      --build-arg VITE_FRONTEND_URL=https://preview.example.com .
    docker run --rm --env-file /secure/path/boogme-preview.env \
      -p 127.0.0.1:3000:3000 boogme:review

Use a trusted HTTPS reverse proxy. The app expects one proxy hop and secure sign-in cookies. A container/image build proves neither OAuth callbacks nor email/storage/database readiness. Do not point this preview at the persistent project database: disabling jobs does not disable authenticated user mutations.

Do not run pnpm db:push against either the managed database or a fresh production destination. The September audit found an inconsistent historical migration chain, including reviews columns added twice across 0001 and 0022. Restore a disposable schema/data copy and reconcile the baseline before migrations or concurrency tests.

## Ordered implementation plan

| Step | Work | Completion evidence |
| --- | --- | --- |
| Now | Finish platform secret verification through directly authorized Stripe access; preserve Connect | Real platform delivery + receiver response/log, old-only rejection, then confirmed retirement |
| 1 | Choose an owned host, separate preview database/storage, and add GitHub CI/release promotion | A branch build cannot change boogme.com; isolated app starts without background effects |
| 2 | Repair database baseline and exercise one student/coach booking journey | Reproducible disposable MySQL setup and behavioral tests for reservations, timezones, settlement/refunds |
| 3 | Replace storage, OAuth, vetting and owner notifications in separate small PRs | Old users and files remain accessible; each provider has an explicit adapter and verification |
| 4 | Rehearse cutover and data reconciliation, then approve DNS/webhook URL changes | Named release, backup/restore proof, rollback procedure and verified service delivery |

No database-engine change, new billing model or UI redesign is needed for this transition. Keep real-money launch separate from sandbox configuration: the original booking/payment audit findings still need repairs.

## Astra and Claude collaboration

Use the same GitHub repository and one branch per change. Each PR records purpose, exact commit, tests, environment effects, and remaining gates. A second agent reviews the diff rather than reconstructing status from chat. No agent should assume that a Manus checkpoint is preview-only. Until the hosting trigger is understood, keep experimental code on unmerged branches and run it outside the existing managed project.

Connected ChatGPT apps provide service access, not permanent application hosting. Coach owns the service accounts and deployments. The currently exposed Manus connector starts new tasks; it does not expose access to the existing task or production secrets. A direct Stripe connector's actual event/webhook capabilities must be checked after connection; do not assume every Stripe API operation is exposed.
