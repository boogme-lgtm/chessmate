# Isolated Preview Environment: Resource and Execution Plan

**Status:** Review only. This document authorizes no provisioning, branch synchronization, database migration, deployment, Stripe action, production change, or fixture cleanup.

## 1. Release Gate

The production deployment remains **`cb60245e`** at marker **`7b2019f3`**. The isolated-preview work is a stacked draft: PR #5 (`astra/isolated-preview-1`) is based on draft PR #4 (`astra/portable-operations-1`). The presently published PR #5 head is **`3e6020ff9264a8000e8f3717bdbc969b6346c25c`**; the separately referenced review fix **`75620e0`** is not reachable from the project remote and must be recovered and pushed before any environment is prepared from this code.

| Gate | Required evidence | Status |
|---|---|---|
| Parent stack | Draft PR #4 head is included in the final preview source | Pending final GitHub reconciliation |
| Preview fix | A reachable final PR #5 head contains the missing review fix | Blocked: `75620e0` is not currently present on the remote |
| Code review | Astra/Claude identify the final commit and approve it against the handoff | Pending |
| Resource approval | Coach approves a distinct host, database, storage, and private email-capture design | Pending |
| Rehearsal authority | Coach explicitly authorizes provisioning and the prescribed synthetic-data rehearsal | Pending |

The public PR #5 validation summary reports **790 isolated tests passed**, with **two opt-in connectivity tests skipped** because outbound sockets were denied by the inherited kernel filter and provider credentials were synthetic. The operations PR separately reports **13 mocked operations-tool tests passed**. The current GitHub record does **not** identify two failed “Stripe-dependent timeouts.” Before deployment, the final handoff must reconcile this terminology by naming each affected test, its expected result (pass, skip, or timeout), its trigger, and why it does not weaken preview payment blocking. Until then, no unqualified claim about two Stripe timeouts should be used in a release record. [1] [2]

## 2. Hosting Choices for Approval

The preview must be a **separate environment**, not another checkpoint in the current BooGMe project. The handoff requires a standalone process because the existing managed project has historically shared resources and configuration paths with `boogme.com`. [1]

| Approach | Components | Tradeoffs | Monthly host cost | Setup complexity |
|---|---|---|---:|---|
| **A. Dedicated self-contained preview host — recommended** | One separate Standard Cloud Computer running the application, MySQL-compatible database, S3-compatible object storage, and Mailpit as isolated services | Strongest practical boundary; permits Mailpit, S3-compatible storage, and database grants to be checked together. Requires server and Docker administration. | **$30** for the Standard host; possible storage/egress overage after included allowance | Moderate |
| **B. Separate managed application project plus separately hosted data/capture services** | New private application project, separately provisioned database, S3-compatible bucket, and private Mailpit host | Lower operational responsibility for the app host, but isolation depends on provider-specific confirmation that database and storage are truly dedicated. Mailpit still requires a private service and secure connectivity. | Managed-project and service charges require provider confirmation; no reliable total can be stated before resource selection | Higher coordination risk |

Approach A is the recommended **review option**, not a provisioning decision. A Standard host is more appropriate than the 1 GB Basic tier because it must run a Node application plus database, object storage, and email-capture services concurrently. The Cloud Computer rate card lists Basic at $10/month and Standard at $30/month; both include a separate public IP, with storage and traffic overages possible. [3]

## 3. Required Resource Boundary

For the working example instance **`coachqa`**, each resource must be new, empty, and owned by the preview environment only. No production credential, database dump, bucket, Stripe key, webhook secret, Resend key, Manus OAuth setting, or Forge credential may be copied into this environment. [1]

| Resource | Required identity and scope | Runtime permissions | Explicit exclusions |
|---|---|---|---|
| Application host | Separate private origin, never `boogme.com`; Node 24 and pnpm 10.4.1 | Reads only preview secret set | No automatic publication to production domains |
| Database | `boogme_preview_coachqa`, empty at bootstrap | `preview_app` receives CRUD on preview tables and read-only marker access | No privilege on production schemas; no DDL or marker writes at runtime |
| Bootstrap DB credential | One setup-only credential | Creates the isolated baseline and marker only | Removed or disabled after successful bootstrap; never used by app runtime |
| Object storage | `boogme-preview-coachqa`, empty and S3-compatible | Bucket-restricted marker read plus scoped object reads/writes | No production bucket access or bucket-listing permission at runtime |
| Object policy | `public/` can serve avatars/thumbnails; `private/` must remain non-public | Five-minute presigned private reads only | No anonymous bucket-root, marker, listing, or `private/*` access |
| Email capture | Mailpit on the private service network, with its UI only via loopback/SSH tunnel or authenticated private proxy | Application can call only its capture endpoint | No SMTP relay, forwarding, Resend fallback, or owner notification delivery outside Mailpit |
| Jobs and payments | `APP_ENV=preview` blocks scheduler import/startup and blocks Stripe clients before network use | None | No scheduled reminders, payouts, Checkout, Connect onboarding, webhook endpoint, or payment API traffic |

Mailpit exposes a browser UI and REST API, while its send endpoint can be separately controlled. Its documentation explicitly warns that a network-reachable UI/API should use host restrictions and/or UI authentication. The preview design therefore keeps it on the private service network and uses a private access mechanism for inspection rather than exposing a public inbox. [4] [5]

## 4. Permissions and Network Controls

The host must use separate service identities rather than a shared administrator credential. The application should communicate with the database, object store, and Mailpit only on a private Docker/service network. The public-facing preview origin, if enabled, should terminate HTTPS at a reverse proxy and require private access; the Mailpit UI, database port, object-store console, and object-store API must not be directly internet-accessible.

| Control | Verification required before startup | Failure response |
|---|---|---|
| Database grants | Show that `preview_app` has no production-schema privileges and cannot create/alter tables | Stop; correct grants or recreate the isolated credential |
| Storage policy | Show that only `public/*` is anonymously readable and `private/*` is not | Stop; correct policy or recreate the isolated bucket |
| Email containment | Confirm Mailpit has no forwarding or relay configuration and that the UI is private | Stop; remove external delivery path |
| Build configuration | Build from `.env.preview` with preview public settings; do not reuse a production bundle | Stop; rebuild using only preview settings |
| Background work | Startup logs show jobs disabled before scheduler import | Stop process; do not exercise flows |
| Payment containment | Logs/tests show Stripe clients reject before network activity; preview has no Stripe secrets | Stop; remove the offending configuration |

## 5. Controlled Rehearsal After Approval

The following sequence is intentionally staged. No phase begins until the prior phase produces the listed evidence.

| Phase | Action | Evidence returned | Prohibited actions |
|---|---|---|---|
| 0. Source lock | Record final GitHub commit after the missing fix is pushed and reviewed | Commit SHA, PR stack relationship, review approval | Merge to `main`, sync into current production project |
| 1. Provision | Create the approved separate host and empty resources | Resource names, private origin, credential scopes, no credentials | Production resource reuse or data copy |
| 2. Preflight | Verify database grants, empty database/bucket, storage policy, and private Mailpit path | Redacted grant/policy and emptiness checks | `db:push`, historical migrations, production queries |
| 3. Bootstrap | Run only `preview-bootstrap.ts --initialize-empty-preview` from the final source checkout | Successful marker and baseline output | Reset/retry-on-shared resources or import production data |
| 4. Build and start | Build using preview settings and run the isolated server | Build result, startup resource checks, disabled-job evidence | Production client bundle, silent port changes, public Mailpit exposure |
| 5. Acceptance | Run the synthetic account, access-control, upload, private-file, and payment-blocking checks | Redacted results and logs listed below | Real users, real coach payouts, payment/onboarding, production data mutation |
| 6. Review | Astra reviews the evidence before more product testing | Review outcome and any follow-up fixes | Promotion to production |

## 6. Required Acceptance Evidence

The rehearsal must return a concise evidence package containing the final source commit; preview URL; actual preview database and bucket names; redacted credential scopes; private inbox access method; startup checks; and test results. The package must show that the following conditions passed using **synthetic `.invalid` accounts only**:

1. Homepage, native sign-in, and coach browse work without Manus OAuth.
2. Student A and Student B can register, receive verification and password-reset links only in Mailpit, sign in, and sign out.
3. A synthetic coach can be created through the non-payment path; avatar and thumbnail objects use the preview bucket.
4. Public media resolves only from `public/`; a private object rejects anonymous access, permits an authorized signed read, and expires.
5. Student A cannot access Student B’s protected preview records or files.
6. Payment and onboarding actions fail before Stripe network activity; no preview webhook signing secrets exist.
7. Scheduler/reminder/payout jobs do not start.
8. The preview database and bucket contain only synthetic preview records and files. Production permissions are not exercised as a negative test.

## 7. Decision Requests

Before any infrastructure work, Coach must approve the following decisions:

| Decision | Recommended value | Why it is needed |
|---|---|---|
| Hosting approach | A: separate Standard Cloud Computer | Supports the full private application, database, object-storage, and Mailpit boundary in one controlled host |
| Preview instance | `coachqa` | Determines unique database, bucket, markers, and URL labels |
| Visibility | Private HTTPS preview; no production domain | Keeps synthetic account and email testing outside public BooGMe |
| Source gate | Final PR #5 SHA that includes the recovered review fix and stacked PR #4 base | Prevents deploying a stale reviewed tree |
| Rehearsal scope | Accounts, native login, coach profiles, uploads, and access control only | Keeps Stripe onboarding and payments deferred to the later payment-sandbox phase |

## References

[1] [Astra isolated-preview phase 1 handoff](https://github.com/boogme-lgtm/chessmate/blob/astra/isolated-preview-1/docs/astra-isolated-preview-1-handoff.md)

[2] [Draft PR #5: Isolate preview data, email, storage and background jobs](https://github.com/boogme-lgtm/chessmate/pull/5)

[3] [Manus Cloud Computer setup and plan management](https://manus.im/app#settings/my-computer/create)

[4] [Mailpit Web UI and API configuration](https://mailpit.axllent.org/docs/configuration/http/)

[5] [Mailpit API v1 documentation](https://mailpit.axllent.org/docs/api-v1/)
