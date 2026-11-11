# Phase 7 release audit — before stabilization changes

Audit started 11 November 2026. Scope: all 11 actual publishable packages, their
source/public declarations, exported subpaths, four consumer scripts, tests, CI, Changesets, examples, Phase 6 implementation and evidence. This directory has no
Git repository/remote; no repository URL or scope ownership is inferred from its name.

## Actual inventory

All package versions initially are 0.1.0, MIT, public scoped ESM, sideEffects false.
The root and example applications are private. There are no other publishable workspaces.

| Package | Public entry points | Internal runtime/peer requirements |
| --- | --- | --- |
| @valixa/core | . | None |
| @valixa/auto | . | core dependency |
| @valixa/devtools | ., /panel | core dependency |
| @valixa/react | ., /auto, /devtools | core; optional auto/devtools peers |
| @valixa/mui | ., /x, /auto | core/react; optional auto and MUI X peers |
| @valixa/vue | ., /auto, /devtools | core; optional auto/devtools peers |
| @valixa/vuetify | ., /auto | core/vue; optional auto peer |
| @valixa/angular | . (APF) | core peer, tslib dependency |
| @valixa/angular-material | . (APF) | angular/core peers, tslib dependency |
| @valixa/angular-auto | . (APF) | core/angular/angular-material/auto peers, tslib dependency |
| @valixa/angular-devtools | . (APF) | devtools peer, tslib dependency |

Installed framework lines: React 19.2, MUI 7.3, MUI X 8.29, Vue 3.5,
Vuetify 3.13, Angular/Material 21.2. Do not broaden peers without testing.
Non-Angular packages expose typed ESM under dist and include source/maps/docs/license.
Angular uses partial-Ivy FESM2022/types/maps, packed from ng-packagr dist output.
Root Angular manifests currently lack explicit types/files/engines; ng-packagr generates
some fields, but the release metadata needs normalization and tarball validation.

## Phase 6 independently checked

Read actual normalization/renderers, core event hooks, inspection redaction and panel,
not just the previous report. `pnpm check` rerun before stabilization: 186 passing
tests in 30 files, strict declarations/framework example typechecks and JS/TS examples.
Full raw log: artifacts/phase-7-baseline-check.log. Prior Phase 6 browser/consumer
logs are evidence of prior runs only; final Phase 7 gates will be rerun.

Fields use scoped subscriptions; actions use form state. Row keys preserve identity;
reset clears drafts. Core events record real owners/timers, with no values/messages.
DevTools requires explicit attachment, redacts by default, bounds history/traversal,
uses text nodes and clears subscriptions/data. No runtime network/storage/eval or
HTML injection API was found in shipping code. Source declarations match root/subpath
exports; optional subpaths remain outside manual root exports.

## Critical release blockers

- Repository identity is absent; repository/homepage/bugs metadata cannot be truthfully
  populated and a protected trusted-publisher workflow cannot target a verified repo.
- Scope permission/trusted publishing has not been verified. Public GETs returned 404
  for all 11 exact npm names; 404 does not establish scope ownership or publish rights.
- No approved, verified immutable release artifacts/version manifest exists yet.
  Current workspace peer ranges still target 0.1.x; a 1.0 version preparation must
  update all internal ranges and re-run installed consumers, not just change versions.
- No release workflow, protection/approval policy, RC procedure or rollback plan exists.

## High-priority issues

- Current dependency audit exits 1: two moderate advisories in Angular CLI tooling:
  glob GHSA-3g3m-2fjr-6pw4 (13.0.7), minimatch GHSA-g3hv-75wg-m249 (10.2.6).
  Patch compatibility must be verified; do not suppress advisories. These are build
  tooling paths, not dependencies of the zero-dependency core runtime.
- All packages lack repository/homepage/bugs/keywords. New Angular packages lack
  descriptions; Angular root metadata needs explicit engines/types/files policy.
- Changelog ends with a stale claim that only Phase 1 is implemented.
- Existing browser gate runs Chromium only. Firefox/WebKit and React/Vue hydration
  coverage are not established; Angular example hydrates its prerendered native route.
- Existing independent consumers cover manual/framework/Auto/DevTools contracts but
  need release-version and full tarball safety checks; vanilla core is not a separately
  named clean consumer. React/Vue Auto consumers currently prove SSR, not independent
  production bundling. Final verification must fill or clearly report these gaps.

## Recommended improvements

- Automated package discovery and release artifact SHA-512 manifest; reject private
  workspaces, unexpected files, absolute source-map paths, workspace/file references,
  missing exports, inconsistent versions, secrets and incomplete metadata.
- Snapshot the initial public declaration surface for a compatibility report.
- Protected, manually dispatched, tokenless OIDC release workflow with explicit
  approved versions, required checks and provenance. No tag-triggered publication.
- Practical installation/migration/troubleshooting/security/contributing guides;
  preserve existing actual framework guides rather than invent conceptual APIs.

## Acceptable documented limitations

- ESM only; no CommonJS promise. Plain acyclic domain data; Date/File conversions explicit.
- Client validation is not a server authorization or input-validation boundary.
  Schema/custom renderers/validators are trusted application code, not remote executable schemas.
- Angular multiple autocomplete unsupported; custom keys and Vue generic component
  boundaries have documented type limits. DevTools is development opt-in, not remote
  inspection/time travel. Caller-held snapshots cannot be revoked on detach.
- Browser timings include automation/UI/host effects; no fragile CI timing thresholds.
- Linux/Node matrix success and Firefox/WebKit/untested hydration cannot be claimed
  from the existing Windows Chromium logs.

## Stabilization policy

No new product features. Fix security/packaging defects, verify existing contracts,
prepare coherent versioning and concrete candidate artifacts. Keep unproven/experimental
packages out of automatic stable versioning. Publication remains gated by completed
verification, repository/scope permission and approval of an exact package/version list.
