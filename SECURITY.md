# Security policy

Before a verified stable publication, all versions are release candidates. After
1.0.0 is published, security fixes target the latest supported 1.x release.
Use the exact tested peer ranges; untested major versions are not implied support.

Report vulnerabilities privately through the repository's GitHub Security Advisories
when enabled, or contact the repository owner through GitHub to arrange a private
report. Do not post passwords, tokens, user data or exploit details in public issues.
Private vulnerability reporting must be enabled by the repository administrator
before public release; no response-time SLA is claimed.

## Trust boundaries

- Client validation helps UI correctness. Revalidate and authorize all requests on
  the server. Never trust client success, hidden/disabled flags or submitted JSON.
- Schemas, validators, codecs and custom renderers are trusted application code.
  Do not execute callbacks or component names supplied by an untrusted remote source.
  Place application limits on untrusted schema size and input size/depth.
- Domain values are copied/frozen plain acyclic data. File/Date/third-party objects
  require explicit conversion boundaries. Reserved nested path segments are rejected.
- Generated labels/errors are rendered as text. Custom renderers remain responsible
  for escaping, accessibility and any deliberate HTML rendering.
- DevTools is explicit development opt-in. Default values/messages are redacted;
  structural schema metadata is visible. Do not put credentials in labels, rule
  parameters, field names or form names. Never attach broad value/message allowlists
  to sensitive production data. Screenshots can disclose opted-in current data.
- No built-in telemetry/network/persistence exists. Application validators/submit
  handlers can make network calls; their authorization, cancellation and logging
  policy remain application responsibilities.

## Dependency and release security

`pnpm audit --audit-level=low` remains enforced. Phase 7 upgrades affected build/test
tool glob/minimatch ranges through documented overrides; advisories are not ignored.
See docs/phase-7-security.md for findings and actual audit evidence.

Release uses exact lockfile installs, immutable action pins, checked tarballs and a
manually dispatched workflow. Configure required environment reviewers and npm OIDC
trusted publishers before publishing. No npm tokens belong in this repository.
The release helper refuses local execution and unapproved versions. No tag triggers
publication. If credentials are compromised, revoke them through the service's own
UI; do not paste them into an issue or support conversation.
