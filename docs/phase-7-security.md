# Phase 7 security findings

Reviewed shipping code, dependencies, package contents and release automation on
11 November 2026. This is a bounded engineering review, not a third-party certification.

| Area | Evidence / disposition |
| --- | --- |
| Prototype/path pollution | Reserved nested segments rejected; own-property reads/writes; atomic reserved-looking data keys copied safely. Existing tests plus atomic invalid-patch regression pass. |
| Mutation leaks | Copy/freeze boundaries, shared immutable snapshots and identity/notification tests retained. Plain acyclic values only. |
| Async races/validation bypass | Real job ownership, stale result rejection, timeout/reset/disposal tests retained. UI flags do not replace server validation. |
| Listener/resource cleanup | Core timers/controllers, keyed row disposal, framework ownership and panel/controller cleanup covered by deterministic tests. |
| Generated UI / XSS | Framework interpolation and textContent/SVG text nodes; no shipping eval/new Function/innerHTML. Hostile label/form-name regression renders text without an img element. Custom renderers are trusted application code. |
| DevTools data | Explicit attachment; values/messages redacted by default; sensitive descendants/file-like data protected; bounded current/history projection; no network/storage/telemetry/logger. |
| Package contents | Dry-run and actual tarballs inspected, export paths checked, source-map paths checked, credential-shaped content rejected; tests/logs/credentials excluded. |
| Supply chain | Frozen lockfile, immutable official action commits, least-privilege jobs, manual dispatch and protected release environment requirement, OIDC-only helper, immutable tarball hashes, registry integrity confirmation. |

## Dependency advisories and remediation

The initial `pnpm audit --json` exited 1 with two moderate advisories, no high/critical:

- [GHSA-3g3m-2fjr-6pw4: glob cancellation bypass](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4).
  The patched version is 14.0.2; affected glob appeared in Angular CLI package-json/
  cacache and Vue test tooling paths.
- [GHSA-g3hv-75wg-m249: minimatch amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249).
  The patched version is 11.0.1; affected paths also included ignore-walk.

Root pnpm overrides replace the advisory-affected ranges, not advisories themselves:
`glob@>=9 <14.0.2 → 14.0.2`, `minimatch@>=7 <11.0.1 → 11.0.1`.
These are cross-major tooling upgrades; their supported Node engine includes the
tested runtime. Strict Angular builds, APF consumption, Vue tooling and cross-browser
tests verify actual use. Reassess/remove overrides when upstream paths adopt fixes.
They are not runtime dependencies of the published zero-dependency core.

The subsequent full workspace audit exited 0 with **zero advisories**. Raw inputs:
artifacts/phase-7-dependency-audit.json and phase-7-dependency-audit-after.json.
An audit reflects the registry at execution time, not a permanent vulnerability guarantee.

## Release controls and external prerequisites

The release workflow is manually dispatched with an exact version; no push/tag
publishes. Verification rebuilds/tests/audits/packs on its own runner. Publish uses
the same-run immutable artifact set, a protected environment, OIDC permission only
in the publish job, no stored npm token, and SHA-512 confirmation against npm after
each publish. Its helper refuses local use and mismatched repository/version/artifacts.

The GitHub environment's required reviewers/branch protections and npm trusted
publisher configuration must be enabled and inspected on the services. A YAML
environment name alone is not an approval rule. Local npm whoami returned 401;
scope permission cannot be inferred from the GitHub account or package-name 404s.
These are publication blockers until verified. No advisory or auth failure is suppressed.

Official references checked: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/)
and [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).
The documented npm baseline for trusted publishing is npm 11.5.1+ / Node 22.14+;
the workflow uses Node 24 and must keep a sufficiently recent npm CLI.
