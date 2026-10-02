# Find Another Coach: editable saved preferences

Base: current main `a9220097cbd11bf069d9cd49e9375eebe6547227`.
Branch: `codex/find-another-coach-preferences`.

Saved matching preferences and recommendations now appear in `/find-another-coach`, reached from the existing dashboard Find Another Coach button or Coach matching navigation item. The main student dashboard no longer mounts the matching panel. Legacy `/dashboard#coach-matching` links redirect to the flow. Other dashboard sections and Book a Lesson retain their existing behavior.

Edit matching answers reuses `CoachMatchingAssessment`, the shared assessment type/schema, the original assessment JSON, and `student.saveQuizResults`. It prefills valid original answers independently; absent/malformed fields do not become derived/default profile answers. Zero values are preserved. Save is available at any question; Cancel, close and navigation discard unsaved edits. A failed write retains the draft and offers retry. Controls and answer updates lock during saving. After success, obsolete matching reads are cancelled and the profile is refreshed before recommendations are read. Dual-role accounts retain student access. No new questionnaire, schema migration, match scoring, production configuration or credentials are introduced.

## Verified checks

| Check | Result |
| --- | --- |
| Full Vitest suite | 966 passed; 2 opt-in connection tests skipped |
| Operations tests | 13 passed |
| TypeScript | Passed on final source |
| Vite client build | Passed on final source; existing large-bundle warning |
| esbuild server build | Passed |
| Chrome 154, recommendation regressions | Passed at 320, 360, 768, 1440 × 900 |
| Chrome 154, edit regressions | Passed at all four widths |
| Independent source review and re-review | Approved after fixes |
| Whitespace check | Passed |

Browser scripts are `scripts/student-matching-browser.cjs` and `scripts/matching-edit-browser.cjs`; build first, then run with local Playwright and Chrome (optional `PLAYWRIGHT_MODULE_PATH` and `CHROME_EXECUTABLE`). They intercept all APIs with synthetic fixtures and block external requests. Reads cover empty/error/retry, paused/offline states, missing/malformed/null answers, keyboard/native details behavior, profile freshness, interrupted navigation and obsolete first-request races. Edits cover prefilling/zero, absent fields, save/cancel/question back/navigation/reload, failure/retry, saving-time control locks, dual roles, legacy links, and releasing a frozen pre-save recommendation after current post-save results arrive. Only the original save endpoint accepts POST. No real users or services were exercised.

Local evidence is under `C:/Users/chess/Documents/Codex/2026-10-02/task-2`: `full-tests-final.log`, `ops-tests.log`, `typecheck-reviewed.log`, `client-build-reviewed.log`, `server-build.log`, `browser-reads.log`, `browser-edits-reviewed.log`, and `browser-evidence/{reads,edits}/results.json` plus screenshots. Desktop and 320px edit-error screenshots and narrow preference layout were visually inspected.

The first full run found a checkout-only CRLF hash mismatch in the existing preview baseline test. Normalizing local bytes to LF matched the existing manifest and Git content exactly; no schema/manifest changes enter this patch. Initial edit-browser request counting also sampled before the POST arrived; the assertion now compares write counts before click and after completion. All final checks passed. Reviewed validation used scrubbed inherited application settings, blocked external Node connections and disabled Manus tooling.

## Manual integration handoff

Integrate this isolated branch only after owner approval. Coordinate the two-line `StudentDashboard.tsx` import/mount removal with the separate Messages grouping work; `DashShell.tsx` and `App.tsx` contain matching navigation/route additions. Preserve Messages changes. No merge or deployment has been performed.

After integration, run the suite, typecheck/build and both browser regressions again. Owner/Manus acceptance still needs to verify the real signed-in account, persisted preferences across sessions, recommendation inventory, and desktop/mobile navigation in the integration environment. Physical devices, other browser engines, screen-reader software, live auth/services and production deployment were not tested. Do not change production settings, credentials or customer data for acceptance.
