# Phase 5 architecture audit and proposal

Date: 2026-11-10. Written before runtime modifications.

## Verified starting point

Read all six core source files, React and Vue bindings, Angular signals/directive bridge, and Material/Vuetify adapters. `pnpm test` passes **108 tests in 18 files**. Browser and independent consumers are reported Phase 4 baselines and must be rerun after changes; they are not inferred from unit tests.

Core blueprints distinguish tuple fields from objects with `initial`. Objects/arrays inside a field are atomic plain data. Field names are literal top-level keys, including dots. Snapshots are deep frozen copies; unchanged field snapshots retain reference identity. Notifications are synchronous, batched per write, and field listeners fire only for changed projections. Framework ownership/disposal differs, but all bridges consume this external-store contract.

Validation currently has one global AbortController/version. Any value/error mutation cancels everything; every value change clears every error. Fields validate concurrently within a run, custom validators sequentially after built-in constraints. Unknown custom dependencies are necessarily conservative. Submit captures a value revision, validates all fields freshly, and refuses stale values. Server `setError` supersedes active validation; fresh explicit validation can clear it. Disabled/readonly block user writes in adapters, while core programmatic writes and validation remain allowed. No framework imports occur in core.

## Design proposal

### Graph and scheduling (first vertical slice)

Compile immutable forward dependency lists and reverse adjacency indexes. Infer `same` edges; union explicitly declared `dependsOn`. Custom validators with omitted declarations have unknown dependencies and are included on every mutation. An explicit empty list declares independence. Unknown dependencies are diagnostic wildcard edges, excluded from cycle detection. Reject explicit/inferred cycles with a full cycle path; reject unknown references before creating state. Traverse reverse edges once per mutation, including transitive dependents. Expose frozen diagnostics, including unknown-dependency fields.

Validation ownership moves to per-field jobs (controller + unique token). Mutation cancels/invalidates only the changed/dependent closure. Global operations (reset, dispose, explicit error changes, submit) cancel all scheduled/running work. Each job captures immutable values; it can commit only if still the owning job and not aborted. Independent field requests run concurrently. Explicit validation replaces requests for its requested fields; complete validation refreshes every field. Cancellation settles the owning promise even if a remote validator ignores AbortSignal.

`validation.mode` supports manual, immediate, onChange, onBlur, onSubmit; legacy `validateOn` remains an alias when no new mode is given. Default remains manual/submit. Immediate runs initially and on changes; onChange has no initial run. Debounce is **per field**, affecting automatic changes/blur only. Explicit validate and submit bypass debounce. Scheduled fields expose pending state; running fields expose validating state. Optional positive timeout produces a validation error and aborts the job. Reset/disposal remove all timers. Tests use fake timers and controlled promises.

### Conditional behavior

Predicates receive immutable values; declared dependencies drive reevaluation, omitted declarations are conservative. Expose visible, enabled/disabled, readonly, required and validation eligibility through field state. Visibility never manipulates DOM. Hidden/disabled/readonly retain values and remain included in submission; only explicit resetWhen clears a field back to its initial value. RequiredWhen adds required validation; validateWhen gates field validation. ResetWhen is a false-to-true edge (including first evaluation), evaluated transactionally with cycle/oscillation protection. Server errors retain existing superseding semantics; affected value changes invalidate them, explicit fresh validation replaces them. No behavior config preserves existing behavior.

### Paths and collections

Use explicit `nested(schema)` and `collection(itemSchema, initialItems)` constructors; never reinterpret existing `{initial: object}` or tuple array values. Literal existing names keep priority. Canonical nested paths use escaped dot segments (`\\.` and `\\\\`), with reserved prototype segments rejected. Typed leaf paths and values must flow through framework bindings. Values remain nested data; field state/errors/touched have documented path projections plus nested projections. Immutable path writes clone only owned data and reject malformed/unsafe paths.

Collection rows own opaque monotonic keys independent of position. Operations preserve each surviving row's errors/touched/dirty and cancel removed row jobs. Index paths describe current position, keys describe lifetime; consumers use keys for UI reconciliation. Rebuild graph indexes atomically after structural edits; reset restores initial rows with fresh lifetimes. Atomic arrays remain unchanged. Avoid widening existing field inference to `any`.

### Form validation and localization

Form validators own cancellation/versioning separate from field jobs and support optional explicit dependencies. Full validation/submit always refresh them. Merge errors deterministically: server errors supersede active work, field errors precede form-field errors, form-wide errors have a separate projection. Preserve retry behavior of fresh validation. Keep structured rule code/label/params/source alongside compatibility strings. Locale changes rerender messages without running validators or replacing custom/server literal strings. English default templates remain byte-compatible; Arabic and custom registered catalogs fall back to English. Never change document direction.

### Compatibility and measurements

No framework dependencies in core, no publishing, no Auto Forms/DevTools. Existing field methods, literal keys, atomic values, lifecycle and server retry behavior remain. Additive state/API changes only; any unavoidable breaking change requires approval before proceeding. Frameworks must demonstrate actual subscriptions for each newly exposed capability, not just core tests.

Preserve a source baseline before changing runtime. Benchmark 10/100/1000 fields with warmup, repeated samples, median/p10/p90, notification counts and optional exposed-GC heap deltas. Measure creation, writes, dependency invalidation, full validation, scheduler and collection operations; record Node/OS/sample methodology and avoid arbitrary pass thresholds. CI matrix is only verified if actually executed.

## Milestone gates

Implement and verify graph → selective invalidation → field scheduler → subscriptions first. Run existing tests and representative framework integration tests before expanding. Each later milestone must have passing focused tests before proceeding. Final acceptance retains `pnpm check`, `pnpm examples:build`, `pnpm test:browser`, and `pnpm test:packages`.

## Compatibility refinement before final acceptance

The original architecture explicitly documented circular `same` constraints as supported comparisons of frozen values. Rejecting these would unnecessarily break an existing consumer. This refines the original reject-all cycle proposal above: the implemented policy preserves inferred-only `same` cycles (bounded once-per-field traversal, diagnostic cycle paths) and rejects cycles containing a **new explicit** `dependsOn` edge. Strongly connected components are computed in linear graph traversal; an explicit edge inside a component triggers an actionable diagnostic-path search. This retains existing semantics without introducing recursive validation scheduling or a breaking API migration.

Collections refine the initial global-index-rebuild proposal into scoped row graphs. Every row owns a stable store and local typed paths; parent graphs reference the collection root. Structural edits allocate/dispose row graphs instead of rewriting index-based field identities. Parent form validation covers cross-row reads. This avoids changing any existing atomic array API and makes subscription/async ownership independent of reorder. The public guide explicitly documents that parent index strings are not a field-identity API.
