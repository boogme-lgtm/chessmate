# Isolated preview, phase 1

Prepared September 8, 2026. Engineering branch: `astra/isolated-preview-1`, based on `astra/portable-operations-1` at `13a426bf9e24167c89f0b89d2bad82093ad75245` (draft PR #4). Review this as a stacked change. Production remains the separately verified `cb60245e` release. The Stripe incident is closed.

## Purpose and ownership

We need somewhere to exercise account, coaching and content flows without writing to the persistent Manus project database, emailing real users, changing payment records or running a second scheduler. This change adds that environment to the existing app. It does not provision resources or move the public website.

Astra/Claude own implementation and review in GitHub. Manus may synchronize reviewed work into a **separate preview project/host**, configure its separately approved resources, and run the checks below. Do not synchronize this experimental branch into the current Manus project: earlier checkpoint/configuration changes reached boogme.com automatically. A fresh checkpoint is not an isolation boundary.

## What the code does

| Boundary | Preview behavior |
| --- | --- |
| Environment | `APP_ENV=preview` validates before clients connect. A unique instance ID, app ID and new JWT secret are required. Shared Stripe, Resend, Forge and OAuth settings are rejected. Legacy production behavior remains when preview is not selected. |
| Database | Only `boogme_preview_<instance>` with a non-admin user is accepted. Before any ORM use, the app reads the selected database name and its instance marker. Missing/wrong markers stop startup and application access. |
| Storage | Uses a dedicated S3-compatible `boogme-preview-<instance>` bucket and explicit credentials. The app checks its instance marker before writes/download signing. Paid and fulfillment files use `private/` and five-minute signed URLs; avatars/thumbnails use `public/` and stable URLs. Existing authorization checks still apply. |
| Email | Both application email senders and owner notices go to a private Mailpit inbox. Inbox failure never falls back to Resend or Manus notifications. Verification/reset links remain in that inbox, not server logs. |
| Background work | Scheduler imports and startup are disabled in preview. An attempt to enable background jobs or payout release fails configuration validation. |
| Payments | Both Stripe clients reject API operations before network access. No Stripe key or webhook signing secret is accepted in this first phase. This is not yet a payment/onboarding sandbox. |
| Authentication | Native email/password login works without Manus OAuth. The Google option is absent when unconfigured. A fresh app ID/JWT isolates sessions. HTTPS keeps Secure cookies; only an explicit loopback HTTP preview permits local cookies. |
| Setup | `preview/schema.sql` is an empty 28-table baseline exported from the unchanged current Drizzle schema. Bootstrap verifies both resources are empty before writing and adds identity markers. It never resets resources, imports production data or inserts users. |

## Resource approval still required

The following is a concrete example using instance `coachqa`. Resources do not exist as a result of this PR. Approve a separate host/project and its resource ownership before configuring anything. Do not reuse the current Manus project's integrated secrets or request a production secret export.

| Resource | Required configuration |
| --- | --- |
| Application | Separate process/host, preview branch only, no automatic publication to boogme.com, private access initially. Node 24 and pnpm 10.4.1. |
| MySQL | New empty `boogme_preview_coachqa`. Fresh `preview_app` credential restricted to that database, with no privileges on `Xkyng35xnYFybYAdmyVo96` or any production schema. No dump of real users. |
| Object storage | New empty `boogme-preview-coachqa` bucket, fresh bucket-restricted credentials, separate from current Manus storage. Path-style S3 support. HTTPS for remote endpoints. |
| Mail capture | Mailpit on loopback or private service name `mailpit`. Enable its HTTP send API (`MP_SEND_API_AUTH_ACCEPT_ANY=true`) only on that private interface. No SMTP relay, forwarding, automatic relay or delivery credentials. Keep the inbox UI private and bind any local published port to `127.0.0.1`. |
| Browser origin | Local `http://localhost:3000`, or a separate private HTTPS preview origin. Never boogme.com. Remote previews require HTTPS and private access to the inbox. |
| Credentials | New JWT and resource credentials entered directly into the preview host's secret manager. No values in GitHub/chat. Start with an empty environment, not inherited Manus production configuration. |

Resource owners must enforce least privilege. Names and markers prevent common configuration mistakes; they cannot establish whether a supplied database login has excessive grants or whether a bucket's external policy is private. Verify those controls before startup.

For the example bucket, the **only anonymous object-read allowance** is:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::boogme-preview-coachqa/public/*"
  }]
}
```

The provider may require an equivalent public-prefix policy. Never allow anonymous reads on `private/*`, the marker, the bucket root, or bucket listing. Do not apply this example to any existing bucket. Runtime credentials need only the dedicated bucket's marker read, private object read and public/private object writes. Bootstrap temporarily needs list/write access for the marker and MySQL CREATE/INSERT privileges; remove setup privileges afterward. MySQL runtime needs CRUD on app tables and SELECT on the guard, not DDL or guard writes. Provisioning and policy edits are not executed by the bootstrap.

## Prescribed setup after resource approval

1. Check out this branch in the separate host. Use the lockfile and pinned package manager. Copy `.env.preview.example` to an ignored `.env.preview` there and replace only its preview placeholders with new values. Leave all Stripe, Resend and Manus credentials absent. Do not run `db:push` or historical migrations.
2. Confirm the fresh MySQL grants, empty bucket, public-prefix policy and capture-only inbox. Then run the explicitly scoped initializer:

   ```sh
   node --env-file=.env.preview --import=tsx scripts/preview-bootstrap.ts --initialize-empty-preview
   ```

   Both resource preflights run before the first write. Initialization refuses any existing table/object, including a prior initialization. SQL DDL is not transactional. If initialization fails, inspect these dedicated resources and correct/recreate them with their owner; the script will not reset anything automatically. Do not add markers to a shared database or bucket to make checks pass.

3. Build with the same public VITE settings the runtime uses, then start. Do not reuse a production client bundle. Node 24's `--run` inherits the supplied file into the package build script:

   ```sh
   node --env-file=.env.preview --run build
   node --env-file=.env.preview dist/index.js
   ```

   For Docker, set the corresponding public VITE build args and pass preview runtime settings through the host secret manager. The Dockerfile excludes environment files and preview data. Publish local ports only on loopback; use a trusted HTTPS reverse proxy for a remote preview. The server requires the chosen port instead of silently moving to another one. Bootstrap is a setup command run from a source checkout, not an automatic container startup task.

4. Perform the acceptance checks below and return redacted evidence. A build marker or HTTP 200 alone does not prove resource isolation.

## Acceptance checks for the separate environment

- Record commit and preview URL, actual database name, bucket name, credential scope and inbox address. Include no credentials or personal records.
- Confirm startup logs report the instance's resource checks and disabled jobs. Missing/wrong DB and bucket markers must prevent the preview from listening. Do not modify production to test this.
- Homepage, sign-in and coach browse render in the browser. No Manus OAuth configuration is needed for native sign-in.
- Register synthetic Student A and Student B using `.invalid` addresses. Read verification links in the private inbox, verify, sign in and sign out. Check password reset in the same inbox. Confirm there is no message delivery outside Mailpit.
- Create a synthetic coach through the app's non-payment flow. Verify avatar upload and thumbnail URLs resolve from the dedicated preview bucket. A private content object must reject anonymous GET; an authorized application's signed download should work and expire. Repeat the Student A/B access-denial checks using preview records only.
- Direct payment/onboarding actions must fail without Stripe API traffic. There are no preview webhook secrets to accept events. No reminders or payout jobs run.
- Review the dedicated DB and bucket for only these synthetic records/files. Verify production grants remain inaccessible; do not query or mutate production as a negative test.

Real Stripe onboarding, checkout and payout tests require a later **separate preview Stripe configuration** and reviewed code change. Existing working Stripe destinations remain on boogme.com. We will not point their events at this preview or reuse their secrets.

## Validation and remaining limits

The focused preview tests cover configuration refusal, database marker checks, empty-resource bootstrap, both email senders and owner notices, real-SDK payment blocking, private/public storage paths, real presigned URLs, jobs and native login cookies. The baseline manifest binds the generated SQL to `drizzle/schema.ts`; schema changes must regenerate and review both files before setup.

Final command results are recorded in the PR. No new infrastructure, database connection, object upload, external email or Stripe request was made during implementation. Docker and the real MySQL/S3/Mailpit acceptance rehearsal still require the separate approved environment. Unit mocks do not prove those services are correctly provisioned.

If the preview is misconfigured, stop only its process. Production remains on its existing release; do not roll it back or publish this branch there. Keep the incident closed and historical Stripe-secret/fixture work outside this task.

## Handoff between Codex and Claude

Open this repository and branch in a Codex Cloud environment or a local coding workspace. Read this file and the PR diff first; do not reconstruct requirements from chat alone. Claude reviews the branch against the acceptance checks. Neither a new coding view nor a GitHub connection transfers Manus runtime or Stripe permissions. Keep source changes in GitHub and any later configuration/deployment approval tied to a named commit and separate environment.

Primary implementation references: [Drizzle schema export](https://orm.drizzle.team/docs/drizzle-kit-export), [Mailpit HTTP API](https://mailpit.axllent.org/docs/api-v1/), [AWS S3 request presigner](https://github.com/aws/aws-sdk-js-v3/tree/main/packages/s3-request-presigner).
