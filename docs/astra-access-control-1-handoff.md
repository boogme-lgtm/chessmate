# BooGMe first repair: Manus handoff

Prepared September 7, 2026.

## Coach: what happens next

The first security repair is written and tested. Send Manus the GitHub link to this document in the existing BooGMe project. Manus should load the branch into a preview, check the existing website against the steps below, and return its preview link and results. Paste that response back into the Astra conversation.

You do not need to edit code, run commands, or handle credentials. This preview verifies one repair. The broader booking, payment recovery, and database work in the audit remains ahead.

## Collaboration

| Who | Responsibility |
| --- | --- |
| Astra | Plan each small change, write code, run tests, commit it, and assess preview results |
| Claude | Review the exact GitHub diff or help with a specific design/architecture question when needed |
| Manus | Synchronize the agreed GitHub revision into the existing project, run the preview, verify integrations, and handle deployment when requested |
| Coach | Make product decisions and check that the preview behaves as expected |

GitHub is the shared source of truth. Each handoff must name the branch and actual commit used. Any Manus or Claude code changes should return to GitHub with a new commit and a short explanation before the next handoff.

## Manus: task

Prepare a preview of the existing BooGMe app with this repair. Use the committed code and preserve any existing uncommitted project work before synchronizing. If the project contains newer changes, report the difference and reconcile it on the repair branch.

- Repository: `boogme-lgtm/chessmate`
- Branch: `astra/access-control-repair-1`
- Reviewed base: `f5854a3e2ed589f120aab5a72eaed96178947b3f`
- Obtain the repair commit from the branch/PR head and report its full SHA.
- Preview uses a test database, synthetic accounts/files, and test-mode integrations.
- This change requires no database migration, new dependency, or new environment variable.
- This handoff requests a preview and results. Production publication is a later step after review.

## What changed

1. Account responses from `auth.me`, `auth.login`, and `coach.getMyProfile` now use an explicit allowlist. Password hashes, verification/reset tokens, OAuth IDs, and Stripe account/customer IDs stay server-side. Profile fields and the onboarding-complete flag remain available.
2. Message send, read, and read markers all require the exact lesson/thread student or coach. Subscribing to a coach does not grant access to another student's conversation. Unread counts also filter by participation.
3. Removed `booking.getCoachAvailability`, `booking.createBooking`, and `contentRequest.updateStatus`. The current frontend uses `coach.getAvailability`, `lesson.book`, and the specific content workflow actions. Removed the unused dashboard mutation hook.
4. Request delivery checks for a linked fulfillment file owned by the request's coach, with a nonempty storage reference. It rejects invalid delivery before scheduling a payout.
5. Content download and library queries require the request coach to match the file owner. Old mismatched request/file links no longer grant access.

## Validation already completed

- TypeScript check: passed.
- Client and server production builds: passed.
- Full repository test suite: **706 passed in 55 files**, with outbound network blocked and dummy provider credentials.
- Focused router/content tests: 62 passed.
- Added 20 access-control tests. Replaced four obsolete generic-status tests with the retired-route coverage, and updated the valid delivery fixture to include its file.
- Nine checks of the actual generated SQL passed against isolated SQLite fixtures: unrelated unread counts and mismatched file grants are excluded, while legitimate access remains. This is not a MySQL integration test.
- Existing build warnings remain for unset local analytics variables and the large frontend bundle.

The repository's default tests exclude `server/webhook.test.ts`. Some older tests attempt provider calls and catch errors, so the full suite was run with an inherited Linux seccomp filter blocking outbound connections. Do not run those tests with live service credentials. Focused tests in `server/access-control.test.ts` mock the external services.

## Preview acceptance checks

Use synthetic Student A, Student B, and Coach C. Give both students a relationship with the same coach and separate threads.

1. Sign in, sign out, reload the page, and reopen the coach profile editor. Confirm profile prefilling and role navigation still work. Inspect account responses for the absence of credential fields.
2. Student A and Coach C can send, read, and mark their thread read. Student B cannot send into, read, mark read, or obtain unread counts for that thread, including when B subscribes to C.
3. Open the coach calendar and use the normal booking form with test data. Confirm it still calls the canonical availability/reservation procedures. Calls to the three retired procedures return NOT_FOUND.
4. Upload a fulfillment file for a paid synthetic request in progress, mark it delivered, and open it as the intended student. Confirm a request with no file or a file belonging to another coach cannot be marked delivered.
5. Confirm purchased content and correctly targeted private content still appear and open. A mismatched request/file ownership fixture must not appear in the student's library or issue a download URL.
6. Exercise the updated unread-count and content queries against the preview's MySQL database. Report any schema or query error instead of applying a speculative migration.

These checks do not establish that the remaining audit findings are fixed. In particular, overlapping booking prevention, timezone conversion, refund/payout recovery, recurring subscription billing, and migration repair are separate work.

## Return to Astra

Provide:

- The preview URL.
- The full GitHub commit SHA used and whether the Manus working copy differs.
- Pass/fail for the six checks, with any failure description.
- Any schema mismatch or integration configuration blocker, using variable names and status only.
- A link and commit SHA for any additional code change.

If Claude reviews this patch, ask for correctness and regression findings against the exact diff, especially response compatibility, message participation, and content ownership. Return any findings with file references.
