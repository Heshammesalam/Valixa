# Phase 6 implementation report

Verified locally on Windows with Node 24.12.0 and pnpm 10.26.2, 11 November 2026.
No packages were published. Existing manual APIs remain available and all optional
integrations have separate entry points or packages.

## Baseline and sequencing

Before implementation, the complete reported baseline was rerun successfully:
158 tests, 12 production Chromium flows, seven independent installed consumers,
all example builds and both existing benchmark commands. The runtime log is
`artifacts/phase-6-baseline.log`. Optimized pre-Phase-6 core sources and baseline
results were preserved in `benchmarks/phase-6-baseline/` for a direct comparison.

The architecture audit preceded code. The headless contracts and smallest React/MUI
validation/submission slice passed focused tests before Vue and Angular were added.
Real core events and headless inspection were verified separately before the shared
panel. Renderer milestones and instrumentation/panel tests passed before final gates.

## Delivered architecture

| Deliverable | Implementation |
| --- | --- |
| Audit | `docs/phase-6-audit.md` |
| Headless UI schema/plan | `packages/auto/src/index.ts` |
| React/MUI renderer | Optional `@valixa/react/auto`, `@valixa/mui/auto` |
| Vue/Vuetify renderer | Optional `@valixa/vue/auto`, `@valixa/vuetify/auto` |
| Angular/Material renderer | Dedicated `@valixa/angular-auto` APF package |
| Real instrumentation | Core `events.ts`, lifecycle hooks in form/collection owners |
| Sanitized inspection | `@valixa/devtools` |
| Native inspection panel | Optional `@valixa/devtools/panel` |
| Framework panel bindings | React/Vue `/devtools`, dedicated Angular APF package |
| Runnable examples | Auto Form screen in each existing framework application |
| Tests/consumers | 28 focused tests, three new production flows, four new independent consumers |
| Performance | Preserved benchmarks plus `benchmark:phase6` and browser latency artifacts |
| Usage/reference | `docs/phase-6.md`, package READMEs, core API, architecture and changeset |

`defineAutoForm(schema, config)` deliberately accepts the blueprint to establish path
and value inference. Labels, control types, groups, option equality, empty policies
and dates remain explicit. Runtime capability checks reject unsupported controls,
missing renderer keys and mismatched date views. Core remains independent of DOM,
React, Vue, Angular and component libraries.

Leaf subscriptions remain field-scoped; actions/summary own whole-form reads.
Angular uses its existing cached signal bridge. Row views use stable keys and borrow
collection-owned stores. Reset events remount controls to clear drafts whose domain
value was already empty. This resets control focus/local view state intentionally.
Vue unwraps supplied class stores at the component boundary so proxies do not change
validation job identity. Its submit listener is awaited directly.

Core additions are small, additive contracts: lazy cached descriptions, configured
behavior states and filtered `observeEvents`. Events are emitted from actual timer,
request, commit, cancellation, submission and row operations. No pending-state
transition is interpreted as evidence of cancellation. No interested observer means
no event-object allocation; event observer Sets/request maps are allocated lazily.

## Privacy and lifecycle

Attachment is explicit; no import or renderer attaches DevTools automatically.
Default current/initial values and literal messages are redacted. Explicit allowlists
can reveal selected nonsensitive values; sensitive-name rules still override unless
separately opted out. File-like metadata stays redacted. Traversal, strings, depth,
row sources and history have bounds. Wide object traversal is bounded as well as
deep traversal. Structural schema metadata is inspectable and must not contain secrets.

Only current sanitized inspection and bounded value-free events are retained; history
never holds form values, error parameters, exception text or handler outputs.
There is no network, telemetry, storage, global form registry or console recording.
Detach/disposal releases root/row/event subscriptions and owned diagnostic data.
Caller-retained immutable snapshots cannot be revoked. Panel unmount releases only
panel subscriptions: attaching owners detach inspections explicitly.

The shared native panel exposes form selection, state and behavior flags, selected
field inspection, errors/codes, SVG dependency edges, row identities, searchable
timeline, pause/resume/clear and detach. TextContent is used for data display.
React preserves panel/search state across list prop updates; Vue and Angular update
borrowed lists through native lifecycle contracts. All bindings support SSR.

## Verification evidence

| Gate | Result |
| --- | --- |
| `pnpm check` | 186 tests in 30 files; source/declaration/example typechecks and JS/TS core examples pass |
| `pnpm examples:build` | React, Vue strict templates, Angular strict standalone build/prerender pass |
| `pnpm test:browser` | 15 production Chromium flows; original 12 retained |
| `pnpm test:packages` | Original seven plus four new independent installed consumers pass |
| `pnpm test:phase6` | 28 focused tests in seven files pass |
| `pnpm benchmark` | Original workloads retained |
| `pnpm benchmark:compare` | Original paired workloads/assertions retained |
| `pnpm benchmark:phase6` | Optimized baseline/current/observed/inspection and bounded history measurements |

Focused coverage includes typed metadata failures, normalization/unsupported
capabilities, custom controls/slots, nested groups, keyed rows, conditions, explicit
date codecs, validation/errors, awaited submission/reset, render isolation, cleanup,
real async cancellation/request identity, event ordering, redaction/limits/history,
SSR and controller ownership. New browser flows exercise async failures, standard
widgets, object selection, multi-select, date conversion, custom counters, conditional
nested values, row movement/removal, sanitized results, reset, graph/search and history.

All original consumers still install without optional Auto/DevTools peers. The four
new consumers install tarballs outside the workspace, with peer auto-install disabled
and offline package resolution. They verify rewritten workspace dependencies, export
targets, declarations and framework isolation. Headless consumption imports without
DOM; React and Vue execute renderer/panel SSR; Angular executes renderer/panel SSR,
strict templates, typed custom-template context, APF linking and a production Chromium
validation/submission/redaction flow. No workspace source aliases are available.

One old Angular browser assertion exposed an immediate `check()` timing assumption
under parallel load. It now clicks the Material switch and awaits `toBeChecked()`;
the tested behavior is unchanged and no sleep/retry bypass was added.

Runtime evidence is written to `artifacts/phase-6-check.log`,
`phase-6-examples.log`, `phase-6-browser.log`, `phase-6-all-packages.log`,
`phase-6-focused.log` and `phase-6-benchmarks.log`. Artifacts/tarballs remain ignored.
CI retains prior gates and adds the Phase 6 benchmark and diagnostic artifacts.
Linux/Node 20/22 CI execution was not performed locally; the configured matrix is
not represented as additional verified compatibility.

## Performance evidence

Phase 6 core timings below are medians in milliseconds/operation, with four warmups,
11 samples and 50 writes per update batch. One sanitized snapshot is pulled after
each enabled-inspection write batch. No panel is mounted in this Node benchmark.

| Fields | Optimized baseline update | Current, tools disabled | Events only | Inspection enabled | Disabled/baseline |
| --- | --- | --- | --- | --- | --- |
| 10 | 0.01236 | 0.00862 | 0.00538 | 0.00982 | 0.70× |
| 100 | 0.01161 | 0.00870 | 0.00541 | 0.01179 | 0.75× |
| 1000 | 0.01526 | 0.01471 | 0.01447 | 0.03535 | 0.96× |

| Fields | Baseline full validation | Current disabled validation | Inspection validation | Baseline creation/disposal | Current creation/disposal |
| --- | --- | --- | --- | --- | --- |
| 10 | 0.03790 | 0.03920 | 0.11670 | 0.08930 | 0.08600 |
| 100 | 0.21090 | 0.17710 | 0.96330 | 0.40650 | 0.31240 |
| 1000 | 2.69390 | 2.32050 | 10.96080 | 4.82020 | 5.04330 |

These are sequential same-process measurements, so warmup/order/host effects remain.
Ratios above 1 are measured overhead/regression, not rounded away as zero-cost.
The baseline and current implementations retain lazy field snapshots and structural
sharing; these results do not claim universal speed parity.

| Retained event limit | Approximate retained heap bytes/form + controller | Serialized event payload bytes |
| --- | --- | --- |
| 0 | 3272 | 2 |
| 100 | 13100 | 8401 |
| 1000 | 99966 | 82403 |

Heap figures use forced GC with ten retained form/controller pairs per sample.
They include live forms and inspection, not just events, and remain approximate.
Serialized payload size is an additional deterministic observation, not a heap claim.
Events contain only bounded operation metadata; detach tests verify retained data
and source references are dropped.

Browser figures below are one production Chromium action-to-visible sample per
framework, in milliseconds. They include Playwright transport, UI libraries, enabled
DevTools and parallel test-host contention. They are **not** isolated renderer CPU
times, throughput numbers or a framework ranking. The shared form has 14 scalar
paths plus one collection; conditional city starts hidden. No large-control-count
rendering or browser memory profile is claimed.

| Framework | Initial Auto Form screen | Single field edit | Conditional control update | Add row |
| --- | --- | --- | --- | --- |
| react | 439.4 | 45.3 | 395.9 | 153.1 |
| vue | 362.6 | 122.6 | 545.2 | 216.9 |
| angular | 316.1 | 79.9 | 426.3 | 209.6 |

Raw samples/environment: `artifacts/phase-6/core-performance.json` and
`artifacts/phase-6/{react,vue,angular}-browser-latency.json`.
The preserved baseline uses the same installed Node/runtime and schema sizes.

The original benchmark and comparison commands remain unchanged. The legacy
`phase5_1` label in `benchmark:compare` denotes current core, now including Phase 6.
The separate Phase 6 suite pairs the genuinely preserved optimized pre-Phase-6 core
against current code. It reports measurements, not fragile pass/fail timing limits.

No eager field projections are created by headless attachment. Selected-field panel
inspection is an explicit lazy read. Deterministic isolation and identity tests remain
the stronger regression contracts; wall-clock timing and forced-GC retained heap are
diagnostics with host/JIT/GC variation. Enabled inspection adds synchronous source
tracking and sanitized projection work, especially for full validation/large schemas.
The panel adds DOM/SVG rendering cost and is measured separately in browser flows.

## Compatibility limits

Angular supports single autocomplete; multiple autocomplete throws an actionable
error directing callers to select/custom controls. React/Vue dates use native date
inputs; Angular uses a Date/null Material view. Shared UI dates need explicitly
registered platform codecs. MUI X remains manual. Files/rich-text/third-party domain
objects require custom renderers and explicit serialization boundaries.

React/Vue expose field/action slots; Angular exposes typed renderer templates and
projected action replacement, but no arbitrary per-field layout slot. Vue's component
generic boundary is erased; strongly typed metadata and handlers remain necessary.
Custom renderer keys cannot prove every runtime value-type reuse in Angular; the
example field establishes template typing, and the app owns registry compatibility.

The graph caps visible nodes at 80; row inspection caps source traversal at maxRows.
The UI is not a virtualized profiler, browser extension, remote inspector, time-travel
debugger or visual drag-and-drop form builder. Browser timings cover the supplied
generated form, not 1,000 real UI-library controls. Strict CSP styling, other browsers
and framework major versions outside the installed peer ranges are not claimed.
