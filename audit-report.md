# pnpm audit --prod (Jun 7, 2026 — post-Sprint-41)

**Summary:** 26 vulnerabilities found
**Severity:** 2 low | 22 moderate | 2 high

## Changes from Previous Report (Sprint 40 patch 2 → Sprint 41)

- **`axios`** upgraded from `1.15.2` to `1.17.0`. Resolves 5 high advisories (shouldBypassProxy bypass, MITM via PROXY_URL, ReDoS, two Proxy-Authorization leaks). `axios@1.17.0` resolves `follow-redirects@1.16.0`; **`follow-redirects` no longer appears in `pnpm audit --prod`**.
- **`@aws-sdk/client-s3`** and **`@aws-sdk/s3-request-presigner`** upgraded from `3.1040.0` to `3.1063.0`. Resolves `fast-xml-builder@1.1.5` high advisory (attribute value quote bypass); new version bundles `fast-xml-builder@1.1.7+`.

## High Severity (2) — Both Transitive, No Fix Available

| Package | Advisory | Dependency Chain | Patched Version |
|---------|----------|-----------------|-----------------|
| `lodash-es@4.17.21` | Code Injection via `_.template` (GHSA-r5fr-rjxr-66jc) | `streamdown` → `mermaid` → `langium` → `chevrotain` → `@chevrotain/gast` | ≥4.18.0 (upstream has not released a fix) |
| `lodash@4.17.21` | Code Injection via `_.template` (GHSA-r5fr-rjxr-66jc) | `recharts@2.15.4` | ≥4.18.0 (upstream has not released a fix) |

Neither `recharts` nor `mermaid`/`streamdown` have released versions that drop or upgrade their lodash dependency. No `pnpm audit fix` is available.

## Moderate (22) — All Transitive

Primary sources:

- **`streamdown` → `mermaid@11.12.0`** (10 advisories): 7 × `dompurify` XSS/prototype-pollution bypasses (ADD_ATTR predicate, USE_PROFILES pollution, ADD_TAGS form bypass, FORBID_TAGS bypass, SAFE_FOR_TEMPLATES bypass, Prototype Pollution to XSS, mutation-XSS); 1 × `mdast-util-to-hast` unsanitised class attribute (via `react-markdown`); 4 × `mermaid` direct advisories (Gantt chart infinite loop DoS, `classDefs` CSS injection, configuration CSS injection, `classDef` state-diagram HTML injection). All are client-side rendering with no server-side attack surface.
- **`streamdown` → `mermaid` → `lodash-es`**: Prototype Pollution via array functions (separate from the high Code Injection advisory above).
- **`recharts@2.15.4` → `lodash`**: Prototype Pollution via array functions.
- **`resend@6.9.1` → `mailparser` → `nodemailer`**: SMTP command injection (GHSA-vvjj-xcjg-gr5g).
- **`express@5.2.1` → `qs@6.15.1`** (via `body-parser@2.2.2` and directly): remotely triggerable DoS — `qs.stringify` crashes on null/undefined entries in comma-format arrays when `encodeValuesOnly` is set. Patched in `qs@6.15.2`; blocked on Express 5 releasing an update.
- **`express-rate-limit@8.3.2` → `ip-address@10.1.0`**: XSS in `Address6` HTML-emitting methods. No fix available from `ip-address` upstream yet.
- **`resend@6.9.1` → `svix` → `uuid@10.0.0`**: missing buffer bounds check in v3/v5/v6.

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
2. **`qs` via Express 5** — `qs@6.15.1` is pinned by `express@5.2.1`. Watch for an Express 5.x patch that bumps `qs` to `≥6.15.2`.
3. **`ip-address` via `express-rate-limit`** — XSS in HTML-emitting methods; not reachable from our server-side usage. Watch for `ip-address@10.1.1+` or an `express-rate-limit` update.
4. **resend SDK** — `mailparser` pulls in vulnerable `nodemailer` (moderate) and is itself flagged low. We do not parse untrusted emails. Monitor for resend SDK updates.
