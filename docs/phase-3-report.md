# Phase 3 implementation report

Date: 2026-11-08. Phase 3 implemented; Phase 4 not started. No package published.

## Architecture and public API

The [repository audit](phase-3-audit.md) reviewed existing APIs and implementation
before changes. No runtime code in core, React or MUI was changed.

`@valixa/vue` provides:

- `useValixa`: one raw core form per component setup/effect-scope call, owned by
  that scope. Explicit remounts reinitialize; ordinary updates preserve input.
- `useValixaField`: typed, readonly field-state projection and guarded user writers.
- `useValixaState`: explicit whole-form readonly projection.
- `createValixaKey`, `provideValixa`, `injectValixa`: typed scoped sharing.
- `defineValixaAdapter`, `useValixaAdapter`, `nativeText`: explicit model/event
  mapping with invariant reader/writer types and no public `any` additions.

Shallow custom refs read raw immutable snapshots. A per-scope cache deduplicates
subscriptions to the same store/field. Component subscriptions begin on mount;
standalone effect scopes subscribe immediately. Disposal releases subscriptions
and owned forms. SSR does not subscribe externally owned forms, avoiding retention
without a client unmount. Vue setup and scope lifetimes are used directly; React
effect replay mechanics were not copied.

`@valixa/vuetify` provides `useVuetifyField(form, name, options)`, a computed prop
object used directly with `v-bind`. Component kinds make event/value contracts
explicit. The file boundary is a separate `useVuetifyFileField` composable with a
typed encoder and local File cache. Bytes do not enter core.

```ts
const form = useValixa({ email: ['', 'required | email'] });
const state = useValixaState(form);
const email = useVuetifyField(form, 'email', { kind: 'text', required: true });
// <v-text-field label="Email" v-bind="email" />
// <v-btn :loading="state.submitting" />
```

`submit(handler)` still executes now. `handleSubmit(handler)` creates an event
callback; examples create it in setup and explicitly catch request failures.
Core alone performs validation, cancellation, race protection, conservative error
invalidation, server-error writes, submission locking and reset.

## Components implemented

VTextField, VTextarea, VSelect (single/multiple), VAutocomplete (including object
values), VCombobox (string/object/multiple), VCheckbox, VRadioGroup, VSwitch,
VFileInput and numeric VTextField bindings. Null clearing, finite numeric parsing,
explicit single clear policies, readonly/disabled guards, required UI metadata,
error messages and Vuetify-managed label/description wiring are included.

VCombobox object lists require a value union that can also represent free strings.
`FileMetadata` and the `fileMetadata` codec encode name/size/type/lastModified while
actual files remain available through `upload.files.value` for an application API.

Three complete SFC examples use actual native/Vuetify components: login,
registration with async username and mapped server errors, and advanced controls
with local files, custom event payloads, readonly toggling and reset.

## Verification

Local environment: Windows; Node 24.12.0; pnpm 10.26.2; TypeScript 5.9.3;
Vue/server-renderer 3.5.45; Vuetify 3.13.7; vue-tsc 3.3.14;
Vue Test Utils 2.5.1; Vitest 4.1.12; Vite 6.4.5; Vue Vite plugin 6.0.10;
Playwright 1.65.0; Chromium 158.0.8127.18.

| Command/check | Result |
| --- | --- |
| `pnpm check` | Five package builds/declarations, strict TypeScript and Vue SFC checks, 88 passing tests across 12 files, original JS/TS consumer examples |
| Phase 1/2 regressions | All original 68 tests preserved and passing, including the original 51 core tests |
| Vue-specific tests | 20 passing tests across 6 files: ownership, cache isolation, cleanup, async races, requests/reset, actual component contracts, files, custom payloads, types and SSR |
| `pnpm examples:build` | Both React and Vue production apps build; all six example screens compile |
| `pnpm test:browser` | All 6 production-build E2E tests pass: original 3 React/MUI flows plus 3 Vue/Vuetify flows |
| `pnpm test:packages` | All 5 independent consumers pass: React, MUI, optional MUI X, Vue-only, Vuetify |
| `pnpm test:packages:vue` | Both Vue consumers pass JavaScript/SSR, declarations, peer isolation, maps/exports and Rollup tree-shaking checks |

Browser interactions include accessible native error descriptions, required fields,
async username errors, keyboard selection, mapped server rejection and retry,
object selection, free-text tags, multiple values, actual file selection, numeric
input, radio/checkbox/switch, custom controls, readonly attributes and reset.
No mock Vue/Vuetify components replace integration tests. jsdom only supplies
missing browser layout primitives; production Chromium tests use actual CSS/layout.

Vue-only installs outside workspace ancestors contain neither React nor Vuetify.
Vuetify consumers install actual declared peers. Both use offline pnpm installs
from the populated store, with local tarballs and rewritten workspace dependencies.
JavaScript consumers validate and submit before SSR rendering. TypeScript consumers
assert correct names/value inference and deliberate invalid usages against emitted
declarations. SSR renders real VTextField using a Node style-asset loader. Rollup
verifies that unrelated exports disappear from selected installed ESM entry points.
Tarballs live under `artifacts/packages/`; consumers stay in OS temp for inspection.

Existing CI commands now include Vue package/SFC checks, all consumers and both
production example apps. The configured Linux/Node matrix has not been run locally.

## Documentation

- [Vue getting started, JS/TS, scopes, custom adapters, validation and submission](../packages/vue/README.md)
- [Vuetify integration and component/file reference](../packages/vuetify/README.md)
- [Example setup and template compiler configuration](../examples/vue-vuetify/README.md)
- [Phase overview and commands](phase-3.md)

## Known limitations

- Compatibility evidence is for the listed Vue/Vuetify versions and Chromium on
  Windows. No Vuetify 2/4, Vue 2, Firefox, WebKit, mobile or complete WCAG claim.
- SSR rendering is tested, but hydration/Nuxt integration is not. Non-component
  fallback IDs are not a cross-request hydration scheme.
- Component projections notify after mount. Raw getters are current beforehand,
  but setup watchers do not receive pre-mount store notifications. Establish initial
  state before deriving rendered bindings. All resource composables require scope.
- Fields receive explicit required/label UI metadata; this does not replace core
  validation. Vuetify display limits and application slot overrides remain UI-owned.
- `checkUnknownProps: false` permits valid Vuetify native attribute/event fallthrough
  in otherwise strict Vue templates. Declared props, core values and adapter options
  remain type-checked. No blanket `any` workaround was added to public APIs.
- File encoders cannot reconstruct bytes from saved metadata. External metadata
  changes clear local files; unchanged encodings have no reset version to observe.
  Use `form.reset(); upload.clearLocal()` for unconditional clearing, as the example
  does. Persisted metadata is never treated as uploadable File data.
- Core still treats nested values/arrays as atomic top-level values. No dynamic
  paths, dependency graph, debounce scheduler, locale system or performance claims
  are introduced. Conservative writes can cancel another field's blur validation.
- Validation and submission cancellation remain cooperative; callbacks that ignore
  signals can continue external effects. Callers handle rejected requests explicitly.

## Phase 4 readiness

The core remains framework-independent and its existing contract supports a future
Angular integration. Vue/Vuetify lifecycle, file state and event contracts are
contained in their own packages. Angular will need its own signals, directives,
ControlValueAccessor, Material, lifecycle and consumer/browser tests. React/Vue
evidence does not establish Angular compatibility. No Phase 4 code was added.
