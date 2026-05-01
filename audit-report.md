# pnpm audit --prod (May 1, 2026 — post-R3 patch)

**Summary:** 24 vulnerabilities found  
**Severity:** 3 low | 18 moderate | 3 high

## Changes from Round 2

- **axios** upgraded from 1.12.2 to 1.15.2. The direct high-severity advisory (SSRF via crafted URL) is resolved.
- Total vulnerabilities reduced from 27 to 24 (4 high → 3 high).

## High Severity (3) — All Transitive

| Package | Advisory | Via | Patched |
|---------|----------|-----|---------|
| path-to-regexp@0.1.12 | ReDoS via multiple route params (GHSA-37ch-88jc-xwx2) | express@4.21.2 | >=0.1.13 |
| lodash-es@4.17.21 | Code Injection via `_.template` (GHSA-r5fr-rjxr-66jc) | streamdown → mermaid → langium → chevrotain | >=4.18.0 |
| lodash@4.17.21 | Code Injection via `_.template` (GHSA-r5fr-rjxr-66jc) | recharts@2.15.4 | >=4.18.0 |

## Moderate (18) — All Transitive

Primarily via `streamdown → mermaid` (DOMPurify, d3, dagre, mdast-util-to-hast) and `recharts → lodash`. These are client-side rendering dependencies with no server-side attack surface in our usage.

## Low (3)

| Package | Advisory | Via |
|---------|----------|-----|
| nodemailer@7.0.11 | SMTP command injection (GHSA-c7w3-x93f-qmm8) | resend@6.9.1 → mailparser |
| follow-redirects@1.15.11 | Exposure of credentials (GHSA-xxx) | axios@1.15.2 |
| cookie@0.7.2 | Accepts out-of-spec characters (GHSA-xxx) | express@4.21.2 |

## Actionable Follow-ups

1. **Express 5 migration** — Express 5 is now stable and the default on npm (`npm info express version` → 5.x). Migrating resolves the `path-to-regexp` ReDoS advisory. This is an actionable task, not a "wait for stable" item.
2. **lodash/lodash-es** — Deep transitive via mermaid and recharts. No user-controlled `_.template` calls exist in our code. Monitor upstream for patches; consider replacing recharts with a lodash-free charting library if the advisory persists.
3. **resend SDK** — `mailparser` pulls in vulnerable `nodemailer`. We don't parse untrusted emails. Monitor for resend SDK updates.

## Non-Exploitable Assessment

None of the remaining 3 high-severity findings are directly exploitable in our codebase:

- **path-to-regexp**: Only Express's internal routing uses it. Our routes are static strings, not user-controlled patterns. ReDoS requires attacker-controlled route definitions.
- **lodash/lodash-es `_.template`**: Code injection requires passing attacker-controlled input to `_.template()`. Neither our code nor our transitive dependencies expose this to user input.
