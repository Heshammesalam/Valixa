# Phase 7 release readiness

Review date: 11 November 2026. **Verdict: READY WITH DOCUMENTED LIMITATIONS for an explicitly approved first public RC bootstrap; protected OIDC publication is NOT READY until npm publisher setup.**
The local candidate and an approved public npm release are different states.
No npm package, public release tag or GitHub release has been published by this work.

## Exact prepared inventory

The maintainer approved public packages without an npm organization: core is `valixa`, integrations are `valixa-*`. All ten local verification gates passed again for the renamed artifacts on 11 November 2026. The matching source commit is `205512661d37e237cec0f47164d5bd043b81d39e`; its Linux CI is tracked separately below.

All candidates are **1.0.0-rc.1**, tag **next**, MIT, unscoped public ESM, sideEffects false.
Stable target **1.0.0** is not automatically applied to these candidates.

| Order | Package | Entry points / dependencies |
| --- | --- | --- |
| 1 | valixa | .; no runtime dependencies |
| 2 | valixa-angular | . APF; core peer and tslib |
| 3 | valixa-auto | .; core |
| 4 | valixa-devtools | ., /panel; core |
| 5 | valixa-angular-devtools | . APF; devtools peer and tslib |
| 6 | valixa-angular-material | . APF; core/angular peers and tslib |
| 7 | valixa-react | ., /auto, /devtools; core, optional auto/devtools peers |
| 8 | valixa-vue | ., /auto, /devtools; core, optional auto/devtools peers |
| 9 | valixa-angular-auto | . APF; core/angular/angular-material/auto peers and tslib |
| 10 | valixa-mui | ., /x, /auto; core/react, optional auto/MUI X peers |
| 11 | valixa-vuetify | ., /auto; core/vue, optional auto peer |

Repository created and verified public with owner admin access:
[Heshammesalam/Valixa](https://github.com/Heshammesalam/Valixa).
Initial reviewed source commit: `1b079070f9349c9f0a0119368c8273e64bda254f` (295 exact matching blobs). All manifests now carry that repository/directory, homepage, bugs URL, description,
keywords, license, typed exports, files, engines and public publish configuration.
Internal packed dependencies/peers target the matching candidate, not workspace/file
paths. Root/examples remain private. Full tarball file inventory and hashes are in
artifacts/release/manifest.json; package source manifests are the dependency inventory.

## Public API / compatibility

No product features or type signatures were changed. The approved package/import renames require consumers to update imports. All **31** baseline declaration files match after canonicalizing approved module-name changes and generated namespace aliases. See [API compatibility](phase-7-api-compatibility.md)
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
| Linux CI | Renamed source run [42994106136](https://github.com/Heshammesalam/Valixa/actions/runs/42994106136): all five jobs passed, Node 20/22/24, browsers and benchmarks |

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

### Counterbalanced performance investigation

The original sequential benchmark varied materially across runs (including a noisy
1,000-field validation comparison). The release investigation alternates which engine
runs first on each pair, warms both for 20 iterations, records 31 samples, batches 200
writes and five full validations per sample, and checks results outside timed work.
No timing threshold is asserted. Medians are milliseconds/operation:

| Fields | Baseline update | Current disabled update | Ratio | Baseline full validation | Current full validation | Ratio |
| --- | --- | --- | --- | --- | --- | --- |
| 10 | 0.00841 | 0.00819 | 0.975× | 0.03650 | 0.03612 | 0.990× |
| 100 | 0.02574 | 0.02480 | 0.963× | 0.29970 | 0.27778 | 0.927× |
| 1000 | 0.28787 | 0.28092 | 0.976× | 4.31612 | 4.28508 | 0.993× |

Counterbalanced initialization/disposal ratios at 10/100/1000 fields were 0.985×/0.817×/1.020×.
This did not reproduce a consistent material algorithmic regression. It does not
establish universal speed parity: sequential raw results still show host/order/JIT
variation. Investigation found unnecessary diagnostic failure classification even
without observers; a small guard removes that work without changing validation or
event semantics/public declarations. Before-guard raw samples are preserved in
artifacts/phase-7-performance-before-guard.json. Full counterbalanced samples are
artifacts/phase-7-paired-performance.json (`pnpm benchmark:release`, exit 0).

The unchanged benchmark/benchmark:compare suites continue to measure dependency
invalidation and dynamic rows, with all assertions passing. The Phase 6 suite separately
measures real enabled inspection, bounded history and disabled observers. Enabled
inspection has measurable full-schema projection cost and is intentionally development
opt-in. Browser action-to-visible measurements include automation/UI/DevTools/host
contention, not pure renderer CPU or a framework ranking; latest raw measurements
remain in artifacts/phase-6/*-browser-latency.json. Large UI-control-count rendering
and browser heap profiling are not claimed.

### Final local evidence

All ten required release-verification commands completed with **exit 0** after the
disabled hot-path guard. Machine-readable evidence is artifacts/release/verification.json
(`complete: true`, 190 unit/integration tests, 15 Chromium + 45 cross-browser flows,
12 consumer cases). This is local evidence; it is not substituted for a same-SHA CI
verification when publishing. Public source files were independently verified by Git
blob hashes after upload (295 files in initial source commit).

| Tarball | Bytes | Packed files |
| --- | --- | --- |
| valixa@1.0.0-rc.1 | 73453 | 65 |
| valixa-angular@1.0.0-rc.1 | 17541 | 7 |
| valixa-auto@1.0.0-rc.1 | 10840 | 8 |
| valixa-devtools@1.0.0-rc.1 | 23604 | 13 |
| valixa-angular-devtools@1.0.0-rc.1 | 3377 | 7 |
| valixa-angular-material@1.0.0-rc.1 | 9509 | 7 |
| valixa-react@1.0.0-rc.1 | 15536 | 18 |
| valixa-vue@1.0.0-rc.1 | 17201 | 18 |
| valixa-angular-auto@1.0.0-rc.1 | 16777 | 7 |
| valixa-mui@1.0.0-rc.1 | 15017 | 18 |
| valixa-vuetify@1.0.0-rc.1 | 15668 | 18 |

Complete hashes/metadata/file lists are in artifacts/release/manifest.json.
A subsequent real Linux CI run exposed the cold-cache metadata assumption in consumer
installers; Windows/local cached success did not conceal it. Consumer installation
now allows public metadata fetching with exact direct peer versions and patched-tool
overrides. CI collects all Node matrix outcomes (fail-fast disabled), uses supported
immutable official action releases, and must be checked on the updated source SHA.
See [live CI results](https://github.com/Heshammesalam/Valixa/actions/workflows/ci.yml).
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
negative inference. No workspace aliases or unrelated optional frameworks are used. Fresh consumers prefer cached packages but may fetch public registry metadata, with exact direct peer versions and patched tooling overrides; they do not assume a pre-populated developer metadata cache.

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

1. Browser npm login is verified as `heshammesalam`. The account has no organizations, and the maintainer declined creating one. Public unscoped names were approved instead. All 11 exact unscoped registry lookups returned 404; successful publication/name ownership is not inferred from that.
2. Renamed tarballs, imports, declarations and all 12 clean consumers passed all ten local gates. Renamed Linux CI run 42994106136 passed all five jobs on Node 20/22/24, production browsers and benchmarks. All 299 uploaded source blobs match the reviewed snapshot exactly.
3. The `npm-release` environment was created and verified: required reviewer `Heshammesalam`, administrator bypass disabled, only branch `main` allowed (zero tag rules). Self-review remains allowed for this single-maintainer repository. Private vulnerability reporting is enabled. npm trusted publisher setup still requires packages to exist; `VALIXA_RELEASE_READY` remains unset. After the maintainer completed normal login privately, CLI whoami succeeded as `heshammesalam`. No npm token was requested, read or stored by this work. The proposed one-time local bootstrap has no GitHub OIDC provenance and needs explicit approval; see [first publication proposal](releases/first-publication.md).
4. Approve the exact final versions/tag after the renamed artifact checks. Stable 1.0.0 requires promotion and a fresh complete verification. No package publication has occurred.

The next proposed action is the [one-time first publication](releases/first-publication.md)
of these exact tarballs at `1.0.0-rc.1`, tag `next`, after explicit approval of its
provenance limitation. The protected OIDC workflow remains disabled pending setup;
it must not be dispatched as if those prerequisites were satisfied. See
[workflow and rollback](releasing.md). Do not infer successful publication until
npm confirms each version and SHA-512 integrity. No public release action was executed.
