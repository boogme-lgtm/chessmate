# pnpm audit --prod (May 1, 2026)

**Summary:** 27 vulnerabilities found  
**Severity:** 3 low | 20 moderate | 4 high

## High Severity (4)

| Package | Advisory | Paths | Patched |
|---------|----------|-------|---------|
| path-to-regexp | ReDoS via multiple route parameters (GHSA-37ch-88jc-xwx2) | express@4.21.2 → path-to-regexp@0.1.12 | >=0.1.13 |
| lodash-es | Code Injection via `_.template` (GHSA-r5fr-rjxr-66jc) | streamdown → mermaid → langium → chevrotain → lodash-es@4.17.21 | N/A (transitive) |
| lodash | Code Injection via `_.template` (GHSA-43fc-jf86-j433) | streamdown → mermaid → dagre-d3-es → lodash@4.17.21 | N/A (transitive) |
| mailparser | Prototype Pollution (GHSA-7gmj-h9xc-mcxc) | resend@6.9.1 → mailparser@3.9.1 | N/A (transitive) |

## Assessment

- **path-to-regexp**: Express 4.x pins `path-to-regexp@0.1.x`. Upgrading to Express 5 resolves this. Express 5 is still in beta; monitor for stable release.
- **lodash/lodash-es**: Deep transitive dependency via mermaid (used by streamdown for markdown rendering). Not directly exploitable in our usage (no user-controlled `_.template` calls). Monitor for mermaid updates.
- **mailparser**: Transitive via `resend` SDK. Not directly exploitable since we don't parse untrusted emails. Monitor for resend SDK updates.

## Moderate (20) — All Transitive

Primarily via `streamdown → mermaid` dependency tree (DOMPurify, d3, dagre). These are client-side rendering dependencies with no server-side attack surface in our usage.

## Recommendation

No immediate action required. All high-severity findings are in transitive dependencies with no direct exploitation path in our codebase. Re-audit monthly and upgrade when upstream patches are available.
