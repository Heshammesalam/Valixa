# Phase 7 release readiness

Review date: 11 November 2026. **Verdict: NOT READY for public npm publication.**
The local candidate and an approved public npm release are different states.
No npm package, public release tag or GitHub release has been published by this work.

## Exact prepared inventory

All candidates are **1.0.0-rc.1**, tag **next**, MIT, public-scoped ESM, sideEffects false.
Stable target **1.0.0** is not automatically applied to these candidates.

| Order | Package | Entry points / dependencies |
| --- | --- | --- |
| 1 | @valixa/core | .; no runtime dependencies |
| 2 | @valixa/angular | . APF; core peer and tslib |
| 3 | @valixa/auto | .; core |
| 4 | @valixa/devtools | ., /panel; core |
| 5 | @valixa/angular-devtools | . APF; devtools peer and tslib |
| 6 | @valixa/angular-material | . APF; core/angular peers and tslib |
| 7 | @valixa/react | ., /auto, /devtools; core, optional auto/devtools peers |
| 8 | @valixa/vue | ., /auto, /devtools; core, optional auto/devtools peers |
| 9 | @valixa/angular-auto | . APF; core/angular/angular-material/auto peers and tslib |
| 10 | @valixa/mui | ., /x, /auto; core/react, optional auto/MUI X peers |
| 11 | @valixa/vuetify | ., /auto; core/vue, optional auto peer |

Repository created and verified public with owner admin access:
[Heshammesalam/Valixa](https://github.com/Heshammesalam/Valixa).
All manifests now carry that repository/directory, homepage, bugs URL, description,
keywords, license, typed exports, files, engines and public publish configuration.
Internal packed dependencies/peers target the matching candidate, not workspace/file
paths. Root/examples remain private. Full tarball file inventory and hashes are in
artifacts/release/manifest.json; package source manifests are the dependency inventory.

## Public API / compatibility

No intentional product features or public breaking API changes. All **31** baseline
declaration files retain their hashes. See [API compatibility](phase-7-api-compatibility.md)
and [migration](migration.md). ESM, plain acyclic domains and explicit codecs remain
contracts. Angular multiple autocomplete, Vue generic-boundary/custom key limits and
native versus Material date views remain documented, not silently broadened.

| Area | Actually verified locally |
| --- | --- |
| Runtime/tooling | Windows, Node 24.12.0, pnpm 10.26.2, TypeScript 5.9.3 |
| React / MUI | React 19.2, MUI 7.3, optional MUI X 8.29 |
| Vue / Vuetify | Vue 3.5, Vuetify 3.13 |
| Angular / Material | Angular/Material 21.2; strict standalone templates/APF |
| Production browsers | Chromium, Firefox, WebKit: 15 flows per engine, 45 total |
| Angular SSR/hydration | Actual prerender/hydration production native route tested in all three engines; installed consumer SSR |
| React/Vue SSR | Manual and Auto/panel installed-consumer SSR; native hydration regressions in jsdom |
| Broader hydration | Auto/MUI/Vuetify production hydration is not established; no blanket full-hydration claim |
| Linux / Node 20/22 CI | Configured; not represented as locally executed success |

## Security and dependency audit

Initial audit exit **1**, two moderate advisories in build/test tooling, none high or
critical. Affected glob/minimatch versions were genuinely upgraded; no advisories
were suppressed. Post-fix audit exit **0**, **zero vulnerabilities** at query time.
See [security findings](phase-7-security.md), [policy](../SECURITY.md), and raw audit JSON.

Prototype-safe paths/atomic patch rejection, immutable ownership, async stale/cancel
cleanup, XSS-as-text, redaction/bounds and subscriptions are tested. DevTools remains
explicit opt-in with no built-in network/storage/logging. Schemas/validators/custom
renderers are trusted app code; client validation never replaces server checks.
Source upload scan found no credential-shaped content; node_modules, logs, tarballs,
credentials and runtime artifacts are excluded from source and package uploads.

## Verification ledger

| Command | Exit / evidence |
| --- | --- |
| Pre-change pnpm check | **0**, Phase 6 baseline: 186 tests / 30 files |
| Final pnpm check | **0**, 190 tests / 31 files; declarations and JS/TS examples |
| pnpm test:phase6 | **0**, 28 focused tests / seven files |
| pnpm examples:build | **0**, React/Vue/Angular production builds/prerender |
| pnpm test:browser | **0**, 15 Chromium flows |
| pnpm test:browser:release equivalent | **0**, 45 Chromium/Firefox/WebKit flows |
| pnpm install --offline --frozen-lockfile --ignore-scripts | **0**, lockfile matches candidate manifests |
| pnpm audit --json (after fixes) | **0**, zero current advisories |
| pnpm release:check | Tarball verification: **0**, 11 real tarballs, no content/range/API errors |
| pnpm test:packages | **0**, 12 clean installed consumer cases, including actual production builds |
| pnpm benchmark / benchmark:compare / benchmark:phase6 | **0** for all three; original workloads/assertions retained |

All final local gates above completed with exit 0. Independent consumers use actual
1.0.0-rc.1 packed artifacts; original seven cases remain and the four Phase 6 cases
plus the isolated JS/TS core case all passed.

### Performance measurements

Phase 6 paired optimized baseline/current suite: four warmups, 11 samples, 50 writes
per update batch; medians in milliseconds/operation. No panel is mounted in Node.

| Fields | Baseline update | Tools disabled | Ratio | Events only | Inspection enabled |
| --- | --- | --- | --- | --- | --- |
| 10 | 0.02304 | 0.02089 | 0.91× | 0.00952 | 0.01420 |
| 100 | 0.01921 | 0.02098 | 1.09× | 0.01400 | 0.01744 |
| 1000 | 0.03850 | 0.02102 | 0.55× | 0.01737 | 0.04180 |

| Fields | Baseline full validation | Tools disabled validation | Inspection validation | Baseline initialization/disposal | Current initialization/disposal |
| --- | --- | --- | --- | --- | --- |
| 10 | 0.04640 | 0.05270 | 0.15020 | 0.15910 | 0.17260 |
| 100 | 0.52520 | 0.46980 | 2.33310 | 1.22320 | 0.88670 |
| 1000 | 5.08600 | 8.28540 | 14.31650 | 7.31830 | 6.86230 |

Enabled inspection has measurable cost, especially full-schema validation; it is
development opt-in. Timing ratios include same-process order/JIT/host effects and
are not CI thresholds. No validation semantics changed. A small guard skips diagnostic failure classification and event calls when no observer is attached; public declarations remain identical. A noisy initial 1,000-field validation comparison was investigated with a separate quiet paired run (3.3499 ms baseline / 3.6596 ms before the guard). Full raw before-guard samples are saved in artifacts/phase-7-performance-before-guard.json; host/JIT/order variation prevents a zero-overhead or universal speedup claim.
Dependency invalidation and dynamic collection workloads/assertions remain in the
unchanged benchmark/compare commands; raw samples are benchmarks/results.json and
benchmarks/phase-5-1-results.json.

| History limit | Approx. retained bytes/form + inspection | Serialized event bytes |
| --- | --- | --- |
| 0 | 3197 | 2 |
| 100 | 12922 | 8401 |
| 1000 | 99966 | 82403 |

Heap estimates use forced GC and are not allocation-throughput guarantees. Events
retain metadata only. Browser Auto Form measurements below include Playwright/UI/
DevTools/host contention, one sample from the supplied form (not pure renderer CPU,
not large-form or framework-ranking claims); milliseconds:

| Framework | Initial screen | Field edit | Conditional update | Add row |
| --- | --- | --- | --- | --- |
| react | 4310.4 | 167.4 | 768.7 | 261.7 |
| vue | 348.8 | 122.8 | 649.2 | 233.1 |
| angular | 403.1 | 123.1 | 422.9 | 188.6 |

Raw samples: artifacts/phase-6/core-performance.json and *-browser-latency.json.
The release cross-browser run overwrites per-framework latency artifacts as each
engine completes; these final samples are from the later required Chromium run.

Raw command logs: artifacts/phase-7-baseline-check.log, phase-7-check.log,
phase-7-phase6.log, phase-7-examples.log, phase-7-chromium.log,
phase-7-browsers.log, phase-7-consumers.log, phase-7-tarballs.log,
phase-7-benchmarks.log and phase-7-lockfile.log. Reports preserve actual nonzero
diagnostic runs separately where relevant; final results are not inferred from builds.

## Packaging and isolated consumers

Every publishable package is discovered from the workspace. npm dry-run file lists
are compared with actual pnpm-packed tarballs, including normalized Angular APF file
lists. Export/declaration/map targets, MIT/docs, internal version ranges, framework
isolation and forbidden files/local paths/credential-shaped content are checked.
SHA-512, sizes and complete file lists are saved; no tests/logs/secrets are packed.

Original seven installed consumers are retained. Phase 6 headless/React/Vue/Angular
consumers are extended with independent React/Vue production bundling and browser
validation/submission/redaction. An additional core-only clean consumer verifies
vanilla JavaScript plus TypeScript, async submit, nested paths, rows, locale and
negative inference. No workspace aliases or unrelated optional frameworks are used.

A new Vue production check initially failed: Windows 8.3 TEMP aliases produced
duplicate core module identities in Vite. Canonicalizing the actual temporary path
fixed the same installed artifacts without changing runtime APIs or weakening checks.

## Documentation and developer experience

The [index](index.md) links installation/quickstart/JavaScript/TypeScript, actual
framework and component-library guides, nested/collection/conditional/async/locale
usage, Auto/DevTools, migration, troubleshooting and API references. Root README and
changelog now describe the actual ecosystem. Contributing/security/release notes,
checklist, publication order, version train, rollback/deprecation and copy-paste
commands are provided. Historical pre-1.0 Changesets are archived, not re-applied
as accidental future minor bumps.

## Remaining publication blockers

1. Local **npm whoami returns 401**. The authenticated npm account and permission
   to publish under **@valixa** are unverified. All 11 public registry name lookups
   returned 404, which is not proof of scope ownership, reservations or permission.
   No package was renamed and no npm token was requested/stored.
2. npm trusted publisher/initial-package bootstrap, GitHub protected `npm-release`
   reviewers/main deployment policy and branch required checks must be configured
   and verified by the maintainer. YAML alone does not establish protections.
   `VALIXA_RELEASE_READY` remains unset; publication is deliberately disabled.
3. Review the exact candidate list/checksums and approve the specific versions/tag.
   General publish intent was received, but unverified builds/rights/protections are
   never bypassed. Stable 1.0.0 requires explicit promotion and re-verification.
4. Review actual Linux CI results after source upload. No Linux/Node matrix success
   is claimed until those jobs have executed on the final reviewed source.

The next publication action, after resolving these blockers and exact approval, is
manual dispatch of **Approved npm release** with `version: 1.0.0-rc.1`, environment
**npm-release**, tag **next**, in the table order. See [exact workflow/commands and
rollback](releasing.md). Do not infer successful publication until npm confirms each
version and SHA-512 integrity. No irreversible public release action was executed.
