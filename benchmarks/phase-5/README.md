# Preserved Phase 5 implementation

`core/` is the complete, unchanged Phase 5 core captured before Phase 5.1 runtime edits on 2026-11-10. The 143-test baseline passed, and the existing `pnpm benchmark` was reproduced first. `reproduced.json` records that run. The repository's MIT license applies.

`pnpm benchmark:compare` imports these sources and the current sources in the same process. It preserves the original schemas, warmups, samples, update counts and operations, with identical correctness assertions outside timing windows. A validation-request counter is added symmetrically to the async callbacks. Source filenames are translated by the existing `tsx` loader; no workspace package aliases or compiled output substitute for this baseline.

`pnpm profile:core:before` captures the same operation microbenchmarks and inspector CPU/allocation samples as `pnpm profile:core`. These are separate from the unchanged `pnpm benchmark` workload. Allocation sampling includes collected objects and instrumentation overhead; forced-GC retained-form heap estimates are a different measurement.

The earlier `benchmarks/baseline/core` remains the pre-Phase-5 implementation. No benchmark is a cross-library comparison or a CI timing threshold.
