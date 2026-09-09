# Isolated Preview Environment: Resource and Execution Plan

**Status:** **Review only.** Coach has selected the Option A direction: one separate Standard Cloud Computer for the later synthetic-data rehearsal. This document authorizes **no** Cloud Computer purchase, provisioning, branch synchronization, database migration, deployment, Stripe action, production change, secret copy, or fixture cleanup until the final reviewed PR #5 commit and a separate resource-approval instruction are supplied.

## 1. Source and Approval Gates

Production remains on **`cb60245e`** at build marker **`7b2019f3`**. The isolated-preview work is a stacked draft: PR #5 (`astra/isolated-preview-1`) is based on PR #4 (`astra/portable-operations-1`). The currently published PR #5 head is **`3e6020ff9264a8000e8f3717bdbc969b6346c25c`**. Referenced review fix **`75620e0`** is not reachable from the GitHub remote and must be recovered and pushed before an isolated environment may use this work.

**Source-gate recheck:** a subsequent GitHub API lookup for `75620e0` returned “No commit found for SHA,” and PR #5 still reports `3e6020ff9264a8000e8f3717bdbc969b6346c25c` as its only head commit. The reported focused-test results and database-guard fix are therefore treated as an **unpublished/local handoff**, not deployable source evidence. Astra/Claude must push the commit (or provide the reachable replacement SHA) and update PR #5 before the source gate can pass.

| Gate | Required evidence | Status |
|---|---|---|
| Final stacked source | Astra/Claude identify one reachable final commit that includes PR #4 and the recovered PR #5 review fix | **Blocked** — `75620e0` unresolved |
| Code review | Astra/Claude approve that named commit against the isolated-preview handoff | Pending |
| Cloud resource approval | Coach explicitly approves a separate Standard Cloud Computer and the resources below | Pending |
| Rehearsal authority | Coach explicitly authorizes bootstrap and synthetic-data acceptance checks | Pending |
| Production separation | New host, domain, database, bucket, credentials, and capture inbox are confirmed distinct from BooGMe production | Pending |

> A checkpoint in the current BooGMe project is **not** an isolation boundary. The final source must be checked out only on the separate host; it must never be synchronized into the current project or published to `boogme.com`. [1]

## 2. Approved Direction and Cost Boundary

The planned architecture is a **separate Standard Cloud Computer** with the preview app, MySQL-compatible database, S3-compatible object storage, and Mailpit on one controlled host. The Standard tier provides 2 vCPUs, 4 GB RAM, 70 GB included storage, and costs **$30/month**. Excess storage is priced at $1/month per 10 GB and excess outbound traffic at $0.15/GB. These are service-rate facts rather than a commitment to incur the charge; actual capacity, storage, and traffic must be reviewed during rehearsal. [2]

The host is justified because the preview requires Docker-level control, separate durable MySQL and S3-compatible services, a private capture inbox, reverse-proxy routing, and firewall policy that the current shared managed project cannot provide as an isolation boundary. The standard host is a starting capacity, not a production capacity claim. [1] [2]

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
| Published PR #5 validation | `3e6020f…` and the exact published validation command | 790 isolated tests passed; 2 opt-in connectivity tests skipped because the inherited kernel filter denied outbound sockets and credentials were synthetic | Preserve as its own record; it does not establish a Stripe timeout result |
| Operations-tool validation | PR #4 final named commit and exact command | 13 mocked operations-tool tests passed | Preserve separately; no Stripe request/replay was made |
| Reported two Stripe-dependent timeouts | Original review-report commit, exact test names, command, timeout values, and logs | Not identified in currently published PR #4/#5 metadata | Astra/Claude must add an explicit record; do not relabel the two skipped connectivity tests as these timeouts |
| Final isolated-host rehearsal | Final recovered/reviewed PR #5 commit and host commands | Not run | Must include all acceptance, restart, and failure checks in this plan |

## 8. Controlled Rehearsal After Final Approval

| Phase | Action | Evidence returned | Prohibited actions |
|---|---|---|---|
| 0. Source lock | Record final GitHub commit that contains the recovered review fix and stacked PR #4 parent | SHA, PR relationship, Astra/Claude approval | Merge to `main`, sync into current BooGMe project |
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
| Final source | Reachable final PR #5 SHA containing the recovered review fix, with Astra/Claude approval |
| Host approval | Explicit authorization to create the separate Standard Cloud Computer at the known $30/month base rate |
| Non-production DNS | Dedicated private HTTPS application and storage hostnames that are not on `boogme.com` or `www.boogme.com` |
| Exact service digests | Immutable MySQL-compatible, MinIO, Mailpit, proxy, Node base-image, and final app-image digests recorded in the approved compose manifest |
| Private access method | Reverse-proxy authentication/network allowlist for the app; SSH tunnel for Mailpit UI and any operator console access |
| Rehearsal scope | Native login, synthetic coach profile, uploads, private/public storage, email capture, and access controls only; payments/onboarding deferred |

## References

[1] [Astra isolated-preview phase 1 handoff](https://github.com/boogme-lgtm/chessmate/blob/astra/isolated-preview-1/docs/astra-isolated-preview-1-handoff.md)

[2] [Manus Cloud Computer plan and operating guidance](https://manus.im/app#settings/my-computer/create)

[3] [Preview storage implementation at PR #5’s current head](https://github.com/boogme-lgtm/chessmate/blob/3e6020ff9264a8000e8f3717bdbc969b6346c25c/server/_core/previewStorage.ts)

[4] [Preview bootstrap implementation at PR #5’s current head](https://github.com/boogme-lgtm/chessmate/blob/3e6020ff9264a8000e8f3717bdbc969b6346c25c/scripts/preview-bootstrap.ts)

[5] [Draft PR #5: Isolate preview data, email, storage and background jobs](https://github.com/boogme-lgtm/chessmate/pull/5)
