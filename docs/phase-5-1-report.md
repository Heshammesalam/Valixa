# Phase 5.1 core performance report

Date: 2026-11-10. Runtime: Node 24.12.0, pnpm 10.26.2, TypeScript 5.9.3, Windows x64, Intel i7-11370H. No packages published; no Phase 6 features added.

## Audit and benchmark integrity

The [performance audit](phase-5-1-performance-audit.md) preceded runtime edits. The unchanged 143-test baseline passed and the existing benchmark was reproduced. The complete pre-optimization Phase 5 source and reproduced samples are preserved in `benchmarks/phase-5`, with SHA-256 hashes. The older pre-Phase-5 source baseline remains unchanged.

The original `benchmarks/run.ts` workloads and `pnpm benchmark` command are unchanged. A copy is retained as `benchmarks/phase-5/original-run.ts.txt`. Its legacy `phase5` JSON key now denotes the current source implementation, as it always did; historical Phase 5 samples are separately preserved. `pnpm benchmark:compare` explicitly labels preserved Phase 5 and Phase 5.1, using the same schemas, field counts, order, warmups, samples, update loops, validation/debounce operations and row operations. Assertions execute outside timing windows in both variants; a request counter is added symmetrically to the async callback to prove one request per eligible change.

Measurements use 10/100/1,000 fields, three warmups, nine measured samples, `performance.now`, 20 mutations per single-update sample, and the original p10/p90 order-statistic convention. Dependency timing excludes validation setup. Creation includes disposal in the end-to-end suite. Microbenchmarks separately isolate initialization, publication, observed notifications, graph traversal, validation, scheduling, collection movement and disposal. No arbitrary CI timing threshold is introduced.

## Changes and preserved contracts

- **Owned immutable values:** clone/freeze external changed leaves once, shallow-copy the flat value record, and structurally share untouched nested branches. Validation captures existing frozen snapshots instead of deep-copying values again. Shared defaults remain immutable and independent writes detach correctly.
- **Copy-on-write errors:** frozen maps are copied only before mutation; a result batch reuses its writable draft. Unchanged rule descriptors, error arrays, metadata, touched/dirty maps and localized messages retain identity. Messages render once on changed results, and locale changes rerender only changed messages.
- **Lazy field projections:** idle fields do not allocate eager snapshots. Active subscribers receive synchronous effective transitions. Unobserved cached projections refresh lazily on reads, preserving unchanged references. `NaN` and signed-zero semantics use `Object.is`. Whole-form no-op snapshots are suppressed; actual pending-owner transitions still notify.
- **Validation allocation:** lightweight field ownership tokens defer native AbortController allocation until a signal is consumed. Rule-only work still exposes running/result transitions. Async cancellation, stale guards, server precedence, debounce, fresh submit, form validation and timeout behavior remain tested. Obsolete validators that ignore signals cannot commit.
- **Graph/metadata:** reverse traversal, transitive dependencies, conservative unknown reads and cycle policy are unchanged. Empty immutable metadata arrays/default values are shared. No closure cache or repeated graph rebuild is introduced; graph traversal was not the measured bottleneck.
- **Collections:** preserve stable keys/stores and move frozen row value references instead of cloning every row. Reuse item arrays on nonstructural events; cache error/touch/dirty/pending projections; skip unchanged parent-flag walks while enforcing flag ownership and inheriting flags for new rows. Trusted internal row snapshots avoid a second external-data copy/validation pass. Application-supplied replacements still use the validation/copy boundary.
- **Lifecycle:** disposal clears controllers, timers, observers and controller/projection caches while retaining readable immutable final snapshots. Removed-row subscriptions/flag caches are released. No unbounded dependency/message cache is added.

Atomic reserved-looking data keys remain safe own properties; immutable projection construction uses `Object.fromEntries`, avoiding prototype setters. Application references cannot mutate stored values, including externally shallow-frozen objects and sparse atomic arrays. Public signatures, rules, nested/collection grammar, locales, framework ownership and error/submission semantics remain available. All prior feature gates remain.

## Milestones and evidence

Raw milestone samples are retained in `benchmarks/phase-5-1-snapshot.json`, `phase-5-1-validation.json`, `phase-5-1-collections.json`, and `phase-5-1-memory.json`. They are diagnostic runs, not tightly controlled cross-run significance tests. Snapshot-only changes reduced mutation/retained memory but left dependent invalidation expensive; further projection/error-map work was retained only after focused regressions passed and measurements improved. No speculative closure cache or blanket cancellation removal was adopted.

Final paired run: 2026-11-10T09:34:25.291Z. [Paired raw samples](../benchmarks/phase-5-1-results.json) retain every measurement. All timing numbers below are milliseconds/operation.

| Fields | Operation | Phase 5 median | Phase 5.1 median |
| --- | --- | ---: | ---: |
| 10 | Creation + disposal | 0.152 | 0.118 |
| 10 | Single-field update | 0.026 | 0.010 |
| 10 | Dependent invalidation | 0.036 | 0.020 |
| 10 | Full validation | 0.151 | 0.071 |
| 10 | Async scheduling | 0.091 | 0.028 |
| 10 | Dynamic row operation | 0.098 | 0.049 |
| 10 | Debounce arm/cancel | 0.040 | 0.012 |
| 100 | Creation + disposal | 0.823 | 0.608 |
| 100 | Single-field update | 0.154 | 0.010 |
| 100 | Dependent invalidation | 0.294 | 0.083 |
| 100 | Full validation | 1.607 | 0.291 |
| 100 | Async scheduling | 0.393 | 0.024 |
| 100 | Dynamic row operation | 0.668 | 0.141 |
| 100 | Debounce arm/cancel | 0.282 | 0.013 |
| 1000 | Creation + disposal | 10.059 | 6.173 |
| 1000 | Single-field update | 1.854 | 0.032 |
| 1000 | Dependent invalidation | 3.299 | 1.161 |
| 1000 | Full validation | 15.144 | 3.463 |
| 1000 | Async scheduling | 4.579 | 0.033 |
| 1000 | Dynamic row operation | 4.585 | 1.157 |
| 1000 | Debounce arm/cancel | 3.578 | 0.028 |

At 1,000 fields, sample distributions and median reductions are:

| Operation | Phase 5 p10–p90 | Phase 5.1 p10–p90 | Median reduction |
| --- | ---: | ---: | ---: |
| Creation + disposal | 7.294–12.857 | 4.758–7.944 | 38.6% |
| Single-field update | 1.727–1.951 | 0.031–0.034 | 98.3% |
| Dependent invalidation | 3.060–4.381 | 1.129–1.686 | 64.8% |
| Full validation | 14.004–16.396 | 3.035–4.478 | 77.1% |
| Async scheduling | 4.441–5.750 | 0.031–0.068 | 99.3% |
| Dynamic row operation | 3.941–7.530 | 1.039–1.640 | 74.8% |
| Debounce arm/cancel | 3.106–4.047 | 0.028–0.028 | 99.2% |

These are local point estimates with nine samples, not formal significance tests or universal guarantees. The unchanged legacy benchmark also completed; its independent samples are in [results.json](../benchmarks/results.json).

### Retained heap and notifications

| Fields | Phase 5 heap median KiB (p10–p90) | Phase 5.1 heap median KiB (p10–p90) | Median reduction | Field / whole-form callbacks, both variants |
| --- | ---: | ---: | ---: | ---: |
| 10 | 14.205 (10.287–15.244) | 12.098 (-51.947–18.777) | 14.8% | 2 / 1 |
| 100 | 99.867 (94.888–99.877) | 73.973 (61.314–74.667) | 25.9% | 2 / 1 |
| 1000 | 911.658 (899.509–913.950) | 649.973 (638.241–654.441) | 28.7% | 2 / 1 |

The selected dependency change still emits exactly two field callbacks and one whole-form callback. Lower runtime comes from avoiding unnecessary internal work, not suppressing required notifications or validations. Idle-form heap excludes eagerly built field snapshots in Phase 5.1; explicitly read field projections remain bounded by schema size and are released on disposal.

### Operation microbenchmarks

| Isolated operation, 1,000 fields/rows | Phase 5 median ms | Phase 5.1 median ms |
| --- | ---: | ---: |
| Initialization (no disposal) | 8.645 | 6.424 |
| Mutation, no subscribers | 2.580 | 0.043 |
| Unchanged publication | 2.975 | 0.005 |
| Mutation with 1,000 subscribers | 2.769 | 0.586 |
| Graph traversal only | 0.002 | 0.001 |
| Full validation | 19.164 | 3.586 |
| Async scheduling | 6.275 | 0.081 |
| Move + move back | 11.127 | 2.263 |
| Disposal (no setup) | 1.915 | 0.055 |

These microbenchmarks include the same assertions and setup boundaries in each variant and are separate from end-to-end measurements. Graph traversal is already very small; the observed timing difference there is inconclusive and is not claimed as a traversal speedup.

### Sampled allocation estimates

| Profile workload, 200 operations | Phase 5 KiB/op | Phase 5.1 KiB/op | Phase 5 MiB/s | Phase 5.1 MiB/s |
| --- | ---: | ---: | ---: | ---: |
| Updates | 5678.124 | 29.637 | 2101.358 | 963.951 |
| Full validation | 20929.488 | 2532.744 | 1109.062 | 387.316 |

Paired collected-allocation profiles show substantially fewer sampled allocated bytes per operation. The profiler itself contributes allocations, and estimates are not retained heap or exact malloc accounting. The optimized update window is too short for reliable CPU hotspot percentages. In the longer validation profile, remaining samples concentrate in field request execution/GC and publication rather than whole-value copying; raw frames are preserved for inspection.

## CPU, allocation and retained memory

CPU profiles capture actual sampling evidence, separately from timing gates. The initial audit showed publication, cloning/freezing and repeated error construction dominating; graph traversal alone was about 0.001 ms at 1,000 fields. Inspector allocation sampling was validated locally to include minor/major-GC-collected objects before being used for paired allocation estimates. Original live-only profiles remain separately retained.

`profile:core:before` and `profile:core` each profile 200 updates and 200 complete validations with identical sampler options. Sampled allocation bytes/operation and MiB/second include inspector overhead and sampling noise; they are not exact allocation totals. A faster implementation can have higher allocation throughput per second despite fewer bytes per operation. Very short optimized CPU windows can yield too few samples for meaningful hotspot percentages. Raw `.cpuprofile`/`.heapprofile` files are in `artifacts`; summaries and all microbenchmark samples are in `benchmarks/phase-5-1-*-allocation-profile.json`.

Retained heap is a different measurement: nine samples retaining five forms after forced GC, heap delta divided by five. It excludes process RSS/native memory and does not prove absence of every application-created retention chain. Disposed final snapshots and any snapshots intentionally held by application code necessarily retain their data. No fragile GC timing assertion is added to unit tests.

## Regression and consumption verification

Final acceptance **passes (exit 0)**: `pnpm check`, `pnpm examples:build`, `pnpm test:browser`, `pnpm test:packages`, `pnpm benchmark`, `pnpm benchmark:compare`, `pnpm profile:core:before`, and `pnpm profile:core`. Evidence is retained in `artifacts/phase-5-1-final.log`.

- **158 tests in 23 files**, preserving all original 143 tests; 15 added identity/immutability/notification/framework regressions.
- All seven package builds, strict source/declaration/Vue/Angular template checks and both core examples pass.
- All **12 production Chromium flows** pass, including advanced reactive features and existing hydration checks.
- All **seven independent package consumers** pass, including advanced installed-core smoke/type checks and the two additional Angular linked production Chromium applications.
- Paired assertions pass at all three sizes; benchmarks/profiles complete without timing thresholds.

New deterministic tests cover nested/atomic identity, immutable external-write boundaries, repeated validation/locale/error sharing, exact notification counts, lazy reads, independent captured async values, conditional invalidation without eager reads, defaults shared across independent forms, collection value/key/touch movement, parent flag ownership, disposal, sparse arrays, reserved atomic keys, `NaN` and signed zero. Additional React external-store, Vue shallow/computed and Angular signal tests prove branch identity through validation and unrelated writes. Existing core/UI/cancellation/hydration/browser tests remain intact.

The seven installed consumer variants remain React, MUI, MUI-X, Vue, Vuetify, Angular and Angular Material. They install tarballs outside the workspace, validate exports/declarations/SSR, execute advanced core smoke checks, compile typed nested bindings, and run the two Angular linked production applications in Chromium. Core has no new runtime dependency and no framework import.

The final documentation-only core tarball refresh was checked against the last installed consumer: all 44 emitted runtime/declaration/map files are byte-identical. Preserved Phase 5 source hashes and the unchanged original benchmark source also match their recorded copies.

CI retains Ubuntu Node 20/22/24 checks and the production browser job. The benchmark job additionally uploads original and paired comparison results. The CI matrix has not been executed from this Windows session and is unverified locally.

## Remaining costs and Phase 6 readiness

Flat record copying and nested path projection retain linear costs; structural sharing does not make arbitrary updates constant-time. Many active field subscribers still require projection checks. Collection ordering/aggregate arrays still scan surviving rows, and complete row validation propagates parent transitions. Initial parsing/blueprint construction and distinct rule metadata remain potential future optimization areas. Running custom validators still require promises, contexts and cancellation ownership; network costs are outside these synthetic workloads.

Nine samples support directional comparisons, not universal latency guarantees or formal significance claims. Overlapping distributions should be treated as inconclusive. CPU/GC/JIT/background host load affect timing and heap estimates; no superiority over another library is claimed. Broader engines, browsers, Linux CI and other Node versions remain unverified here.

The advanced API and its framework integrations remain ready for Phase 6 planning, with lower measured core overhead and explicit identity contracts. Auto Forms and DevTools UI still require separate design and implementation. Nothing was published.
