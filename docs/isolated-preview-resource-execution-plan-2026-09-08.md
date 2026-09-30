# Isolated Preview Environment: Resource and Execution Plan

**Status:** **Review only.** Coach has selected the Option A direction: one separate Standard Cloud Computer for the later synthetic-data rehearsal. This document authorizes **no** Cloud Computer purchase, provisioning, branch synchronization, database migration, deployment, Stripe action, production change, secret copy, or fixture cleanup until the final reviewed PR #5 commit and a separate resource-approval instruction are supplied.

## 1. Source and Approval Gates

Production remains on **`cb60245e`** at build marker **`7b2019f3`**. The isolated-preview work is still a stacked draft: PR #5 (`astra/isolated-preview-1`) is based on PR #4 (`astra/portable-operations-1`). Read-only GitHub verification on September 30 confirmed PR #5 head **`da4fd9062a0c9f50478114d64e1f7e69aeab15c1`**, with PR #4 base/head **`13a426bf9e24167c89f0b89d2bad82093ad75245`**. Both PRs remain open drafts.

**Source-gate recheck:** GitHub resolves `da4fd9062a0c9f50478114d64e1f7e69aeab15c1` (tree `812c9f68b1aaf014247e366ff7899b5054147a46`) as a direct child of the prior PR #5 commit `3e6020ff9264a8000e8f3717bdbc969b6346c25c`; the full stacked comparison is two commits ahead and zero behind the current PR #4 head. The unavailable `75620e0` was not recovered verbatim; this published replacement adds the reviewed-baseline hash comparison and corresponding database/bootstrap regressions. The guard now rejects a missing or stale `baseline_sha256` before ORM use and before startup listens, in addition to enforcing the dedicated database and instance marker. This establishes **source reachability and handoff reconciliation only**. It does not close the required PR #4-then-#5 review gate, authorize synchronization, or authorize infrastructure work.

| Gate | Required evidence | Status |
|---|---|---|
| Final stacked source | Astra/Claude identify one reachable final commit that includes PR #4 and the PR #5 database-baseline correction | **Reachability verified** — `da4fd9062a0c9f50478114d64e1f7e69aeab15c1`; it remains a draft review candidate, not an approved deployment source |
| Code review | Astra/Claude approve the stacked source against the isolated-preview handoff, reviewing PR #4 before PR #5 | **Approved September 30, 2026** — PR #4 `13a426bf9e24167c89f0b89d2bad82093ad75245`, then PR #5 `da4fd9062a0c9f50478114d64e1f7e69aeab15c1`; both remain open drafts and must remain unmerged |
| Cloud resource approval | Coach explicitly approves a separate Standard Cloud Computer and the resources below | Pending |
| Rehearsal authority | Coach explicitly authorizes bootstrap and synthetic-data acceptance checks | Pending |
| Production separation | New host, domain, database, bucket, credentials, and capture inbox are confirmed distinct from BooGMe production | Pending |

> A checkpoint in the current BooGMe project is **not** an isolation boundary. The final source must be checked out only on the separate host; it must never be synchronized into the current project or published to `boogme.com`. [1]

## 2. Approved Direction and Cost Boundary

The planned architecture is a **separate Standard Cloud Computer** with the preview app, MySQL-compatible database, S3-compatible object storage, and Mailpit on one controlled host. The Standard tier provides 2 vCPUs, 4 GB RAM, 70 GB included storage, and costs **$30/month**. Excess storage is priced at $1/month per 10 GB and excess outbound traffic at $0.15/GB. These are service-rate facts rather than a commitment to incur the charge; actual capacity, storage, and traffic must be reviewed during rehearsal. [2]

The host is justified because the preview requires Docker-level control, separate durable MySQL and S3-compatible services, a private capture inbox, reverse-proxy routing, and firewall policy that the current shared managed project cannot provide as an isolation boundary. The standard host is a starting capacity, not a production capacity claim. [1] [2]

### Read-only host-access result and pending resource proposal

On September 30, the execution-device inventory showed `cloud-pc-7y5pwwut` (`device:7y5pwwutt9n66fsf0500845ry`) **online**, but `switchable: false` with `cloud_pc_sidecar_only`. Its `Home` workspace is listed at `/home/ubuntu`, but its provider capacity and billing telemetry are unavailable to this task. No command was run on it, and this result does not establish its tier, current cost, disk state, Docker readiness, existing data, or suitability as an isolation boundary.

**How to make that existing machine available:** Coach must attach (or reattach) `cloud-pc-7y5pwwut` to this conversation using the **computer icon below the chat input**, selecting that Cloud Computer and its Home workspace. The next device inventory must show it as switchable; only then may this task switch to the selected workspace for a fresh, read-only host inspection. Do not treat the current sidecar listing as authority to operate the machine. If it is not selectable in the picker, do not repurpose it through this task; use the new-host proposal below instead.

| Decision area | Existing listed host | Proposed approved-resource path |
|---|---|---|
| Host | `cloud-pc-7y5pwwut`: online but sidecar-only and not actionable by this task | **New dedicated Standard Cloud Computer** used only for `coachqa`; no current BooGMe project, production service, or unrelated workload shares it |
| Cost | Unknown from current read-only access; do not infer plan or billing | **$30/month** base: 2 vCPU, 4 GB RAM, 70 GB storage, 500 GB outbound traffic; overages are $1/month per additional 10 GB storage and $0.15/GB outbound traffic [2] |
| Database | Unknown; must not be inspected or reused until the host becomes task-accessible and separately approved | New empty MySQL database **`boogme_preview_coachqa`**, dedicated bootstrap and runtime identities only; no production grants/data |
| Object storage | Unknown; must not be inspected or reused until approved | New empty MinIO/S3 bucket **`boogme-preview-coachqa`**, separate bootstrap and runtime identities only |
| Private browser names | None proposed for the inaccessible machine | Reserve labels **`app.coachqa.preview.<new Coach-controlled non-production domain>`** and **`files.coachqa.preview.<same domain>`**. A real domain and DNS records are not selected or created by this plan; they must not be under `boogme.com` or `www.boogme.com`. |
| Browser access | Not assessed | Caddy exposes HTTPS only: the application uses a revocable private-test access control, storage exposes only public-object GETs and time-limited signed private-object GETs; no object listing, MinIO console, raw S3 API, MySQL, or Mailpit route is public |
| Mail capture | Unknown | Private Mailpit service `mailpit:8025`; UI reachable only through an authenticated SSH tunnel to **`127.0.0.1:8025`**; no SMTP relay, forwarding, or public route |

This proposal selects **new host over existing host** because it is the only path that currently supplies a verifiable clean isolation boundary. It is a proposal, not a creation request.

**Approval boundary 1 — resource creation only:** Coach may approve creating the new Standard host and the named empty database, bucket, private Mailpit, restricted identities, private DNS labels, firewall, persistent volumes, and pinned service images. That authority would not permit checking out code, bootstrapping, running containers, injecting runtime credentials, or creating synthetic accounts/files.

**Approval boundary 2 — bootstrap and rehearsal:** after resource-creation evidence is reviewed, Coach must separately authorize source checkout of the approved draft source, one empty-resource bootstrap, credential reduction, startup, controlled failure tests, restart checks, and synthetic browser acceptance. It still excludes Stripe onboarding, payments, webhooks, real users, production data, and publication.

## 3. Option A Topology: Internal Services and Browser-Reachable Storage

The preview needs **two distinct storage origins**. The application uses an internal Docker DNS address for S3 API requests, while testers’ browsers receive a separate HTTPS storage address for public avatars/thumbnails and signed private downloads. This is required by `PreviewStorage`, which creates presigned URLs locally and must not hand a browser an internal Docker hostname. [3]

| Surface | Proposed address pattern | Access model | Exposure rule |
|---|---|---|---|
| Preview application | `https://preview-coachqa.<dedicated-nonproduction-domain>` | Private tester access via reverse-proxy authentication or network allowlist | HTTPS only; never `boogme.com` or `www.boogme.com` |
| Internal object-store API | `http://minio:9000` | App, bootstrap, and reverse proxy only on the Docker network | No firewall rule; never browser-facing |
| Browser object-store API | `https://files-preview-coachqa.<dedicated-nonproduction-domain>` | Browser reads `public/*`; browser uses time-limited signatures for `private/*` | HTTPS reverse-proxy only; raw port 9000 remains closed |
| Object-store console | `minio:9001` | Operator only through an SSH tunnel, if needed | No public proxy route or firewall rule |
| Mailpit HTTP API | `http://mailpit:8025` | Application only on the Docker network | No public firewall rule |
| Mailpit UI | `http://127.0.0.1:8025` through SSH port forwarding | Authorized tester/operator only | No public proxy route; no email forwarding or SMTP relay |
| MySQL | `mysql:3306` | App and controlled bootstrap process only | No public firewall rule |

The reverse proxy will expose only port **443** for the private app and the browser-facing storage hostname. It will route the storage hostname to the internal MinIO API service using path-style S3 requests. MinIO’s console and raw service ports remain unexposed. Bucket policy permits anonymous **GET only for `boogme-preview-coachqa/public/*`**; `private/*`, the root, listing, and the guard marker remain non-public. The existing code’s `PREVIEW_S3_ENDPOINT` and `PREVIEW_S3_PUBLIC_ENDPOINT` settings map directly to the internal and browser-facing addresses respectively. [1] [3]

## 4. Resource, Identity, and Credential Separation

Every resource starts empty and receives preview-only credentials entered directly in the separate host’s secret manager or root-owned configuration file. No current Manus project secret, production database export, production bucket object, Stripe key, webhook secret, Resend key, OAuth setting, Forge credential, or user record may enter this environment. [1]

| Resource | Identity | Temporary bootstrap identity | Restricted runtime identity | Post-bootstrap action |
|---|---|---|---|---|
| MySQL database | `boogme_preview_coachqa` | `preview_bootstrap`: only this database; can inspect emptiness, create baseline tables, create and insert the database marker | `preview_app`: CRUD on app tables and read-only access to the marker; no DDL and no marker writes | Revoke or delete `preview_bootstrap` before app startup |
| Object bucket | `boogme-preview-coachqa` | `preview_storage_bootstrap`: only this bucket; can list the empty bucket and write the guard marker | `preview_storage_app`: read guard marker, put `public/*` and `private/*`, and create signed private GETs; no bucket policy or user management | Revoke or delete `preview_storage_bootstrap` before app startup |
| Bucket policy administration | Bucket policy bound only to the new preview bucket | Host operator role, used once to set prefix policy | None for app | Remove from bootstrap workflow after policy verification |
| Email capture | `mailpit` private service | No external delivery credential exists | App may call capture API only | Confirm no relay, forwarding, or Resend fallback remains configured |
| Preview session signing | Fresh `JWT_SECRET` and `VITE_APP_ID=boogme-preview-coachqa` | N/A | App runtime only | Never reuse a production session/JWT identity |

The bootstrap script already refuses a non-empty database or bucket, checks the selected database name, records a database guard marker, and writes an S3 guard marker. The revised procedure must use **both** temporary setup identities during that one manual bootstrap; then remove both identities and switch the runtime to restricted database and storage credentials. Bootstrap never runs automatically on container startup, never resets a resource, and never imports production data. [1] [4]

## 5. Durable Services, Pins, Startup Order, and Restart Verification

The final compose manifest will use named durable volumes and **immutable image digests**. No service may use a floating `latest` tag. Exact digests must be recorded in the final execution approval because they depend on the final reviewed source and available security-reviewed images.

| Service | Implementation and pin requirement | Durable volume | Startup role |
|---|---|---|---|
| App | Final PR #5 image built from its `node:24-bookworm-slim` Dockerfile; resolve the base image and resulting app image to immutable digests | None; application code/image is immutable | Starts after MySQL, MinIO, and Mailpit health checks; never runs bootstrap |
| Database | MySQL-compatible service matching the final source; exact release tag and digest recorded before provisioning | `coachqa_mysql_data` | Starts first; health check must pass before bootstrap or app |
| Object storage | MinIO S3-compatible server, exact release tag and digest recorded before provisioning | `coachqa_minio_data` | Starts first; internal API only; browser access occurs solely through HTTPS proxy |
| Mail capture | Mailpit, exact release tag and digest recorded before provisioning | `coachqa_mailpit_data` if persistence is enabled for restart verification | Starts before app; capture API stays internal and UI loopback-only |
| HTTPS proxy | Caddy or equivalent, exact release tag and digest recorded before provisioning | Proxy certificate/config volume as needed | Starts after app and object store; exposes only 443 |

Docker Compose will use `restart: unless-stopped`, health checks for MySQL, MinIO, and Mailpit, and a root-managed systemd unit that brings the composed preview stack back after host reboot. The unit must be enabled before rehearsal. Firewall policy opens only SSH and HTTPS; it must not open MySQL, MinIO API, MinIO Console, or Mailpit ports. [2]

The restart acceptance record must prove the following sequence without re-running bootstrap:

1. Restart the compose stack, then perform one controlled host reboot.
2. Confirm systemd and Docker restore the same pinned service images and all health checks return healthy.
3. Confirm `boogme_preview_guard` still contains the `coachqa` instance marker and expected baseline hash.
4. Confirm `boogme_preview_guard.json` remains present and matches `coachqa`.
5. Confirm a synthetic avatar, a private synthetic object, and Mailpit’s captured test messages remain available from their intended durable stores.
6. Confirm the app starts, resource checks pass, jobs remain disabled, and `/` responds only on the private preview origin.

## 6. Preflight, Bootstrap, and Failure Checks

No preflight failure may be “fixed” by pointing the preview at a shared resource, resetting data, changing a marker on an existing resource, or using a production credential.

| Check | Controlled method | Expected outcome | Evidence to record |
|---|---|---|---|
| Database name and marker missing | Start against the dedicated preview database before bootstrap | Server rejects startup before listening | Command, exit code, redacted error class/message |
| Database marker wrong | Use a deliberately wrong marker only in a disposable preview resource | Server rejects startup before listening | Command, exit code, redacted error class/message |
| Storage marker missing or wrong | Use a dedicated empty/disposable preview bucket state | Storage verification rejects before writes/download signing | Command, exit code, redacted error class/message |
| Stale baseline | In a **disposable source copy**, alter only the local baseline/manifest relationship and run the bootstrap preflight; do not connect to resources | Script exits before DB/S3 client creation due to hash mismatch | Commit, command, exit code, proof of no resource mutation |
| Non-empty resource | Run bootstrap preflight against a deliberately non-empty dedicated preview resource | Bootstrap refuses reuse/reset | Command, exit code, redacted error class/message |
| Jobs enabled | Set a preview job flag to `true` only in a disposable runtime config | Configuration validation rejects startup | Command, exit code, redacted error class/message |
| Shared provider credential present | Add a harmless non-secret placeholder for a prohibited provider variable in a disposable config | Configuration validation rejects startup before provider use | Command, exit code, redacted error class/message |
| Browser storage routing | Upload a synthetic public object and a synthetic private object | Public HTTPS URL loads; anonymous private request fails; signed private URL works then expires | URL hostnames, HTTP status only, expiration result |

The stale-baseline test is specifically required because the bootstrap script compares `drizzle/schema.ts`, `preview/schema-manifest.json`, and `preview/schema.sql` before it creates DB/S3 clients. It must be recorded as a local controlled failure, not a change to the deployed source or resources. [4]

## 7. Test-Run Record: Do Not Combine Results

Every test record must identify its exact source commit, command, execution environment, external-network policy, result, and any skipped/timed-out tests. Results from different workspaces or review reports must **not** be combined.

| Record | Source and command required | Current known status | Required follow-up |
|---|---|---|---|
| Earlier published PR #5 validation | `3e6020f…` and its published validation command | Earlier record: 790 isolated tests passed; 2 opt-in connectivity tests skipped because the inherited kernel filter denied outbound sockets and credentials were synthetic | Preserve only as historical evidence; it does not validate the later replacement source or establish a Stripe timeout result |
| Replacement PR #5 offline validation | `da4fd9062a0c9f50478114d64e1f7e69aeab15c1`; commands recorded in its committed handoff | **Astra/Claude-reported, GitHub-published handoff:** 54 focused tests passed; full suite 792 passed, 2 intentionally skipped, 0 failures/timeouts; TypeScript and 13 operations tests passed. Client/server bundles passed with a Windows-specific workaround; the unchanged standard build script did not pass in that sandbox. | Re-run the unchanged standard build and all prescribed host checks on the separately approved host; do not represent offline validation as live isolation evidence |
| Historical two Sprint 44 Stripe lookup timeouts | Original unavailable review-run SHA, exact test names, command, timeout values, and logs | Historical report only; the replacement handoff says this run did not reproduce them and all five `sprint44.test.ts` tests passed offline | Keep distinct from the two intentional opt-in skips and from the replacement suite; do not use it as current-source validation |
| Operations-tool validation | Named source and `node --test scripts/stripe-webhook-ops.test.mjs` | Replacement handoff reports 13 mocked operations tests passed | Preserve separately; no Stripe request/replay was made |
| Final isolated-host rehearsal | Final approved PR #5 commit and host commands | Not run | Must include all acceptance, restart, and failure checks in this plan |

## 8. Controlled Rehearsal After Final Approval

| Phase | Action | Evidence returned | Prohibited actions |
|---|---|---|---|
| 0. Source lock | Obtain Astra/Claude’s completed review of PR #4 then PR #5 and record the approved SHA (currently `da4fd9062a0c9f50478114d64e1f7e69aeab15c1`) | SHA, PR relationship, Astra/Claude approval | Merge to `main`, sync into current BooGMe project |
| 1. Provision | Create approved separate Standard host, private DNS, empty database, empty bucket, Mailpit, and restricted identities | Names, private origins, version digests, credential scopes; no credentials | Production resource reuse, data copy, or domain reuse |
| 2. Preflight | Verify grants, bucket policy, private inbox, image pins, volumes, firewall, and all controlled failure checks | Redacted preflight/failure record | `db:push`, historical migrations, production queries |
| 3. Bootstrap | Run only `preview-bootstrap.ts --initialize-empty-preview` with both temporary setup identities | Guard markers and baseline output | Reset/retry-on-shared resources, seed production data |
| 4. Credential reduction | Revoke/remove both bootstrap identities; inject restricted runtime identities | Redacted permission verification | Running the app with bootstrap credentials |
| 5. Build and start | Build with preview settings, start the app, validate browser storage routing | Build result, startup resource checks, jobs-disabled evidence | Production bundle, public Mailpit/console, silent port changes |
| 6. Acceptance | Use synthetic `.invalid` students and synthetic coach only | Account/login, upload, access control, email, storage, payment-blocking evidence | Real users, payment/onboarding, Stripe webhooks, production data mutation |
| 7. Restart and review | Run restart verification, then provide complete evidence to Astra | Restart checklist and review outcome | Production promotion |

## 9. Remaining Decisions Before Any Execution

| Decision | Required value |
|---|---|
| Final source | Astra/Claude’s completed PR #4-then-#5 review and explicit approval of a named SHA; current reachable candidate is `da4fd9062a0c9f50478114d64e1f7e69aeab15c1` |
| Host approval | Explicit authorization to create the separate Standard Cloud Computer at the known $30/month base rate |
| Non-production DNS | Dedicated private HTTPS application and storage hostnames that are not on `boogme.com` or `www.boogme.com` |
| Exact service digests | Immutable MySQL-compatible, MinIO, Mailpit, proxy, Node base-image, and final app-image digests recorded in the approved compose manifest |
| Private access method | Reverse-proxy authentication/network allowlist for the app; SSH tunnel for Mailpit UI and any operator console access |
| Rehearsal scope | Native login, synthetic coach profile, uploads, private/public storage, email capture, and access controls only; payments/onboarding deferred |

## References

[1] [Astra isolated-preview phase 1 handoff at the reachable replacement source](https://github.com/boogme-lgtm/chessmate/blob/da4fd9062a0c9f50478114d64e1f7e69aeab15c1/docs/astra-isolated-preview-1-handoff.md)

[2] [Manus Cloud Computer plan and operating guidance](https://manus.im/app#settings/my-computer/create)

[3] [Preview storage implementation at PR #5’s current reachable head](https://github.com/boogme-lgtm/chessmate/blob/da4fd9062a0c9f50478114d64e1f7e69aeab15c1/server/_core/previewStorage.ts)

[4] [Preview bootstrap implementation at PR #5’s current reachable head](https://github.com/boogme-lgtm/chessmate/blob/da4fd9062a0c9f50478114d64e1f7e69aeab15c1/scripts/preview-bootstrap.ts)

[5] [Draft PR #5: Isolate preview data, email, storage and background jobs](https://github.com/boogme-lgtm/chessmate/pull/5)
