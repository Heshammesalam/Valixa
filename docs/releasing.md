# Release procedure, approval and rollback

## Version train

All 11 packages use fixed versions. The prepared candidate is **1.0.0-rc.1**, dist-tag
**next**; stable target is **1.0.0**, dist-tag **latest**. A candidate is not silently
promoted, and preparation does not publish it. Optional documented capabilities are
not promises of unsupported controls/framework majors. If a package fails criteria,
do not move it to stable automatically; revise the approved inventory explicitly.

Historical pre-1.0 Changesets are archived in docs/releases/pre-1.0-changesets.
After the first stable release use pnpm changeset and Changesets' fixed train for
patch/minor/major changes. Before first publication only the deliberate preparation
script changes versions and compatible internal ranges.

## Publication order

Use `publicationOrder()` in scripts/release-lib.mjs. Current deterministic order:
core; auto/devtools/angular; angular-devtools/angular-material/react/vue;
angular-auto/mui/vuetify. Packages within a layer have no unresolved internal runtime
or peer requirements; actual manifest order is authoritative.

## Reviewable local candidate

```sh
pnpm release:prepare -- --version 1.0.0-rc.1 --repository https://github.com/Heshammesalam/Valixa
pnpm install --frozen-lockfile
pnpm check
pnpm examples:build
pnpm exec playwright install chromium firefox webkit
pnpm test:browser
pnpm test:browser:release
pnpm test:packages
pnpm audit --audit-level=low
pnpm benchmark
pnpm benchmark:compare
pnpm benchmark:phase6
pnpm release:check
```

If manifest preparation changes lockfile-relevant ranges, run pnpm install once and
review the lockfile before the frozen CI run. All other CI installs are frozen.
The inspection command creates actual tarballs and an ordered SHA-512/file inventory
in artifacts/release/manifest.json. Candidate mode can report missing external metadata;
strict release mode rejects incomplete metadata. Neither mode proves npm permissions. `pnpm release:verify` runs every required gate and saves actual exit codes/counts in artifacts/release/verification.json; the publish helper requires this evidence for the same CI source SHA.

The release notes, readiness verdict, exact names/versions, checksums and unresolved
risks must be presented for approval. A general intent to publish is not proof that
external prerequisites or exact immutable artifacts have been verified.

## External prerequisites (admin actions)

1. Confirm the repository identity/visibility and review the pushed source commit.
2. Enable private vulnerability reporting. Configure main branch protection and
   required successful CI checks for the final SHA.
3. Create `npm-release` in GitHub Environments, require explicit reviewer approval,
   restrict deployment branches to main, and decide whether self-review is acceptable.
   Prefer a separate reviewer when the team supports one. Verify configuration in UI.
4. Authenticate to npm through its normal web login flow on the maintainer's device;
   never paste tokens/passwords into chat, scripts, commits or CI secrets. Verify rights
   as public unscoped packages from the maintainer account; 404 name lookups are not a name reservation.
5. Configure npm trusted publishing for each approved package using owner
   **Heshammesalam**, repository **Valixa**, workflow **release.yml**, environment
   **npm-release**. Verify the initial-package bootstrap path with npm's current UI.
   The workflow has no long-lived-token fallback. If initial package/trust setup needs
   a maintainer action, complete that explicitly rather than weakening the workflow.
6. Verify npm CLI supports OIDC and public provenance. The public repository and
   package repository.url must match. New publisher configurations have a validation
   expiry; consult the current official npm documentation before dispatch.
7. Only after those checks, set the repository Actions variable
   `VALIXA_RELEASE_READY` to `true`. Its default absence disables the publish job;
   this explicit admin gate is not a substitute for required environment reviewers.

## Exact publishing workflow

After explicit approval of all 11 names at 1.0.0-rc.1 and completion of prerequisites,
dispatch **Approved npm release** on main with input `version: 1.0.0-rc.1`.
The verify job runs all gates before the protected publish job can request approval.
The publish helper executes, in dependency order, the equivalent of:

```sh
npm publish artifacts/release/valixa-1.0.0-rc.1.tgz --ignore-scripts --access public --tag next --provenance --registry https://registry.npmjs.org/
```

It checks exact checksums and registry preflight first, then verifies each registry
version/integrity. Do not execute these commands from an unverified local build.
Do not invoke node scripts/publish-release.mjs locally; it deliberately refuses.
This document prepares the action and is not a record that publication occurred.

For stable, explicitly approve `1.0.0`, run release:prepare with --version 1.0.0,
refresh/review the lockfile, rebuild/retest/repack all consumers and dispatch the same
workflow with input `1.0.0`. It uses latest and verifies new immutable stable tarballs.
Do not label an rc version as stable by merely moving a tag.

## Partial failures, rollback and deprecation

npm versions are immutable. Never overwrite an existing version. A partial failure
leaves already published packages recorded in registry-confirmations.json. Stop,
inspect registry state/permissions and prepare a reviewed recovery plan; the default
helper refuses to blindly skip or republish existing versions. Do not issue a broad
unpublish to hide a problem.

For a defective release, publish a corrected patch/candidate under a new version,
then explicitly approve moving the affected dist-tag back/forward as appropriate.
Deprecate known-bad exact versions with a clear upgrade message when warranted.
Both dist-tag changes and deprecations are public release actions requiring their
own concrete approval. OIDC dist-tag management may require additional trusted
publisher permission/npm CLI versions. Keep a registry confirmation for every action.

If a credential/trust relation is compromised, disable the publisher/revoke credentials
through the service UI, investigate the final artifacts, and disclose using the
security policy. A rollback must not erase evidence or claim unpublished code is safe.
