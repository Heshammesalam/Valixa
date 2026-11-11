# @valixa/vuetify

Explicit Vuetify 3.13 bindings on top of Valixa Vue. Vue 3.5 and Vuetify 3.13 are
peers, never bundled. Core remains independent from both frameworks.

## Getting started

```vue
<script setup lang="ts">
import { useValixa, useValixaState } from '@valixa/vue';
import { useVuetifyField } from '@valixa/vuetify';
const form = useValixa({ email: ['', 'required | email'] });
const state = useValixaState(form);
const email = useVuetifyField(form, 'email', { kind: 'text', required: true });
const submit = form.handleSubmit(async (data, { signal }) => { /* await your API */ });
async function onSubmit(event: Event) {
  try { await submit(event); } catch { /* Show request error UI */ }
}
</script>
<template>
  <form novalidate @submit="onSubmit">
    <v-text-field label="Email" v-bind="email" />
    <v-btn type="submit" :loading="state.submitting">Save</v-btn>
  </form>
</template>
```

Install/configure Vuetify and its styles/icons in your application as usual. The
adapter supplies behavior, not components, layout, themes or global registration.
See the runnable `examples/vue-vuetify` project for complete setup.

## Component reference

`useVuetifyField(form, name, options)` returns a computed props object. Configure it
once in setup, expose it as a top-level binding, then `v-bind` directly. It makes one
field projection and shares its subscription with other readers in the same scope.

All kinds include ID/name, `modelValue`, `onUpdate:modelValue`, blur/touched events,
`errorMessages`, error/disabled/readonly flags, required and ARIA-required metadata.
Labels may be passed in options or on the component. Error/helper IDs are managed
by Vuetify's real inputs; do not replace them with unrelated custom IDs. `required`
is explicit UI metadata and does not add a core validation rule.

| Kind | Component and options | Model/clearing contract |
| --- | --- | --- |
| `text` | VTextField | String fields, nullable/undefined initial values display empty; null emissions become empty string |
| `textarea` | VTextarea | Same text normalization with native multiline behavior |
| `number` | VTextField; required `emptyValue` matching the field type | Input strings become finite numbers; empty/invalid input uses the explicit policy; model renders null as empty |
| `checkbox` | VCheckbox | Boolean model; null clearing becomes false; no custom true/false tokens |
| `switch` | VSwitch | Boolean model; Vuetify 3.13 exposes a checkbox accessibility role |
| `radio` | VRadioGroup | Scalar string/number model; define VRadio children and their matching values |
| `select` | VSelect | Explicit `multiple`; single requires typed `clearValue`; arrays clear to [] |
| `autocomplete` | VAutocomplete | Same selection model rules, retaining Vuetify's search and keyboard behavior |
| `combobox` | VCombobox | Free string entries plus configured item values; see below |

Selection options also accept `itemTitle`, `itemValue`, and `returnObject`. Primitive
items default to `returnObject: false`. Object item values require `returnObject:
true`, so core receives plain item objects rather than surprising IDs. Vuetify's
comparison handles the copied core values; specify stable item keys for object lists.

```ts
const country = useVuetifyField(form, 'country', {
  kind: 'select', multiple: false, clearValue: ''
});
const skills = useVuetifyField(form, 'skills', { kind: 'select', multiple: true });
const city = useVuetifyField(form, 'city', {
  kind: 'autocomplete', multiple: false, clearValue: null,
  returnObject: true, itemTitle: 'title', itemValue: 'id'
});
```

Supply `items` and labels yourself. Null/undefined multiple selections display [];
null emissions clear to []. Single null/undefined emissions use the required
`clearValue`. Typed options reject incompatible field/component combinations and
array/single mismatches. No automatic component detection is attempted.

## Combobox values

Combobox supports values entered without an item. String-only items use string or
string-array fields and `returnObject: false`. Object-item selection also permits
new **strings**, so declare `string | Item | null` for single values or
`(string | Item)[]` for multiple values, with `returnObject: true`. Object-only fields
are statically rejected because they cannot represent free entries. Single fields
still require a typed `clearValue`.

```ts
// Blueprint: tags: { initial: [] as (string | { id: number; title: string })[] }
const tags = useVuetifyField(form, 'tags', {
  kind: 'combobox', multiple: true, returnObject: true,
  itemTitle: 'title', itemValue: 'id'
});
// <v-combobox :items="items" v-bind="tags" chips />
```

Vue/Vuetify owns local search/draft text until a selection, Enter or blur commits
the model. Core validates committed data. Optional `auto-select-first` is an
application choice for Autocomplete; it changes how Enter accepts a highlighted
result. Keyboard, focus and menu behavior remain Vuetify's own.

## File boundary

Core rejects File objects. `useVuetifyFileField(form, name, codec, { multiple })`
stores local File objects in shallow adapter state and sends only `codec.encode`
output to the normal typed core field. No bytes are serialized into core or logs.

```ts
import { fileMetadata, useVuetifyFileField } from '@valixa/vuetify';
import type { FileMetadata } from '@valixa/vuetify';
// Blueprint: uploads: { initial: [] as FileMetadata[] }
const upload = useVuetifyFileField(form, 'uploads', fileMetadata, { multiple: true });
const files = upload.props; // top-level computed binding for the template
// <v-file-input label="Attachments" v-bind="files" />
// Upload actual bytes from upload.files.value inside your API callback.
```

`FileMetadata` contains name, size, type and lastModified. The standard `fileMetadata`
encoder maps selected files to these plain objects. `FileCodec<T>` only exposes
`encode(readonly File[]): T`; it cannot recreate bytes from saved metadata.
`upload.files` is readonly and retains actual File identity. `clearLocal()` forgets
bytes without changing persisted metadata, useful after an application-owned upload.

The adapter normalizes File/File[]/null payloads according to `multiple`, guards
readonly/disabled events, clears local bytes on scope disposal, and clears them when
the field's metadata changes externally (including normal reset). Error/pending
changes alone do not erase local files. Custom codecs should distinguish empty and
selected states. If encoded data is unchanged, core has no reset-event/version
contract; call `form.reset(); upload.clearLocal()` for an unconditional file reset.
Examples do so. Saved metadata does not imply a selected or uploadable file.

## Validation, custom components and submission

Bindings pass empty Vuetify rules and submit-only internal triggers. Use Valixa's
rules/custom/async validators; do not add a competing Vuetify rules array or call
`VForm.reset()` as a replacement for core reset. Examples use native `<form
novalidate>` and core submission. Current error messages flow through Vuetify's
standard helper region; its display limits/layout remain application-customizable.

Core's manual/submit default, optional change/blur policies, cancellation, stale
protection, cross-field rules, server errors and submission lock remain unchanged.
Edits conservatively invalidate errors and can cancel another field's pending blur
validation. `form.setError` maps known server payloads. `submit` executes immediately;
`handleSubmit` returns a callback. Bind a setup-created callback and catch request
rejections. See the Vue package guide for complete validation/submission patterns.

For custom UI, use `defineValixaAdapter` / `useValixaAdapter` from `@valixa/vue`.
Map any value prop, update event and custom error/disabled props explicitly. There
is no wrapper requirement or guessing. The advanced example maps `value`,
`inactive`, `issue` and an `amount` event carrying `{ amount: number }`.

## Limits and packaging

Exports: `useVuetifyField`, `useVuetifyFileField`, `fileMetadata`; types `FieldOptions`,
`VuetifyOptions`, `SelectOptions`, `VuetifyBinding`, `VuetifyCommonProps`, `Item`,
`FileCodec`, `FileMetadata`, `FileField`. No public `any` types are introduced.

ESM, declarations, source maps, raw sources and side-effect metadata ship in the
package. CSS belongs to the application's Vuetify install. Plain Node SSR needs
style asset handling, as with Vuetify itself; the package smoke test uses a style
loader and actual Vuetify components. Production browser tests include real CSS.

Only declared Vue 3.5/Vuetify 3.13 peers and the reported local Chromium environment
were tested. No Vue 2/Vuetify 2 or 4, Nuxt hydration, other browsers/mobile, complete
WCAG conformance or large-form performance claim is made. Core still lacks dynamic
paths, a dependency graph and debounce scheduling; those are separate phases.

## Optional Auto Forms and DevTools

Phase 6 adds @valixa/vuetify/auto with @valixa/vue/auto. Install @valixa/auto explicitly when using these optional entries. Manual root exports remain independent. Dates require explicit codecs; custom renderer registries and group/row metadata are application-owned.
See docs/phase-6.md in the repository for examples, capabilities, privacy and compatibility limits.
