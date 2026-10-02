# Coach browse navigation evidence — 2026-10-02 UTC

Base: `38e9560899e4442ca7157a19e7aa2bf0c2b076ac` (remote main verified).
Branch: `codex/coaches-mobile-navigation`, in a separate local clone.
Acceptance context: `C:\boogme\ROADMAP.md` and `WORK_LOG.md`; shared documents were read and left unchanged.

## Verified defect and change

Before editing, exact-main source confirmed that `mobileMenuOpen` was only toggled, never used to render navigation. Below `sm`, Home's visible text was hidden without another accessible name. Browser reproduction confirmed two unnamed buttons at 320px; clicking the hamburger changed no menu or accessibility-tree content. Existing Home click navigation worked.

- `client/src/pages/CoachBrowse.tsx`: remove the inert hamburger/import/state and old spacer; explicitly name Home, mark its arrow decorative, and use three grid columns to center the logo. The existing `/` destination and browse behavior are preserved.
- `client/src/pages/CoachBrowse.test.ts`: three rendered-page regressions for Home's explicit name/decorative icon and the sole working header control with empty/populated data. All three failed on the original page and passed on the fixed page.
- `vitest.config.ts`: add client test discovery and automatic JSX transformation, which is needed to render the existing TSX page. No dependencies or separate test runner were added. Aggregate checks cover this shared configuration change.
- This evidence file records scope, checks, recovery and limits without rewriting shared company documents.

## Local checks

Node `24.19.0`, Vitest `2.1.9`, Vite `7.3.2`, TypeScript `5.9.3`; installed dependencies were copied from an existing local checkout with pnpm junctions relocated into this checkout.

| Check | Result |
| --- | --- |
| New navigation regressions | PASS: 3 tests |
| Existing coach browse and matching tests | PASS: 48 tests |
| Aggregate Vitest suite | PASS: 818 tests, 2 opt-in skips; 64 files passed, 2 skipped |
| `tsc --noEmit` | PASS |
| Both commands from `pnpm run build` | PASS: Vite frontend and esbuild server bundle |
| `git diff --check` | PASS |

Build commands ran with `APP_ENV=preview`, `MANUS_DEV_TOOLS_ENABLED=false`, optional analytics absent, a clean synthetic environment and external networking blocked. The existing large-bundle warning remains: the frontend JS bundle is about 1.52 MB (385 KB gzip). This build creates local artifacts only.

Equivalent focused commands are `pnpm test client/src/pages/CoachBrowse.test.ts --maxWorkers=2 --minWorkers=1` and `pnpm test server/sprint-browse1.test.ts server/coachMatching.test.ts --maxWorkers=2 --minWorkers=1`. Unit runs use `APP_ENV=development` and the repository's dummy test settings. Windows validation invoked the package scripts' underlying commands with Node rather than relying on shell-specific environment assignment.

## Browser evidence

Headless installed Chrome `154.0.8037.93`, Playwright, Windows; viewports were 320×900, 768×900 and 1440×900. A temporary loopback server served the built frontend. `auth.me` returned null and `coach.listActive` returned two synthetic coaches or an empty list; no mutations or real accounts were used. All external requests were intercepted/blocked. The external logo was replaced locally by a synthetic 128×32 SVG and external web fonts were blocked, so this proves header alignment with that asset and fallback fonts, not remote-asset availability.

| Width | Home: Tab/Enter, Space, click | Filter/sort/grid/list | Loading → ready / empty/reset | Logo center, before → after | Page width, before → after |
| --- | --- | --- | --- | --- | --- |
| 320 | PASS, `/` destination | PASS | PASS | 158 → 160px | 380 → 380px |
| 768 | PASS, `/` destination | PASS | PASS | 397.28125 → 384px | 768 → 768px |
| 1440 | PASS, `/` destination | PASS | PASS | 733.28125 → 720px | 1440 → 1440px |

After the fix, the header has one named `Back to Home` button, its logo is centered, and its width equals the viewport at all three sizes. The 320px screenshot confirms a visible native keyboard focus outline. No uncaught page errors occurred.

The **pre-existing 60px page overflow at 320px remains**. Sort controls and card content are cramped at that width; these are a separate browse-layout follow-up. This change adds no page overflow and does not claim that wider mobile-layout issue is fixed. Loading remains the existing skeleton and exposes Home after queries resolve.

Local evidence outside the Git repository, preserved under `task-5/`: `browser-check.cjs`, `browser-evidence/before/result.json`, `browser-evidence/after/result.json`, and viewport screenshots for grid, list, keyboard focus and loading. The browser harness asserts the accessible Home control, real keyboard/click routing, logo geometry, no added overflow, and browse interactions.

**UNRUN:** other browsers, physical devices, screen-reader software, live queries/remote assets, authenticated matching, production and Manus acceptance. PR #6's independent private QA is not repeated or represented by these results.

## Recovery history and boundary

1. A normal dependency copy followed pnpm junctions and duplicated files. It was stopped; the incomplete copy was moved aside within this workspace. A copy that preserves and relocates junctions completed (47,176 files; 2,554 junctions). The source checkout was not changed.
2. Windows sandbox esbuild ancestor-directory reads were denied before tests/build could run. Reviewed scoped execution of the same clean, network-blocked commands succeeded; no host permission, network or security settings changed.
3. Two browser harness attempts stopped before page rendering: the app redirects non-`localhost` HTTP URLs to HTTPS. Diagnostics identified the harness origin mismatch; using the supported `localhost` loopback origin succeeded, without changing app redirect logic or browser security settings.
4. Adjacent browse tests initially rejected wrapper `APP_ENV=preview` (missing preview instance), then `APP_ENV=""` (invalid mode). Source inspection identified `development` as the normal synthetic unit-test mode; the corrected run passed all 48 tests. No product configuration was changed to accommodate the tests.
5. A requested partial checkpoint paused work after validation commands launched. Their existing sessions were collected on resume: all focused/adjacent tests, typecheck and both build commands passed. Progress had been posted in commentary and saved locally but did not reach the parent; the checkpoint records that visibility limit.
6. Aggregate validation initially passed 817 tests with one schema-manifest checksum failure and two opt-in skips. The Windows checkout had CRLF bytes in `drizzle/schema.ts` and `preview/schema.sql`; their canonical LF hashes match both the unchanged Git blobs and manifest. A Git checkout attempt still applied CRLF, so the early rerun retained the same failure. After both files were explicitly restored to verified canonical LF bytes, the final aggregate run passed 818 tests with two skips. No schema, SQL or manifest delta is included in this change; the normal Windows checkout form was restored after validation. The final log is preserved locally as `aggregate-tests-final.log`.

No Manus API/service operation, production credential, new spending, merge, deployment, customer action, host/network/security-setting change, or PR #6 branch edit is part of this task. Exact published commit and PR identifiers are recorded in the draft PR and final local handoff after publication.
