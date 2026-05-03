# pnpm audit --prod (May 2, 2026 — post-Sprint-40 Express 5 upgrade)

**Summary:** 21 vulnerabilities found
**Severity:** 2 low | 17 moderate | 2 high

## Changes from Previous Report (Sprint 40)

- **express** upgraded from `4.21.2` to `5.2.1`. The `path-to-regexp@0.1.12` ReDoS high-severity advisory (GHSA-37ch-88jc-xwx2) is **resolved** — Express 5 bundles `path-to-regexp@8.x` which is not affected.
- Total vulnerabilities reduced from 24 to 21 (3 high → 2 high, 3 low → 2 low).
- The `cookie@0.7.2` low advisory (via `express@4.21.2`) is also gone.

## High Severity (2) — Both Transitive, No Fix Available

| Package | Advisory | Dependency Chain | Patched Version |
|---------|----------|-----------------|-----------------|
| `lodash-es@4.17.21` | Code Injection via `_.template` (GHSA-r5fr-rjxr-66jc) | `streamdown` → `mermaid` → `langium` → `chevrotain` → `@chevrotain/gast` | ≥4.18.0 (upstream has not released a fix) |
| `lodash@4.17.21` | Code Injection via `_.template` (GHSA-r5fr-rjxr-66jc) | `recharts@2.15.4` | ≥4.18.0 (upstream has not released a fix) |

Neither `recharts` nor `mermaid`/`streamdown` have released versions that drop or upgrade their lodash dependency. No `pnpm audit fix` is available.

## Moderate (17) — All Transitive

Primary sources:

- **`streamdown` → `mermaid`**: multiple `dompurify` XSS/prototype-pollution advisories, `lodash-es` prototype pollution, `mdast-util-to-hast` unsanitized class attribute — all client-side rendering with no server-side attack surface.
- **`recharts`**: `lodash` prototype pollution advisories — client-side charting only.
- **`resend`**: `nodemailer` SMTP command injection (GHSA-vvjj-xcjg-gr5g) via `mailparser`.
- **`axios`**: `follow-redirects@1.15.11` leaks custom authentication headers on cross-origin redirect (GHSA-r4q5-vmmm-2653).
- **`resend` → `svix`**: `uuid@10.0.0` missing buffer bounds check in v3/v5/v6.

## Low (2)

| Package | Advisory | Via | Advisory ID |
|---------|----------|-----|-------------|
| `mailparser@3.9.1` | Cross-site Scripting via HTML sanitization bypass | `resend@6.9.1` → `mailparser` | GHSA-7gmj-h9xc-mcxc |
| `nodemailer@7.0.11` | SMTP command injection via `mailparser` | `resend@6.9.1` → `mailparser` → `nodemailer` | GHSA-c7w3-x93f-qmm8 |

## Non-Exploitable Assessment

None of the 2 remaining high-severity findings are directly exploitable in our codebase:

- **`lodash`/`lodash-es` `_.template`**: Code injection requires passing attacker-controlled input to `_.template()`. Neither our application code nor any of the transitive dependencies (`recharts`, `mermaid`, `streamdown`) expose this function to user-supplied input. The lodash instances are used internally for utility operations only.

## Actionable Follow-ups

1. **lodash/lodash-es** — Monitor `recharts` and `streamdown`/`mermaid` upstream for releases that upgrade or remove their lodash dependency. Consider replacing `recharts` with a lodash-free charting library (e.g., `victory`, `nivo`) if the advisory persists and becomes a compliance concern.
2. **follow-redirects** (moderate) — Transitive via `axios@1.15.2`. Upgrade `axios` if a patched version of `follow-redirects` is released upstream.
3. **resend SDK** — `mailparser` pulls in vulnerable `nodemailer` (moderate) and is itself flagged low. We do not parse untrusted emails. Monitor for resend SDK updates.
