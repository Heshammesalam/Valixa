# Phase 5.1 performance audit

Date: 2026-11-10. Written before runtime optimizations. Node 24.12.0, Windows x64, Intel i7-11370H. No Phase 6 work or package publication.

## Reproduction and evidence

Inspected all current core modules, the preserved pre-Phase-5 core, benchmark samples, and framework subscription boundaries. All **143 tests in 22 files** pass before edits. Ran the unchanged `pnpm benchmark`; preserved its output in `benchmarks/phase-5/reproduced.json` and the complete current core in `benchmarks/phase-5/core`. The older `benchmarks/baseline/core` remains untouched. These are filesystem source baselines, not Git revisions.

At 1,000 fields, reproduced Phase 5 medians (ms): creation+disposal 9.082; mutation 1.971; dependent invalidation 3.643; full validation 15.364; async scheduling 5.335. Retained V8 heap estimate: 933,533 bytes/form. Reported Phase 5 timings differ moderately, consistent with host/JIT/noise; functionality and workloads are unchanged.

`benchmarks/profile.ts --phase5` separately measures nine operations (3 warmups, 9 samples) and captures inspector CPU/allocation profiles for 200 updates and 200 full validations. Raw profiles are under `artifacts/phase-5-1-before-*`; summaries are in `benchmarks/phase-5-1-before-profile.json`. Timings include assertion overhead in these microbenchmarks, unlike the unchanged end-to-end benchmark.

| Operation | Median ms |
| --- | ---: |
| Initialization, disposal excluded | 6.791 |
| Single mutation | 1.824 |
| Unchanged snapshot publication | 1.494 |
| Mutation with 1,000 field subscribers | 2.034 |
| Reverse graph traversal alone | 0.0011 |
| Full validation | 15.900 |
| Async scheduling | 5.125 |
| Collection move and move back, 1,000 rows | 10.185 |
| Disposal, setup excluded | 1.782 |

Update CPU self samples: publish 114, copy 73, equality 23, GC 22, writeValues 15, freeze 6, graph affected 1. Full-validation samples: publish 446, freeze 350, copy 152, GC 149, renderError 112, equality 53, validateFields 30; anonymous/transpiler frames are significant and are not attributed speculatively. Sampling is statistical; these are sample counts, not exact CPU percentages.

Heap sampling currently reports sampled live allocation sites, excluding most collected objects. It is **not** a complete allocation-rate measurement or a retained-form estimate. Anonymous arrays, error metadata, publication maps and string replacement appear in validation samples, but inspector bookkeeping also appears prominently. Forced-GC retained-form measurements in the end-to-end benchmark are separate and approximate. Later profiling will include collected allocations where the inspector supports it and report that methodology explicitly.

## Diagnosis

- Writes deep-copy the whole flat values object, then publication copies/freezes it again. Nested inflation clones all leaves/branches. Validation copies values even though it only reads them.
- Every publication reconstructs error maps, dirty maps, touched maps, metadata and nested projections, even for pending/flag-only changes. Recursive freeze traverses already frozen error records repeatedly.
- Every form eagerly allocates every field projection and reconstructs/computes/deep-compares every projection on every publication, even when there are no field consumers.
- Validation renders messages both when adding an error and when committing it, allocates controllers/promises/listeners even for rule-only fields, and recreates identical error metadata on repeated validation. Cancellation ownership is correct and must be preserved.
- Graph traversal is already selective and linear. No evidence supports retaining potentially quadratic closure caches. Graphs are compiled once per blueprint, and row graphs retain stable lifetimes through moves.
- Collections copy every row value and rebuild their item array on every row state event, repeatedly aggregate errors/projections, and walk all rows for unchanged parent flags. Parent propagation clones/validates the collection again. Reorder legitimately changes order and index-prefixed errors, but should preserve each row's branches.
- Disposal currently performs a full publication after clearing listeners, retaining eagerly built field/controller caches. Final readable state must remain, but unused caches can be released.

## Incremental design

1. Adopt owned frozen value leaves and copy-on-write patches. Reuse unchanged nested branches via path updates; never trust externally shallow-frozen objects. Reuse public errors/touched/dirty/metadata branches when unchanged. Build field projections lazily, preserving identity and synchronous notification isolation for consumers. Suppress genuinely redundant snapshots only.
2. Preserve reverse indexes/unknown fallback/cycle policy; optimize allocations only if measurements justify them. Reuse immutable validation snapshots; avoid duplicate message rendering; investigate rule-only job setup while retaining fresh validation, pending transitions, abort/stale semantics and timeouts.
3. Reuse collection row values and structural item snapshots, cache derived aggregates by actual row-state identity, skip unchanged flag propagation, and release disposed caches. Preserve row-local errors/touch/dirty, parent submission consistency and removal cancellation.
4. After each milestone, run focused correctness/identity tests and record measurements. Retain the unchanged benchmark as an end-to-end gate. Add paired Phase-5/current workloads with identical assertions, samples, timing methodology and memory estimates; keep inspector microbenchmarks separate. No fragile timing thresholds.

Framework validation must retain stable React external-store reads, Vue shallow projections and Angular signal equality, not merely equal value contents. Final acceptance retains all five required commands and the seven installed package consumers. Linux CI/other Node versions are unverified unless actually executed.

## Allocation sampling refinement

Before using allocation-throughput estimates, a local inspector probe allocated/discarded 100,000 temporary objects and forced GC. Live-only sampling reported 16,416 bytes; enabling `includeObjectsCollectedByMajorGC` and `includeObjectsCollectedByMinorGC` reported 27,329,840 bytes on the same runtime. The paired `profile:core:before`/`profile:core` commands therefore use both options, retain the original sampling interval/work counts, and label sampled bytes/operation and MiB/second as **estimates including profiler overhead**, not retained memory. Original pre-edit live-only evidence remains separately preserved. CPU sample counts for very fast optimized paths may be too sparse for reliable hotspot percentages.
