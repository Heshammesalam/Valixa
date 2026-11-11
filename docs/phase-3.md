# Phase 3: Vue 3 and Vuetify

Read the [audit](phase-3-audit.md) for decisions made before implementation.
See the [implementation report](phase-3-report.md) for tested versions and results.
Public guides ship with the packages:

- [Vue getting started, JavaScript/TypeScript, scope lifecycle and template refs](../packages/vue/README.md)
- [Vuetify component reference, normalization, files and keyboard behavior](../packages/vuetify/README.md)
- [Custom component adapters](../packages/vue/README.md#custom-adapters)
- [Validation, async cancellation, server errors and submission](../packages/vue/README.md#validation-and-submission)
- [Complete runnable examples](../examples/vue-vuetify/README.md)

## Public API

```ts
const form = useValixa({ email: ['', 'required | email'] });
const state = useValixaState(form);
const email = useVuetifyField(form, 'email', { kind: 'text', required: true });
// <v-text-field label="Email" v-bind="email" />
// <v-btn :loading="state.submitting" />
```

Core snapshots and Vue projections are separate. Explicit setup-time composables
return refs/computed bindings; they do not mutate core into a deep reactive proxy.
No subscriptions are created during template rendering. Provider keys are typed.
Component unmount and effect-scope stop release subscriptions and owned forms.

SSR rendering avoids external store subscriptions before mount. Hydration and Nuxt
are not claimed. Component `useId` IDs are per app; fallback effect-scope IDs should
not be used as a cross-request hydration scheme.

## Verification

```sh
pnpm check
pnpm examples:build
pnpm exec playwright install chromium
pnpm test:browser
pnpm test:packages
```

Examples build and browser testing include both React and Vue apps. Package checks
retain the three React/MUI consumers and add Vue without Vuetify/React and Vuetify
with actual peers. Consumers live under the OS temp directory, outside workspace
ancestors, with offline installs from pnpm's populated store. Run workspace install
first. Tarballs are under ignored `artifacts/packages` and nothing is published.

Node SSR's style loader skips CSS assets only; it renders actual Vuetify components.
Browser production checks load actual styles and test real interactions. Rollup
checks that unselected adapter exports can be removed from installed ESM output.

## Boundaries

No core runtime changes, dependency graph, debounce scheduler, Angular integration
or other Phase 4 features are included. Validation and publication performance retain
their existing conservative semantics. File bytes stay outside core and must be
uploaded explicitly. Core remains plain-data-only. Full compatibility claims are
limited to the versions and verification evidence in the implementation report.
