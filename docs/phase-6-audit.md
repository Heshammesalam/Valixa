# Phase 6 architecture audit and contracts

Date: 2026-11-10. Audit precedes implementation. The complete existing acceptance sequence passes: `pnpm check` (158 tests), three production example builds, 12 Chromium flows, seven independent consumers, unchanged benchmarks and paired Phase 5/5.1 measurements. Evidence: `artifacts/phase-6-baseline.log`.

## Existing capabilities

Blueprint grammar is explicit: tuples/`initial` definitions are atomic, `nested` creates escaped typed leaf paths, and `collection` owns keyed row stores with local namespaces. Blueprints expose frozen field labels/rules/dependencies/defaults and item definitions. Labels describe validation, not necessarily a desired UI label. Rules do not determine a safe widget: numbers need an empty policy, selection needs explicit options/equality, dates need explicit codecs and display descriptions/layout are absent.

Core field state already includes visibility, required, disabled/readonly, validation eligibility, errors, touch/dirty and pending flags. Whole-form snapshots expose nested values/error/touch/dirty projections, structured validation details, locale and submission state. Dependency diagnostics include forward/reverse indexes, unknown custom reads and supported inferred-only cycles. Public state is deeply immutable with structural sharing; field snapshots are lazy, active field notifications isolated, and row values/items preserve identity. Core remains framework/DOM independent.

React uses external-store hooks; Vue scope-owned shallow projections; Angular DestroyRef-owned signals and borrowed row bridges. UI adapters explicitly handle payloads/codecs. Standard packages emit ESM/declarations; Angular uses partial-Ivy APF/ng-packagr. Optional subpaths must not enter root imports or force absent optional peers into existing consumers.

## Package and rendering contract

- `@valixa/auto`: typed UI metadata, normalization, capability diagnostics and immutable framework-independent plans. `defineAutoForm(blueprint, config)` binds names/value types; a schema parameter is deliberate so invalid names fail immediately. Labels/component choices/options/number empty policies/date codecs are explicit. No rule-to-widget guessing.
- React/Vue renderer contracts live in optional `/auto` subpaths of their existing packages; MUI/Vuetify registries in their own `/auto` subpaths. Root entry points remain unchanged. Angular Material renderer is a small dedicated APF package `@valixa/angular-auto`.
- Plans contain only presentation/structure, never live values. Groups recursively contain field/collection nodes. Collection item plans use row-local names; views reconcile by stable row key. Leaf views alone subscribe to fields. Actions/summary own whole-form subscriptions, not every field.
- Custom renderer registries/field slots, grouping/layout, descriptions/error placement and action slots remain app-owned. Number controls require an explicit empty value; selection options carry actual domain values, with explicit equality for objects; date codecs declare their view type and are adapter-checked. Unsupported widgets/codecs/custom registrations throw actionable errors before rendering. File/third-party object conversion is never guessed.
- Vue's validated `onSubmit` listener is awaited directly so `@submit` can return a promise; it is not a fire-and-forget emit. Angular uses signals/DI/typed template contexts and borrowed row stores, with standalone strict-template production verification.

## Small core additions

Expose cached, value-free structural descriptions (`describe`) plus readonly configured behavior metadata, without materializing all field projections. Add opt-in `observeEvents(listener)` at real lifecycle boundaries: field writes; automatic scheduling; request start/commit/failure/cancellation; submission start/outcome; collection insert/remove/move/replace; behavior/locale/reset/disposal. Events contain ordinal/request identifiers and safe operation metadata, **no values, messages, validation outputs or handler data**. Observers are isolated from engine correctness; listeners are allocated only on attachment and removed idempotently. Disabled overhead is measured rather than assumed zero.

Per-form order follows synchronous calls and actual promise resolution order. Independent requests are not artificially serialized. A cancellation event comes only from cancelling a real timer/request; a pending flag change is not used as evidence. Invalid validation emits failure then completion; cancelled runs do not emit completion. Row forms have independent ordinals and are tagged with stable row identities by DevTools.

## DevTools data and UI

`@valixa/devtools` provides explicit attachment, readonly sanitized inspection, subscription management, bounded value-free history, pause/resume/clear/detach, and no DOM dependency in its root entry. It does not globally register forms, transmit data, use telemetry or persist storage. Default current values and literal messages are redacted; explicit allowlists may reveal selected nonsensitive values, and sensitive-name patterns still override unless separately opted into. Redaction traverses atomic objects and has size/depth bounds. History never contains values or messages, including when display values are opted in.

Inspection descriptions do not eagerly build every field snapshot. A selected-field read is explicit. Row graphs/keys/behavior metadata are inspected without mutation. Detach/disposal unsubscribe root/row/event listeners and clear retained inspection/history; a disposed status remains without historical data. A live event subscriber can observe disposal before cleanup.

`@valixa/devtools/panel` is an optional, import-time SSR-safe DOM panel with form selection, search, current/field/error/row inspection, dependency graph and timeline, pause/resume/clear controls. It uses safe text nodes and no application UI library. Thin React/Vue optional `/devtools` bindings and a dedicated Angular APF `@valixa/angular-devtools` bind lifecycle cleanup. Creating a panel does not silently attach a form.

## Milestones and gates

First verify headless normalization and **Blueprint → UI metadata → React/MUI → validation → awaited submission** before adding Vue/Angular. Then implement instrumentation/data independently of its panel. Each milestone must pass focused tests. Retain all prior commands and consumers, add new installed package/optional-entry checks and one generated-form/DevTools browser flow per framework. Measure generated first render, isolated/conditional edits, keyed rows, disabled/enabled instrumentation and bounded history separately from unchanged core benchmarks. No fragile timing thresholds, publishing or unrelated engine rewrite.
