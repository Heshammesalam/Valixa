# Architecture and phase boundaries

`@valixa/core` is a synchronous external store with immutable snapshots and private mutable state. Core has no runtime dependencies, framework imports or DOM operations. Separate packages supply React/MUI, Vue/Vuetify and Angular/Material projections. Applications own UI composition and rendering.

## Modules

- `types.ts`: schema/value inference, typed paths, state, validation and submission contracts.
- `data.ts`: plain-data cloning, freezing/equality and callback-preserving configuration copies.
- `rules.ts`: parsed rule pipelines, eager parameter diagnostics and predicates; no expression evaluation.
- `blueprint.ts`: reusable definitions, explicit nested/collection grammar, safe paths and eager graph checks.
- `graph.ts`: immutable forward/reverse indexes, unknown-dependency diagnostics and cycle detection.
- `behaviors.ts`: dependency-aware predicates and convergent conditional reset drafts.
- `paths.ts`: escaping, safe own-property traversal and nested projections.
- `collection.ts`: stable row keys, independent row stores/graphs, movement, subscriptions and disposal.
- `locales.ts`: English/Arabic catalogs, registration, interpolation and structured error rendering.
- `form.ts`: synchronous transitions, cached field projections, field/form scheduling and submission ownership.

## State and validation ownership

Value writes clone and validate data before publishing, invalidate the reverse dependency closure and retain unrelated field errors/snapshot identities. Built-in `same` and explicit `dependsOn` create graph edges. Unknown custom-validator dependencies remain conservative. Cycles containing new explicit edges are rejected with actionable paths; legacy inferred-only `same` cycles compare frozen values with bounded traversal. Wildcards are diagnostic conservative reads rather than explicit cycle edges.

Every field owns a cancellation token and automatic debounce timer. Native AbortControllers are allocated lazily when a signal is needed; independent requests still have separate ownership. Custom validators within a field remain sequential after built-in constraints. Obsolete work cannot commit. Cancellation settles the core promise even if remote work ignores signals. Optional timeout aborts and produces a structured error. Reset/disposal cancel scheduled and running work. Result commits ready in the same microtask share publication; ordinary writes and field notifications remain synchronous.

Phase 5.1 shares owned, deeply frozen value leaves, nested branches, defaults and error metadata. External writes are copied at the boundary; error maps use copy-on-write batches. Field projections are created/read lazily and eagerly refreshed for active field subscribers. Unchanged projections and public branches retain identity, and no-op public snapshots are reused. Flat value-record updates and some nested/collection projections still have linear costs; this is structural sharing, not a constant-time update claim. Collections reuse row value objects and item arrays on nonstructural events and cache error/touch/dirty aggregates. See the [performance report](phase-5-1-report.md).

Full validation/submit starts fresh complete validation, including row stores and the optional form validator. Form validation has separate ownership, dependencies and debounce. Submit retains the lock, value revision checks and cooperative cancellation contract from Phase 1. Server errors supersede active work; fresh validation can replace them for retry. Field errors precede form-field errors; form-wide messages have their own projection.

## Explicit structure and presentation

Existing object/array field definitions remain atomic. `nested` introduces escaped typed leaf paths and nested snapshots. `collection` introduces a row namespace: keys identify lifetimes, indices identify current positions. Each row store owns local validation dependencies. Parent graphs depend on collection roots; cross-row constraints use parent form validation. Parent index strings do not act as permanent field identities. Reorder preserves rows; removal/replacement/reset disposes old lifetimes.

Behaviors expose visible, enabled/disabled, readonly, required and validation eligibility without rendering. Values stay included unless explicitly reset; hidden/disabled fields still validate unless gated. Locale switching rerenders structured errors, preserves literal custom/server strings, and never changes document direction.

## Framework boundaries

React uses `useSyncExternalStore`; Vue uses scope-owned shallow projections; Angular uses DestroyRef-owned cached signal projections. New leaf paths flow through shared `FieldValue` typing. Real UI-library adapters continue to own payload/codecs rather than importing UI logic into core. Collection row views borrow stores owned by their collection; Angular's additive `bindValixa` releases view subscriptions without disposing the row.

See the [Phase 5 audit](phase-5-audit.md), [advanced public guide](../packages/core/ADVANCED.md) and [implementation report](phase-5-report.md). Preserved sources are retained only for paired benchmarks.

## Optional presentation and inspection

`@valixa/auto` binds explicit, typed UI metadata to value-free blueprint descriptions.
Plans are immutable and contain no live values. Optional React/Vue `/auto` entries
render field-subscribed views; MUI/Vuetify registries own UI conversions. Dedicated
Angular APF renderers use signals, DI and typed template contexts. Row views borrow
collection stores and reconcile by stable keys. Reset events clear widget drafts.

Core `observeEvents` emits value-free metadata at real scheduling, validation,
submission and collection boundaries. No framework or DOM imports enter core.
Descriptions are lazily cached; disabled instrumentation allocates no event objects.
`@valixa/devtools` explicitly attaches readonly sanitized current inspection and a
bounded metadata timeline. Optional `/panel` supplies native DOM/SVG; framework
bindings manage panel subscriptions. Attachment owners detach controllers. No global
registry, transport or persistence is introduced. Root framework entries do not
reexport optional integrations. See [Phase 6](phase-6.md) for privacy and ordering.
