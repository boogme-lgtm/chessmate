# Sprint 49 Patch — Remove Committed Stockfish Binary

**Date:** 2026-06-09
**Branch:** `claude/sprint-49-pgn-viewer` (same branch, amend or new commit on top)
**Scope:** Housekeeping only — no functional changes, no new features.

---

## Problem

Sprint 49 committed two Stockfish binary files directly into git:

```
client/public/stockfish/stockfish-18-lite-single.js   (~20KB)
client/public/stockfish/stockfish-18-lite-single.wasm (~7.1MB)
```

Committing large binaries to git is problematic: they bloat every clone of the repo
permanently (even after deletion, the history retains them), and the WASM file is
already available in `node_modules/stockfish/bin/` after `pnpm install`. There is no
reason to version it.

---

## Fix Required

### Step 1 — Remove the binary files from git tracking

```bash
git rm --cached client/public/stockfish/stockfish-18-lite-single.js
git rm --cached client/public/stockfish/stockfish-18-lite-single.wasm
# Also remove the directory if it becomes empty:
git rm --cached -r client/public/stockfish/ 2>/dev/null || true
```

### Step 2 — Add the stockfish directory to `.gitignore`

Append to `.gitignore`:

```
# Stockfish WASM — copied from node_modules at install time, not versioned
client/public/stockfish/
```

### Step 3 — Add a `postinstall` script to `package.json`

This copies the files from `node_modules` into `client/public/stockfish/` automatically
every time `pnpm install` runs (including on the deployment server).

In `package.json`, add a `postinstall` script:

```json
"scripts": {
  "dev": "NODE_ENV=development tsx watch server/_core/index.ts",
  "build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
  "start": "NODE_ENV=production node dist/index.js",
  "check": "tsc --noEmit",
  "format": "prettier --write .",
  "test": "vitest run",
  "db:push": "drizzle-kit generate && drizzle-kit migrate",
  "postinstall": "node scripts/copy-stockfish.mjs"
}
```

### Step 4 — Create `scripts/copy-stockfish.mjs`

Create a new file `scripts/copy-stockfish.mjs`:

```js
// Copies Stockfish WASM files from node_modules into client/public/stockfish/
// so they are served as static assets without being committed to git.
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const src = resolve(root, "node_modules/stockfish/bin");
const dest = resolve(root, "client/public/stockfish");

if (!existsSync(src)) {
  console.warn("[copy-stockfish] stockfish not found in node_modules — skipping.");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });

const files = [
  "stockfish-18-lite-single.js",
  "stockfish-18-lite-single.wasm",
];

for (const file of files) {
  copyFileSync(resolve(src, file), resolve(dest, file));
  console.log(`[copy-stockfish] Copied ${file}`);
}
```

### Step 5 — Verify the files are in the right place in node_modules

Before committing, confirm the source files exist:

```bash
ls node_modules/stockfish/bin/
```

Expected output should include `stockfish-18-lite-single.js` and
`stockfish-18-lite-single.wasm`. If the filenames differ in the installed version,
update the `files` array in `scripts/copy-stockfish.mjs` to match.

### Step 6 — Run the script manually to confirm it works

```bash
node scripts/copy-stockfish.mjs
ls client/public/stockfish/
```

Both files should appear. Then confirm the dev server still serves them:

```bash
# The component references /stockfish/stockfish-18-lite-single.js
# Vite serves client/public/ at the root, so this path is correct.
```

### Step 7 — Run tests and typecheck

```bash
pnpm test
pnpm check
```

Expected: 376 tests pass, tsc 0.

### Step 8 — Commit

```bash
git add .gitignore scripts/copy-stockfish.mjs package.json pnpm-lock.yaml
git commit -m "chore: replace committed Stockfish binary with postinstall copy script"
```

---

## Files to Touch

| File | Change |
|------|--------|
| `.gitignore` | Add `client/public/stockfish/` |
| `scripts/copy-stockfish.mjs` | **New file** — copies WASM from node_modules to public |
| `package.json` | Add `"postinstall": "node scripts/copy-stockfish.mjs"` |
| `client/public/stockfish/` | Remove from git tracking (`git rm --cached`) |

No changes to `PgnViewerModal.tsx`, `MessageThread.tsx`, or any test files — the
component already references `/stockfish/stockfish-18-lite-single.js` as a static
path, which remains correct.

---

## Acceptance Criteria

- [ ] `client/public/stockfish/` is listed in `.gitignore`
- [ ] The two binary files are no longer tracked by git (`git ls-files client/public/stockfish/` returns empty)
- [ ] `node scripts/copy-stockfish.mjs` runs without error and produces both files in `client/public/stockfish/`
- [ ] `pnpm install` (fresh) automatically copies the files via `postinstall`
- [ ] `pnpm test` passes (376 tests)
- [ ] `pnpm check` exits 0
- [ ] PGN viewer still works in the browser (board + engine eval render correctly)
