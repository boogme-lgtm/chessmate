# BooGMe external security check and first repair

Reviewed September 14, 2026, at Coach's request. Target: `boogme.com`. Coach supplied the RansomNews scanner URL, not a saved results page. The observations below are independent public HTTP/DNS checks, not a reconstruction of that scanner's score or a penetration test.

## Findings observed

| Check | Observed result | Assessment/action |
| --- | --- | --- |
| HTTP homepage | 301 to `https://boogme.com/` | HTTPS redirection works on the tested path. |
| HTTPS homepage and sign-in | Both HTTP 200 | Public responses were reachable. This does not exercise account login or validate every TLS version/cipher. |
| HSTS | `max-age=31536000; includeSubDomains; preload` | Present at the public edge. The header's preload token is not proof of registration in browser preload lists. Preserve this setting. |
| MIME sniffing | `X-Content-Type-Options: nosniff` | Present at the edge. Also set it in the app so it survives hosting changes. |
| Framing protection | Neither `X-Frame-Options` nor CSP `frame-ancestors` present | Add same-origin framing protection to reduce clickjacking exposure. Check any legitimate Manus preview embedding before release. |
| Content Security Policy | Neither enforced nor report-only CSP present | Add narrowly scoped framing/base-URL/object protections now. A script/resource allowlist requires its own inventory and browser rehearsal. |
| Referrer policy | No response header on homepage/sign-in | Set an explicit policy limiting cross-origin referral data. Header absence alone does not imply that modern browsers currently send full URLs cross-origin. |
| Permissions policy | No response header on homepage/sign-in | Restrict unnecessary device use while retaining first-party camera/microphone capability for coaching. |
| Software identification | `X-Powered-By: Express` | Remove the unnecessary banner. This is minor hardening, not a standalone exploit or proof that Express cannot otherwise be identified. |
| Public anonymous cookies | No Set-Cookie on the sampled responses | Not a test of authenticated cookie flags, JavaScript cookies or tracking/consent behavior. |
| DMARC | `_dmarc.boogme.com` and `_dmarc.contact.boogme.com` returned NXDOMAIN from Google and Cloudflare public DNS resolvers | No DMARC policy observed at either the sender subdomain or its organizational parent. Prepare email-authentication configuration after identifying legitimate senders and alignment. |
| Sending-host SPF | `send.contact.boogme.com` TXT returned `v=spf1 include:amazonses.com ~all` | SPF exists at this sending host. Empty root TXT does not justify claiming that all mail authentication is absent. DKIM and actual alignment remain unverified. |
| Root MX/CAA | No answers from the Google public resolver | Inventory items, not evidence of a data breach. Root MX is not required merely to send from a subdomain; optional CAA hardening should follow certificate-provider inventory. |

The public build marker returned `ad135b59`. Current GitHub main at review is `cbf75a38ff097946b9c29cb999e7b00f543f25f2`, whose version file reads `c33cf592`. Do not equate the GitHub tip with a confirmed deployed revision. The repair is prepared against that main commit on `astra/security-headers-1`; it does not depend on PR #4 or PR #5 and makes no deployment action.

Only public page/version GETs and DNS reads were performed. No login, customer records, guessed credentials, exposed-secret probes, attack payloads or third-party paid scan were used. No Stripe, DNS, secret or production configuration was changed.

## Code repair

`server/_core/securityHeaders.ts` installs middleware before redirects, API handlers, webhooks and static assets:

- Disable Express's `X-Powered-By` header.
- Set `X-Content-Type-Options: nosniff`.
- Set `Referrer-Policy: strict-origin-when-cross-origin`. This retains origin-level referral needed by some embedded media while limiting cross-origin URL disclosure.
- Set `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`. Browser permission prompts remain required. No payment restriction is introduced.
- Set `Content-Security-Policy: frame-ancestors 'self'; base-uri 'self'; object-src 'none'` and `X-Frame-Options: SAMEORIGIN` by default.

This CSP does not restrict scripts, styles, network connections, workers, fonts or child iframe sources. In particular, `frame-ancestors` controls who can embed BooGMe; it does not block BooGMe from embedding a coach's video. This is **not a complete XSS mitigation policy** and must not be reported as one to a scanner or user.

HSTS remains owned by the existing HTTPS edge. We do not introduce `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` defaults that could affect OAuth popups, Stripe or the chess worker without testing those flows.

## Preview embedding and release gate

The default intentionally prevents another website from framing BooGMe. A legitimate Manus preview parent may need an exception. Identify its actual HTTPS origin from the browser and review it before deployment. Do not guess a wildcard Manus domain, copy a Referer/Origin request header into CSP, or weaken the public site solely to make an editor preview work.

If needed on a separately scoped preview instance, set `SECURITY_FRAME_ANCESTORS` to a comma-separated list of approved, exact HTTPS origins. The parser rejects credentials, paths, queries, fragments, wildcards and CSP separators. The list extends `'self'`; when it is present, the middleware omits X-Frame-Options because that legacy header cannot express the approved allowlist. Do not populate this setting with an example value on production.

Source review and explicit release approval are still required. Before release, verify homepage, native sign-in, Google sign-in, coach video, Stockfish analysis, checkout and the actual editor preview in a browser. After an approved release, re-read live response headers and confirm the edge preserves them. Any authorized local webhook check should use synthetic signatures and bytes; do not resend existing Stripe events under this task.

Tests exercise real local HTTP responses, same-origin and explicitly allowed framing settings, redirect/error headers, configuration injection rejection, and exact-byte Stripe verification with synthetic credentials. The handler remains after Express raw-body parsing, unchanged. Test results are in the PR. No dependencies, database schema or migrations change.

## Prioritized next work

1. Review and release the header repair with the browser/embedding checks above. A missing header is a hardening gap, not proof that an attack succeeded.
2. Prepare DMARC properly: identify every real sending service and From domain, validate SPF and DKIM alignment, choose an owned reporting destination, monitor, then move to an enforcing policy. Do not immediately publish `p=reject`, change existing SPF, or invent a reporting mailbox without checking legitimate delivery. DNS edits require their own concrete approval.
3. Inventory scripts, fonts, images, videos, Stripe, OAuth and Stockfish resources for a stricter CSP. Rehearse a report-only policy in the isolated environment, then enforce a reviewed allowlist. Protect reporting endpoints against abuse and avoid collecting sensitive URL tokens.
4. Preserve the higher-priority application protections: public API field allowlists, student/coach authorization, private content ownership, login/reset abuse controls, secret handling, dependency updates and recoverable backups. A surface scanner cannot verify these. Complete the separate preview review/resource gates before multi-account or booking tests.
5. Compare Coach's actual saved report/screenshots when available. Assess cookie/consent findings in a browser, and choose a monitored security contact before publishing `security.txt`. Do not treat absence of IPv6, HTTP/3, a public source repository, or a WAF badge as equivalent to exposed private records.

## Chess.com report and relevance

[Have I Been Pwned's September 13 entry](https://haveibeenpwned.com/Breach/Chess2026) describes an August 2026 dataset with approximately 7.3 million rows, roughly 4.6 million unique email addresses in its narrative, and names, locations and usernames. Its analysis suggests scraping; it is not proof that a current Chess.com production database was directly compromised. HIBP's rounded overview count differs from its narrative, so do not present 7.5 million as an exact count of distinct users.

No leaked dataset was located, downloaded, imported or distributed for this work. BooGMe should use public game/statistical data or participant-provided data for research. The engineering lesson is to minimize public fields and protect private emails and account identifiers even when profiles are intentionally public.

## Primary references

- [RansomNews's stated scanner scope and limitations](https://ransomnews.com/sitecheck/): a passive external overview, not a full audit.
- [Express production security guidance](https://expressjs.com/en/advanced/best-practice-security/): response-header defenses and software-banner limitations.
- [MDN Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy).
- [MDN CSP frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).
