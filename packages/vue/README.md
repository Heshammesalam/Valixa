# valixa-vue

Vue 3.5 Composition API bindings for the framework-independent Valixa core. Vue is
a peer, never bundled. JavaScript and TypeScript share the same runtime API.

## Getting started

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useValixa, useValixaState, useValixaAdapter, nativeText } from 'valixa-vue';
const form = useValixa({ email: ['', 'required | email'] });
const state = useValixaState(form);
const email = useValixaAdapter(form, 'email', nativeText);
const requestError = ref('');
const submit = form.handleSubmit(async (data, { signal }) => {
  // await yourApi.save(data, { signal });
});
async function onSubmit(event: Event) {
  try { await submit(event); } catch { requestError.value = 'Please retry.'; }
}
</script>
<template>
  <form novalidate @submit="onSubmit">
    <label :for="email.id">Email</label>
    <input v-bind="email" type="email" />
    <span v-if="state.errors.email?.[0]" :id="email['aria-describedby']">{{ state.errors.email[0] }}</span>
    <button :disabled="state.submitting">Save</button>
    <button type="button" @click="form.reset()">Reset</button>
    <p role="status">{{ requestError }}</p>
  </form>
</template>
```

## Ownership and projections

- `useValixa(definitionOrBlueprint, options?)` creates a raw core form and registers
  immediate disposal with the active Vue effect scope. Call it once in setup.
  Component rerenders and prop changes do not replace it. Reset restores original
  defaults. Reinitialize by remounting the owner with an explicit new Vue key.
- `useValixaState(form)` returns a readonly ref of the immutable `FormState<V>`.
  This explicitly opts into whole-form updates. `form.state` alone is not reactive.
- `useValixaField(form, name)` returns `VueField<T>`: `name`, `id`, a readonly
  `state` ref containing core `FieldState<T>`, `setValue(T)` and `onBlur()`.
  User writes guard current disabled/readonly flags. Core programmatic writes remain
  allowed. Blur calls core `setTouched`, including opt-in blur validation.

Snapshots remain raw and deeply immutable. A shallow custom ref tracks replacement
without deep conversion; getters read current core snapshots even before mount.
Projections are cached per store/field/effect scope, so repeated readers in the same
scope share one subscription. Different field components have independent updates.
Whole-form status belongs in a separate component when parent rerenders matter.

Component subscriptions start on mount and stop on scope disposal; SSR therefore
does not subscribe external stores. Standalone `effectScope().run(...)` subscribes
immediately. Before mount, getters are current but setup watchers are not notified
of core writes until mount; establish initial data before rendering derived bindings.

All resource-owning/projection composables require an active scope. Outside one,
they throw before creating forms/subscriptions. For non-component usage:

```js
import { effectScope } from 'vue';
import { useValixa, useValixaState } from 'valixa-vue';
const scope = effectScope();
const form = scope.run(() => useValixa({ email: ['', 'required | email'] }));
const state = scope.run(() => useValixaState(form));
form.setValue('email', 'user@example.com');
console.log((await form.validate()).valid, state.value.dirty);
scope.stop(); // aborts pending work and disposes the owned form
```

Externally created forms remain owned by their creator. Reading them in composables
only owns the subscription. Unmounting those readers does not dispose the form.
Create a fresh owned form per SSR request. SSR rendering is tested; hydration,
Nuxt integration and non-component fallback ID hydration are not claimed.

## Template unwrapping

Top-level refs unwrap in Vue templates. Use `const state = useValixaState(form)`
then `state.submitting`. `VueField.state` is nested: either access it in script
(`field.state.value`) or expose it as a top-level setup ref. Adapters return a
top-level computed prop object for direct `v-bind`, avoiding nested-ref ambiguity.
Do not call composables from templates, render functions or event handlers.

## Typed provide/inject

```ts
const key = createValixaKey<{ email: string }>('Login'); // export from a shared module
// Parent setup:
provideValixa(key, form);
// Descendant setup:
const shared = injectValixa(key);
```

`ValixaKey<V>` is a typed Vue `InjectionKey<ValixaForm<V>>`. Independent keys isolate
multiple forms. Missing providers or use outside component setup throw. Providing
a form does not transfer ownership. Keys retain the consumer's field-name/value
types without a global generic context assertion.

## Custom adapters

`defineValixaAdapter<T, P>(map)` registers an immutable mapping function. The mapper
receives `VueField<T>` and returns component props. `useValixaAdapter(form, name,
adapter)` returns `ComputedRef<P>`. Read `field.state.value` inside the mapper so
computed dependencies remain reactive. Do not snapshot values outside that function.

```ts
const counter = defineValixaAdapter<number, {
  value: number; inactive: boolean; issue: string | undefined;
  onAmount: (payload: { amount: number }) => void;
}>(field => ({
  value: field.state.value.value,
  inactive: field.state.value.disabled || field.state.value.readonly,
  issue: field.state.value.errors[0],
  onAmount: payload => field.setValue(payload.amount)
}));
const seats = useValixaAdapter(form, 'seats', counter);
// <MyCounter v-bind="seats" /> -- MyCounter emits 'amount' with { amount }
```

Map `onUpdate:modelValue` for Vue model events, `onInput` for native DOM input, or
`onAmount` for a custom event. There is no name guessing or mutable global registry.
Adapter reader/writer types are invariant: nullable writers cannot bind non-nullable
fields. `nativeText` is a provided string input/textarea adapter with flags and ARIA;
render error descriptions using its returned description ID.

## Validation and submission

Core alone validates. `validate()` / `validate(name)` are manual; default triggering
is submit/manual. `validateOn: 'change'` or `'blur'` opts into core policies.
Custom and async validators receive the existing snapshot context and AbortSignal.
`same:password` reads the core snapshot for cross-field validation. No Vue dependency
graph or debounce scheduler has been added. Any changed value conservatively clears
errors and cancels old validation. A blur request can therefore be cancelled when
another field changes; submission revalidates the entire form. `valid` initially
means no known errors, not completed validation.

`await form.submit(handler)` executes now. `form.handleSubmit(handler)` creates an
event callback. Create it in setup and bind that callback, or explicitly invoke it
with the event. `@submit="form.handleSubmit(handler)"` alone only creates a callback
at event time and does not submit. Core prevents default when given the event.

Both methods retain core `SubmitResult<V, R>` and rejection behavior. Catch event
handler rejections and set request UI. Map known server payloads using `setError`;
do not assume an HTTP client or 422 response shape. Cancellation remains cooperative,
and the lock stays owned until callbacks settle. Reset, cancellation and disposal
retain core semantics. No error is silently swallowed by the composables.

## JavaScript and TypeScript

JavaScript needs no annotations: remove `lang="ts"` and event/type annotations.
TypeScript infers primitive values and valid field names from tuples/objects.
Annotate nullable or empty array initial values, e.g. `initial: null as number | null`
or `initial: [] as string[]`. Unknown names, wrong values and incompatible typed
adapters fail strict checks against the emitted declarations.

Exports: `useValixa`, `useValixaState`, `useValixaField`, `createValixaKey`,
`provideValixa`, `injectValixa`, `defineValixaAdapter`, `useValixaAdapter`, `nativeText`;
types `VueField`, `VueFieldAdapter`, `CompatibleFieldName`, `ValixaKey`, `NativeTextProps`.
ESM only, side-effect metadata, declarations and source maps. No Vuetify or React
dependency. Core still only stores acyclic plain data.

## Optional Auto Forms and DevTools

Phase 6 adds valixa-vue/auto and valixa-vuetify/auto. Install valixa-auto explicitly when using these optional entries. Manual root exports remain independent. Dates require explicit codecs; custom renderer registries and group/row metadata are application-owned.
The /devtools entry binds the shared panel to an explicit inspections list. Install valixa-devtools, attach in the form owner lifecycle and detach on cleanup; panel unmount only releases panel subscriptions. Values/messages are redacted by default.
See docs/phase-6.md in the repository for examples, capabilities, privacy and compatibility limits.
