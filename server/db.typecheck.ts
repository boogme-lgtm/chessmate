/**
 * Compile-time signature guards for server/db.ts exports.
 *
 * This file is included by tsconfig.json (unlike *.test.ts files, which are
 * excluded). It uses assignability checks to assert that key db exports have
 * the expected signatures. If a function is removed, renamed, or its
 * signature changes incompatibly, tsc --noEmit will fail here.
 *
 * Sprint 41 context: the watch-mode false positive was caused by a stale
 * tsBuildInfoFile (now moved to .tsbuildinfo at project root). This file
 * provides a permanent compile-time guard so that any future regression
 * is caught by tsc, not just by the runtime test in sprint41.test.ts.
 *
 * Add new entries here whenever a critical db helper is introduced.
 */

import type { clearLessonCheckoutSession } from "./db";

// Assert that clearLessonCheckoutSession accepts a number and returns Promise<number>.
// The type alias below will produce a tsc error if the signature changes.
type _ClearLessonCheckoutSessionSig = typeof clearLessonCheckoutSession;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _clearLessonCheckoutSessionCheck: (lessonId: number) => Promise<number> =
  null as unknown as _ClearLessonCheckoutSessionSig;
