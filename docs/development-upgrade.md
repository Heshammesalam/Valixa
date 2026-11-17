# Development upgrade: schema interoperability and application pilots

Historical pre-publication development report. These changes were subsequently
published in [1.0.0-rc.2](releases/publication-1.0.0-rc.2.md); the original development
evidence and remaining production-adoption limits below are retained.

Date: 15 November 2026. These are local development changes, not a new npm release.
The existing published version remains 1.0.0-rc.1. Stable 1.0.0 was not promoted.

## Delivered

- Optional `valixa/standard`: Standard Schema v1 field/form validators and explicit
  typed output parsing. Actual Zod, Yup and Valibot providers are tested. Core
  runtime dependencies remain empty. Existing 31 declaration baselines are unchanged.
- A shared purchase-order domain used by React/MUI and Vue/Vuetify applications:
  conditional shipping, editable/reordered rows, quantity transformation, async
  product availability, server field rejection, cancellation, retry and reset.
- A Nuxt 4.6.4 production Node-server fixture with per-request form ownership,
  server-rendered initial data, native hydration, validation and transformed submit.
- A reproducible direct Vue-composable comparison with VeeValidate, plus minified
  and gzip bundle measurements. See [comparison methodology/results](vee-comparison.md).
- A private, scoped, security-patched Nuxt build dependency, with retained MIT
  license, upstream/patched hashes, an exploit regression and real Nuxt checks.
  See [Nuxt security details](nuxt.md). No advisory was ignored or audit threshold lowered.
- CI wiring for the new package consumer, Nuxt fixture and comparison artifact;
  a Changeset records the additive core feature. No remote CI result is claimed
  for this uncommitted development tree.

## Verification

| Check | Actual local result |
| --- | --- |
| Complete package builds, app type checks and JS/TS examples | Passed through `pnpm check` |
| Final TypeScript check | Passed |
| Final Vitest suite | 205 tests / 34 files passed |
| Release-tooling tests | 3 passed |
| Existing plus pilot production browser flows | 51 passed, Chromium/Firefox/WebKit |
| Nuxt production build and type check | Passed with patched build dependency on isolated Node 24.15.0 |
| Nuxt SSR/request-isolation/hydration browsers | 3 passed, one per engine |
| New actual core tarball installed outside workspace | Zod/Yup/Valibot runtime and negative TypeScript checks passed |
| Existing declaration compatibility | 31 baseline declarations unchanged |
| Final strict dependency audit | Zero known vulnerabilities at query time |

Logs and raw evidence are under `artifacts/development-*.log` and
`artifacts/development/`. The original failing diagnostics are preserved separately;
final successes are not inferred from a successful build alone.
The dedicated Nuxt runtime was downloaded from nodejs.org and checked against its
official SHA-256; the system Node installation was not modified. General package
tests and the benchmark ran on the existing Node host, separately from Nuxt's
supported-engine verification. Nuxt requires the exact engine range in its guide.

## Run and review

```sh
pnpm check
pnpm example:react   # Choose Purchase order
pnpm example:vue     # Choose Purchase order
pnpm examples:nuxt:build
pnpm test:nuxt
pnpm test:standard
pnpm test:packages:standard
pnpm benchmark:vue-comparison
```

Read [Standard Schema contracts](standard-schema.md) before using the new subpath.
Validation preserves form input types; transformations are explicit at submission.
Collection schema messages aggregate on the collection; row definitions can attach
field adapters for per-row messages. Aborting stops awaiting a provider but cannot
force cancellation of its internal work without provider support.

## Evidence still needed before a stable release

The purchase-order APIs are intentionally simulated. They establish executable
integration coverage, not independent customer adoption, production traffic or
successful deployment against a real backend. Run these workflows in actual
applications and collect developer/user feedback before calling the API stable.

Nuxt tests cover the pinned Node-server fixture; they do not establish every Nuxt
major, deployment target or UI integration. The local build-tool patch is a
maintenance responsibility until a verified official upstream fix is available.

The performance comparison is a synthetic, explicitly scoped experiment. It does
not establish browser painting speed, memory superiority or a universal winner.
Review results and developer effort in real applications before selecting a library.

An exact next version, full release verification and explicit publication approval
remain required. Existing npm publication authorization applied to the previous RC,
not to arbitrary future changes or stable promotion.
