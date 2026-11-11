# Phase 3 audit and API proposal

Reviewed core public API, architecture, types, snapshot/subscription implementation,
validation/submission/disposal behavior and React/MUI code and decisions before
implementation. No applicable AGENTS.md was found. Existing code is preserved.

## Findings

- Core caches immutable field snapshots and exposes synchronous subscriptions with
  unsubscribe functions. Whole-form snapshots change on every publication.
- Core owns validation (manual/submit by default), async cancellation/versioning,
  conservative error invalidation, server errors, reset and submission locks.
- `submit(handler)` executes immediately; `handleSubmit(handler)` returns a callback.
  The desired template `@submit="form.handleSubmit(handler)"` would merely create
  a callback at event time, not execute it. Examples must create the callback during
  setup, then bind it to the form and catch request rejections explicitly.
- Core objects must remain raw; deep proxies around immutable snapshots add no value.
  File/Date/class instances are rejected. File selection needs an adapter-side cache
  and explicit metadata encoding, with bytes kept outside core.
- React's effect replay and external-store hooks are framework-specific. Vue setup
  runs once per component; scope disposal can be immediate without replay deferral.

## Vue-specific risks and decisions

1. `useValixa` creates one raw core form per setup/effect-scope call. Reset restores
   original defaults. Changing props does not replace the instance; an explicit key
   remount is the reinitialization mechanism.
2. `useValixaState` and `useValixaField` project immutable snapshots into read-only
   shallow refs, with cached subscriptions per form/field/effect scope. Multiple
   readers in one scope share the projection. Inputs do not subscribe to whole forms.
3. Component subscriptions start on mount, preventing SSR from subscribing externally
   owned forms without unmount cleanup. Projections read the latest snapshot even
   before mount. Standalone effect scopes subscribe immediately. All composables
   require an active scope and fail before allocating resources when absent.
4. Top-level refs unwrap in templates, nested refs do not reliably do so. Component
   adapters return computed prop objects directly: `const email = useVuetifyField(...)`
   followed by `v-bind="email"`. No composable or new subscription is created during
   rendering. Whole-form status is an explicit top-level `state` ref.
5. Vuetify payloads differ: text clearing emits null; selection models may be arrays
   or objects; checked values need boolean normalization; combobox free entries can
   be strings even with object items; files may be File/File[]/null. Each kind has
   explicit normalization and a typed value contract.
6. External errors flow through `errorMessages`; empty Vuetify rules and submit-only
   internal validation prevent a parallel validation engine. Labels and required UI
   metadata remain explicit application-owned options.
7. SSR uses initial snapshots without browser globals or subscriptions. Vue `useId`
   supplies deterministic component IDs; non-component scopes use local fallback IDs
   and are not an SSR hydration contract. Provider/injection uses typed keys.

## Proposed public API

```vue
<script setup lang="ts">
import { useValixa, useValixaState } from '@valixa/vue';
import { useVuetifyField } from '@valixa/vuetify';
const form = useValixa({ email: ['', 'required | email'] });
const state = useValixaState(form);
const email = useVuetifyField(form, 'email', { kind: 'text', required: true });
const submit = form.handleSubmit(async data => { /* await your API */ });
const onSubmit = (event: Event) => submit(event).catch(error => { /* request UI */ });
</script>
<template>
  <form novalidate @submit="onSubmit">
    <v-text-field label="Email" v-bind="email" />
    <v-btn type="submit" :loading="state.submitting">Save</v-btn>
  </form>
</template>
```

Vue exports ownership, field/state projections, typed provide/inject keys, native
text binding and typed mapping-function adapters. Vuetify exports a discriminated
component-kind binding composable plus a dedicated file-boundary composable.
No framework imports or API changes enter core. No Phase 4 features are included.

Reference: [Vue shallow reactivity and scope disposal](https://vuejs.org/api/reactivity-advanced.html),
[component models](https://vuejs.org/guide/components/v-model),
[Vuetify combobox](https://vuetifyjs.com/en/components/combobox/).
