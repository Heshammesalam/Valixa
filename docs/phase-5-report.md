# Phase 5 implementation report

Date: 2026-11-10. Environment: Windows x64, Node 24.12.0, pnpm 10.26.2, TypeScript 5.9.3. Packages remain unpublished.

## Architecture and implementation

The [audit/proposal](phase-5-audit.md) preceded runtime changes and verified the reported starting point: **108 tests in 18 files**. All core source modules and the three framework integrations/UI adapters were inspected. A verbatim pre-change core source snapshot was retained under `benchmarks/baseline/core` before implementation. It is a filesystem baseline, not a Git revision.

The first implemented and verified slice was field mutation → reverse graph traversal → selective invalidation → field scheduling → cached field subscriptions. Existing 108 tests and strict package builds passed before expansion. Subsequent milestone tests covered behaviors, explicit nested schemas, dynamic row stores, form validation and localization before final integration/performance verification.

Implemented modules:

| Capability | Implementation and ownership |
| --- | --- |
| Dependency graph | Immutable forward/reverse indexes, inferred `same`, explicit dependencies, conservative custom-validator fallback, transitive traversal and cycle diagnostics |
| Scheduler | Per-field controllers/timers, manual/change/blur/submit/immediate policies, debounce, cancellation, running timeout, independent concurrency and stale-result guards |
| Behaviors | Pure dependency-aware visibility/enabled/required/readonly/reset/validation predicates; transactional reset drafts and field projections |
| Nested paths | Explicit `nested`, escaped safe segments, typed leaf values, immutable nested snapshots and nested error/touched/dirty projections |
| Collections | Explicit `collection`, opaque stable row keys, independently owned row forms/graphs, all eight operations, disposal and parent submission integration |
| Form validation | Separate form request/timer, optional dependency declarations, field/form-wide errors and deterministic precedence |
| Localization | Structured rule metadata, English/Arabic catalogs, labels/interpolation, custom registration/fallback, form-owned locale switching and literal message preservation |

Cycle policy preserves the previously documented safe circular `same` comparisons: each validator reads frozen values and traversal visits each affected field once. New explicit edges inside strongly connected components are rejected with an actionable cycle path. Component detection is linear in graph vertices/edges; it does not repeatedly validate a cycle to reach a fixed point.

## Public APIs

The complete examples and exact semantics are in the packaged [advanced guide](../packages/core/ADVANCED.md). Additions include:

- `FieldDefinition.dependsOn`, frozen `form.dependencies` diagnostics and exported `DependencyGraph`.
- `validation: {mode, debounce, timeout}`, `state.pending`, field pending state, and `cancelValidation()`.
- `behaviors` with `visibleWhen`, `enabledWhen`, `requiredWhen`, `readonlyWhen`, `resetWhen`, `validateWhen` and optional dependencies.
- `nested(schema)`, `parsePath`, `escapePath`, `FieldValue`, `ValuesPatch`, cached core `field(name)`, nested state projections.
- `collection(itemSchema, initialItems?)`, `form.array(name)`, `FieldCollection`, collection snapshots/rows, `ValueInput` and typed collection-name contracts.
- `validateForm`, `formDependsOn`, `state.formErrors`, structured `state.errorDetails`, and `setAllTouched()` including rows.
- `locale`, `fallbackLocale`, locale-keyed `labels`, existing `messages`, `registerLocale`, `setLocale`, and catalog/detail types.
- Angular `bindValixa` for borrowed collection/external-store projections; Angular delegates for arrays, locale, validation cancellation and diagnostics. Other framework field APIs retain their signatures while accepting typed nested leaf values.

All earlier core/React/MUI/Vue/Vuetify/Angular/Material APIs remain. Default validation remains manual/submit; legacy `validateOn` is supported. Existing atomic object/array definitions are not reinterpreted. Framework imports remain outside core. No new runtime dependency was added to core.

## Compatibility and behavior decisions

Explicit dependencies mean all reads must be declared; omitted custom dependencies remain conservative. Changes clear only affected field errors and cancel affected work. This intentional dependency-aware behavior retains unrelated mapped server errors. `setError` supersedes active work; a subsequent fresh explicit validation can replace it, preserving retry behavior. Field messages precede form-field messages. Form-wide errors contribute to validity independently of the field map.

Hidden/disabled/readonly fields retain values and remain included in payloads. Existing validation of disabled/readonly fields is preserved unless gated by `validateWhen`. Visibility remains application-owned DOM composition. `requiredWhen` adds required validation, while `resetWhen` resets to initial data only on a rising predicate transition. Locale/global flags survive reset; errors, touch/submission state and pending work clear. Collection resets create fresh row lifetimes without restarting immediate-mode initial validation.

Collections use row stores rather than permanent indexed field identities. Bind fields to `row.form`, reconcile by `row.key`, and use the current index for operations. Parent dependencies reference collection roots; row dependencies reference local row fields. Cross-row constraints use parent form validation. Structure changes validate collections under automatic policy; a row edit schedules its own closure and other parent dependents/form constraints, avoiding duplicate row requests. Removed rows cannot commit stale results. Parent complete validation becomes stale when its ordered data changes.

## Verification

The final `pnpm check` passes **143 tests in 22 files**, including all original 108. The focused advanced suite contains **35 tests in four files**: graph construction/selectivity/unknown fallback/cycles; debounce, independent requests, async races, immediate/blur/manual modes, timeout and timer cleanup; conditional transitions; escaped nested paths/type failures/prototype protection; collection operations, identity, row error/touch movement, nested items, replacement atomicity, removal races, reset/gating and duplicate-request prevention; form validation/precedence; locale switching, Arabic/fallback/custom messages; and representative real-control tests for all three framework/UI combinations.

`pnpm check` also builds all seven ESM/declaration/APF packages, checks TypeScript sources/tests and strict Vue/Angular templates, and executes unchanged JavaScript/TypeScript core consumer examples. `pnpm examples:build` builds all three applications; Angular prerenders one static route.

`pnpm test:browser` passes **12 production Chromium flows**: all original nine, plus React/MUI, Vue/Vuetify and Angular/Material reactive-engine flows. New flows cover native country writes, conditional nested city validation, live Arabic messages, real UI row controls, error/key movement through reorder/removal, and correct nested submission/reset. Existing Angular native hydration DOM-node reuse coverage remains passing.

The complete final sequence **passes**: `pnpm check`, `pnpm examples:build`, `pnpm test:browser`, `pnpm test:packages`, and `pnpm benchmark` (exit 0). All **seven isolated consumers** pass, including the two Angular linked production Chromium applications. Final command evidence is retained in `artifacts/phase-5-final.log`.

The consumer gate retains seven variants (React, MUI, MUI-X, Vue, Vuetify, Angular, Angular Material), installs tarballs outside the workspace, verifies exports/declarations and executes installed-package runtime/SSR checks. Every consumer additionally executes installed advanced core graph/nested/collection/submission/Arabic smoke checks and type-checks positive/negative nested paths and row values. Adapter consumers compile typed nested framework bindings; Angular compiles strict nested-field templates and runs linked production bundles in Chromium. Advanced production UI browser flows are separate from isolated consumer checks; this report does not claim that every advanced UI combination was repeated inside each consumer.

## Performance

Final paired run: 2026-11-10T08:30:37.203Z, 11th Gen Intel(R) Core(TM) i7-11370H @ 3.30GHz, win32 10.0.26200, x64, v24.12.0. All numbers below are milliseconds per operation unless labeled otherwise. Full sample distributions are retained in [raw results](../benchmarks/results.json).

| Fields | Metric | Baseline median | Phase 5 median |
| --- | --- | ---: | ---: |
| 10 | Creation + disposal | 0.090 | 0.157 |
| 10 | Single-field update | 0.015 | 0.035 |
| 10 | Dependent invalidation | 0.014 | 0.045 |
| 10 | Full validation | 0.078 | 0.171 |
| 10 | Async scheduling | 0.047 | 0.101 |
| 100 | Creation + disposal | 0.740 | 0.914 |
| 100 | Single-field update | 0.101 | 0.144 |
| 100 | Dependent invalidation | 0.091 | 0.267 |
| 100 | Full validation | 0.455 | 1.344 |
| 100 | Async scheduling | 0.277 | 0.429 |
| 1000 | Creation + disposal | 4.841 | 11.678 |
| 1000 | Single-field update | 1.115 | 2.228 |
| 1000 | Dependent invalidation | 1.135 | 4.651 |
| 1000 | Full validation | 5.522 | 18.361 |
| 1000 | Async scheduling | 3.977 | 6.544 |

At 1,000 fields, the sample p10–p90 ranges were:

| Metric | Baseline p10–p90 | Phase 5 p10–p90 |
| --- | ---: | ---: |
| Creation + disposal | 4.109–5.969 | 8.893–13.805 |
| Single-field update | 1.053–1.221 | 2.112–2.435 |
| Dependent invalidation | 1.070–2.776 | 3.721–5.257 |
| Full validation | 4.505–6.477 | 15.031–25.159 |
| Async scheduling | 3.423–4.995 | 5.726–7.902 |

| Rows/fields | Dynamic row operation median (Phase 5) | Debounce arm/cancel median (Phase 5) | Approx. retained heap KiB, baseline / Phase 5 |
| --- | ---: | ---: | ---: |
| 10 | 0.098 | 0.045 | 7.075 / 14.194 |
| 100 | 0.501 | 0.190 | 49.475 / 99.864 |
| 1000 | 4.106 | 3.110 | 467.817 / 911.730 |

The selected dependency workload notifies **2 fields** in Phase 5 versus **10/100/1,000 fields** in the baseline, with one whole-form notification in either implementation. That reduction comes from retaining unrelated errors and projections. The measured runtime and retained-memory costs are nevertheless higher than the simpler baseline. Immediately resolving mock validators make snapshot/ownership overhead prominent; this does not predict network latency savings or imply general speed superiority. Dynamic collections and debounce have no equivalent baseline API. Further snapshot/structural-sharing optimization remains useful before promising large-form throughput.

Methodology: 10/100/1,000 fields, three warmups, nine measured samples, `performance.now`, 20 updates per single-update sample, sequential paired baseline/current runs in one Node process. Creation timings include disposal. Dependency-invalidation timing excludes preparation/full validation. Async scheduling uses immediately resolving promises without network latency. Array timings average append/move/swap/remove over collections of matching row counts. Notification counts use one source/one `same` dependent with all unrelated fields invalid from required rules. The changed error-invalidation semantics are deliberate; notification differences are not a structural-sharing speed claim.

Heap measurements retain five forms, force GC, divide the heap delta by five, and record all nine samples. These are approximate retained V8 heap deltas, not process RSS, allocation rates, browser memory, or universal per-form sizes. Raw data contains sample distributions; no arbitrary performance pass threshold or comparison to other libraries is introduced.

## Known limits and Phase 6 readiness

- Publication remains O(form data size); field-level notification selectivity does not make whole-form snapshots constant-time. Richer state, controllers, metadata and graph indexes have time/memory costs compared with the baseline. No general speed superiority is claimed.
- Nested schemas are explicit; atomic object fields do not become paths. Type inference bounds nested path recursion to eight levels below a top-level container. Empty schema containers have no leaf registrations. There is no arbitrary wildcard/index-path field identity API.
- Row graphs are scoped. Cross-row/parent reads belong in parent form validation, rather than undeclared row reads into sibling stores. Collection-root errors live in the compatibility path map; nested collection projections show row errors.
- Behavior predicates are synchronous/pure. Hidden-value submission exclusion, alternate clearing policies, derived-value calculations and arbitrary dynamic schema registration outside explicit collections are not added.
- Built-in structured errors translate safely; custom/server/form-returned strings remain application literals. Register catalogs at application setup. No automatic document direction, full RTL UI audit or ICU pluralization engine is claimed.
- Local verification is Windows/Chromium/Node 24.12.0. The configured Ubuntu Node 20/22/24 CI matrix and new benchmark artifact job are **not executed locally**. Browser engines other than Chromium and additional Angular/Material majors are unverified. SSR checks and initial native Angular hydration do not establish hydration of every advanced screen/popup.
- Existing toolchain notices about example bundle sizes, ng-packagr workspace export rewriting, Angular prerender configuration and optional WASI build-tool peers remain informational; successful native builds/consumers are the verification evidence.
- No Auto Forms, DevTools UI, publishing, broad transform/plugin API or derived-state scheduler is implemented. Phase 6 has structured diagnostics, row lifetimes and behavior metadata available, but automated form generation and developer UI still require their own architecture and verification.
