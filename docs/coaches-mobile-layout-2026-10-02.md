# Coach browse mobile layout evidence — 2026-10-02 UTC

Base: `38e9560899e4442ca7157a19e7aa2bf0c2b076ac`, verified as remote main.
Independent branch: `codex/coaches-responsive-layout`, separate checkout in `task-6/chessmate`.
PR #8's navigation source and Vitest configuration are not included or modified.

## Reproduction before editing

Installed Chrome `154.0.8037.93` rendered the exact-main frontend on a loopback server with synthetic anonymous coach responses. At 320px and 360px, grid, list and empty results measured **380px** document width. The nonwrapping sort group placed Newest's right edge at **379.67px**, and its view buttons overlapped other sort controls. A temporary browser-only wrapping probe reduced the 320px document width to **320px**, confirming the cause before source edits. Loading separately measured **408px** because the `w-96` heading skeleton extended from x=24 to x=408. At 768px and 1440px all baseline page widths matched their viewport.

The narrow cards also clipped statistics and squeezed their names. Existing evidence from `task-5/browser-evidence` and `docs/coaches-mobile-navigation-2026-10-02.md` records the same 60px ready-state overflow before and after the independent navigation change.

## Correction

Only `client/src/pages/CoachBrowse.tsx` changes product behavior: allow both sort rows to wrap, bound filter/sort labels and allow long words to wrap, stack card photo/info below `sm`, wrap card statistics/CTA and long bio/specialty text, and constrain the loading heading to its container. No page overflow hiding is added. Existing header, routes, filtering, sorting and grid/list state remain intact. Desktop cards retain side-by-side panels and existing photo widths.

`scripts/coaches-layout-browser.cjs` adds an executable browser regression without changing dependencies or the Vitest configuration. After building, run it with Playwright available; `PLAYWRIGHT_MODULE_PATH` and `CHROME_EXECUTABLE` can select existing local installations. Its optional first argument is the evidence output directory.

## Completed checks

| Check | Result |
| --- | --- |
| Browser widths 320/360/768/1440 × 900px | PASS: document width equals viewport for grid/list, filtered empty/reset, empty API results, loading/ready and extended labels |
| Controls and card content | PASS: controls fit without overlap or clipped labels; card text ranges fit inside card bounds except intentional existing name ellipsis |
| Keyboard | PASS: every browse control in Tab order; Enter/Space filter, reset, sort and grid/list; existing Home Enter routing |
| Routing | PASS: card click routes to `/coach/901`; Home routes to `/` |
| Browser errors | No uncaught page errors |
| Existing browse and matching tests | PASS: 48 tests |
| TypeScript `tsc --noEmit` | PASS |
| Vite frontend build | PASS; existing large-bundle warning remains |
| esbuild server bundle | PASS |
| Aggregate Vitest suite | PASS: 815 tests; 63 files passed, two opt-in connection tests skipped |
| New browser regression against exact main | Expected FAIL at first geometry assertion: `380 !== 320`; corrected build PASS at all four widths |
| `git diff --check` | PASS |

All browser data are **mocked**, not live. Only anonymous GET requests are fulfilled for `auth.me`, `coach.listActive` and `student.getProfile`; all external requests are blocked. The logo is a synthetic 128×32 SVG and fonts use fallbacks. Long-label stress changes DOM text while retaining real React handlers, using extended phrases plus an unbroken 108-character token. Evidence is outside the repository in `task-6/browser-evidence/before` and `after`, with JSON geometry and viewport screenshots. Baseline diagnosis script is `task-6/browser-diagnose.cjs`.

The 815-test count excludes PR #8's three navigation tests because this branch is based directly on main. Full-suite validation restored unchanged schema/SQL to their manifest-verified Git bytes; neither file has a source delta. Local logs: `aggregate-tests.log`, `server-build.log`, `browser-baseline-regression.log` and frontend/typecheck/browse logs under `task-6`. Browser regression failure uses an exact-main detached local checkout, the same harness and isolated build settings.

**UNRUN:** other browsers, physical devices, screen-reader software, live queries/assets, authenticated matching, Manus and production acceptance. Existing Home naming/inert hamburger defects on main remain the separate PR #8 scope; this layout task does not claim to repair them. Existing card click behavior is tested; cards do not gain keyboard semantics in this correction.

## History and boundary

The first local clone command requested a local `main` branch absent from the source clone; retrying without that branch and selecting the exact base SHA succeeded. Git's checkout conversion left CRLF in two files whose blobs use LF; those two files were restored to identical canonical Git bytes before baseline validation. Installed dependencies were copied from `task-5` with pnpm junctions relocated, without new installation or credentials.

The sandboxed baseline build failed on esbuild ancestor-directory reads. Scoped execution review admitted the same clean, network-blocked wrapper; the baseline and corrected frontend builds passed. Validation uses synthetic settings, disables Manus tooling, omits optional analytics, and blocks network connections. No host/network/security settings, secrets, live accounts or production services were changed. No merge, deployment, Manus API operation or PR #6/#8 branch modification occurred.

The parent requested a visible checkpoint after progress commentary did not reach it. The first checkpoint committed at `11f66670a30779b9b1eb1f32138e9de13bb21945`, preserving its handoff. On resume, server/full-suite and baseline-failure checks completed. A PowerShell quoting error stopped one setup command before execution; splitting setup into explicit files/commands succeeded. The original checkpoint remains intact; final publication provenance is recorded outside this file to avoid self-referential commit identifiers.
