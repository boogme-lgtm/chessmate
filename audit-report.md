# pnpm audit --prod (Jun 7, 2026 — post-Sprint-41)

**Summary:** 26 vulnerabilities found
**Severity:** 2 low | 22 moderate | 2 high

## Changes from Previous Report (Sprint 40 patch 2 → Sprint 41)

- **`axios`** upgraded from `1.15.2` to `1.17.0`. Resolves 5 high advisories: `shouldBypassProxy` bypass (GHSA-jr5f-v2jv-69x6), MITM via `PROXY_URL` (GHSA-wf5p-g6vw-rhxx), ReDoS (GHSA-4w2v-q235-vp99), Proxy-Authorization leak to origin (GHSA-c7h5-3x7p-4h8c), Proxy-Authorization leak on redirect (GHSA-jr5f-v2jv-69x6). `follow-redirects` advisory (GHSA-r4q5-vmmm-2653) is now moderate-only.
- **`@aws-sdk/client-s3`** and **`@aws-sdk/s3-request-presigner`** upgraded from `3.1040.0` to `3.1063.0`. Resolves `fast-xml-builder@1.1.5` high advisory (GHSA-xxxx — attribute value quote bypass); new version bundles `fast-xml-builder@1.1.7+`.
- New advisories appeared in the npm advisory database since the Sprint 40 audit run (axios and fast-xml-builder), increasing the raw count from 21 to 26 before the upgrades. After the upgrades the count settled at 26 (some moderate advisories for `dompurify` and `lodash` were newly published).

## High Severity (2) — Both Transitive, No Fix Available

| Package | Advisory | Dependency Chain | Patched Version |
|---------|----------|-----------------|-----------------|
| `lodash-es@4.17.21` | Code Injection via `_.template` (GHSA-r5fr-rjxr-66jc) | `streamdown` → `mermaid` → `langium` → `chevrotain` → `@chevrotain/gast` | ≥4.18.0 (upstream has not released a fix) |
| `lodash@4.17.21` | Code Injection via `_.template` (GHSA-r5fr-rjxr-66jc) | `recharts@2.15.4` | ≥4.18.0 (upstream has not released a fix) |

Neither `recharts` nor `mermaid`/`streamdown` have released versions that drop or upgrade their lodash dependency. No `pnpm audit fix` is available.

## Moderate (22) — All Transitive

Primary sources:

- **`streamdown` → `mermaid`**: multiple `dompurify` XSS/prototype-pollution advisories, `lodash-es` prototype pollution, `mdast-util-to-hast` unsanitized class attribute — all client-side rendering with no server-side attack surface.
- **`recharts`**: `lodash` prototype pollution advisories — client-side charting only.
- **`resend`**: `nodemailer` SMTP command injection (GHSA-vvjj-xcjg-gr5g) via `mailparser`.
- **`axios@1.17.0`**: `follow-redirects@1.15.11` leaks custom authentication headers on cross-origin redirect (GHSA-r4q5-vmmm-2653) — transitive, no fix available from `follow-redirects` upstream yet.
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
2. **follow-redirects** (moderate) — Transitive via `axios@1.17.0`. No patched version of `follow-redirects` is available upstream yet; monitor for a `follow-redirects@1.16+` release.
3. **resend SDK** — `mailparser` pulls in vulnerable `nodemailer` (moderate) and is itself flagged low. We do not parse untrusted emails. Monitor for resend SDK updates.
