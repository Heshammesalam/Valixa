# Optimized pre-Phase-6 baseline

`core/` preserves the Phase 5.1 optimized TypeScript sources extracted from the core
tarball packed during the verified Phase 6 baseline, before description/event hooks
were added. It deliberately has no `observeEvents` or Auto Form/DevTools code.
These files are benchmark fixtures, not workspace packages or shipping code.
They retain the repository MIT license.

`results.json` preserves the baseline core benchmark output. The complete baseline
verification log is produced at `artifacts/phase-6-baseline.log` (ignored runtime
artifact). `benchmarks/phase-6.ts` pairs this optimized source with current core,
then measures events and explicitly attached inspection separately. Do not edit
baseline sources when changing the engine.
