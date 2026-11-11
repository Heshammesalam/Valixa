# Auto Forms and DevTools

Phase 6 is optional. Existing manual bindings keep their APIs. Validation schemas
describe domain behavior; UI metadata chooses controls, labels, layout and codecs.
Nothing derives an email widget, password field or date representation from a rule.

## Shared metadata

```ts
import { blueprint } from 'valixa';
import { defineAutoForm } from 'valixa-auto';

const schema = blueprint({ name: ['', 'required'], age: [18] });
const ui = defineAutoForm(schema, {
  fields: {
    name: { component: 'text', label: 'Full name', description: 'Public name' },
    age: { component: 'number', label: 'Age', emptyValue: 0 }
  },
  layout: [{ group: 'person', label: 'Person', columns: 1, children: ['name', 'age'] }],
  submitLabel: 'Save'
});
```

The blueprint argument establishes field-name and value-type inference. Unknown
paths and incompatible widgets fail TypeScript checks. Normalization clones/freezes
plain metadata and rejects unknown paths, duplicate layout entries, omitted configured
fields, invalid row schemas and ambiguous conversions. A UI may intentionally expose
only part of a schema; full core validation still runs on submission. A rendering plan
checks matching schema paths/collection structure and adapter capabilities before rendering.
It cannot check erased runtime TypeScript value types: keep blueprint/UI pairs together.

Metadata supports `label`, `description`, `disabled`, `readonly`, `className`,
`presentationWhen(fieldState)`, and `errorPlacement`. `inline` is the default;
`summary` and `none` suppress the leaf message. The global summary is controlled
separately with `summary: false`; it includes core errors from unrendered fields too.
`presentationWhen` is a local presentation predicate; cross-field visibility/required
logic belongs in core `behaviors` with explicit `dependsOn`.

Layout entries are field paths, recursive `{group, label, columns, children}` groups,
or `{collection: 'addresses'}`. Collection metadata supplies a row-local `ui`,
`createItem`, labels, and optional `movable: false`. Views reconcile by stable row keys.
Movement preserves rows; reset/removal follows core lifetime and disposal rules.

## React and MUI

```tsx
import { useValixa } from 'valixa-react';
import { ValixaAutoForm } from 'valixa-react/auto';
import { muiAdapter } from 'valixa-mui/auto';

function Editor() {
  const form = useValixa(schema);
  return <ValixaAutoForm form={form} ui={ui} adapter={muiAdapter}
    onSubmit={async values => save(values)} />;
}
```

`onSubmit` is a core `SubmitHandler`, including its AbortSignal. `onResult` receives
the complete discriminated `SubmitResult`; only `status: 'success'` has `data`.
`onError` receives a thrown failure. The renderer displays a generic failure message.
The supplied form is borrowed; its owner controls disposal.

Use `createMuiAutoAdapter({custom, codecs})` for registries.
`defineReactAutoRenderer<T>(Component)` gives a typed `field` and `config`.
`renderField={({renderDefault, ...context}) => ...}` wraps/replaces field layout;
`renderActions={({submitting, reset}) => ...}` replaces default actions.

## Vue and Vuetify

```vue
<script setup lang="ts">
import { useValixa } from 'valixa-vue';
import { ValixaAutoForm } from 'valixa-vue/auto';
import { vuetifyAdapter } from 'valixa-vuetify/auto';
const form = useValixa(schema);
async function saveUser(values: typeof schema.__values) { return save(values); }
</script>
<template>
  <ValixaAutoForm :form="form" :ui="ui" :adapter="vuetifyAdapter" @submit="saveUser" />
</template>
```

The `onSubmit` listener/prop is awaited directly, including the promise returned by
`@submit`. It is not emitted a second time. Use one callable submit listener.
`@result`/`@error` report settlement. `#field` gets `field`, `config`, `renderDefault`;
`#actions` gets `state` and `reset`. Registries use
`createVuetifyAutoAdapter({custom, codecs})` and `defineVueAutoRenderer<T>(render)`.
Vue's component boundary erases generic props; author metadata with `defineAutoForm`
and type the submit handler. Runtime plan checks still reject mismatched paths.

## Angular and Material

Import standalone components from `valixa-angular-auto` and create an Angular form
using the existing `valixa-angular` factory in an injection context:

```html
<valixa-auto-form [form]="form" [ui]="ui" [onSubmit]="save"
  (result)="onResult($event)" (failure)="onFailure($event)" />
```

`angularMaterialAdapter` is the default. Use a shallow adapter copy to register
named `codecs`. A typed custom template binds an example field to infer its context:

```html
<valixa-auto-form [form]="form" [ui]="ui" [onSubmit]="save">
  <ng-template valixaAutoRenderer="counter" [autoField]="form.field('seats')"
    let-field let-config="config">
    <button type="button" (click)="field.setValue(field.value() + 1)">
      {{ config.label }}: {{ field.value() }}
    </button>
  </ng-template>
</valixa-auto-form>
```

Import `ValixaAutoRenderer` too. Template registry keys are application contracts;
the example field establishes context typing, but cannot prove every reuse of a
renderer key has the same erased value type. Custom renderers must respect disabled,
readonly, labels, blur and error state. Set `[showDefaultActions]="false"` and project
an element with `autoActions` to replace actions. Group layout and custom templates
are supported; arbitrary per-field layout slots are currently React/Vue only.

## Capabilities and conversions

| Component | React/MUI | Vue/Vuetify | Angular/Material |
| --- | --- | --- | --- |
| Text, email, password, number, textarea | Supported | Supported | Supported |
| Select, multi-select, checkbox, radio, switch | Supported | Supported | Supported |
| Single autocomplete, object options | Supported | Supported | Supported |
| Multiple autocomplete | Supported | Supported | Explicit error; use select/custom |
| Date | Native date input, string view | Native date input, string view | Material datepicker, Date/null view |
| Groups, keyed rows, conditions, custom controls | Supported | Supported | Supported |
| File, rich text, third-party objects | Custom renderer + explicit boundary | Custom renderer + explicit boundary | Custom renderer + explicit boundary |

Numbers require an explicit empty policy (`0`, nullable or optional only when the
domain type permits it). Choice widgets store the supplied domain options, never
guessed string conversions. Object options require `compare(a,b)`; arrays require
`multiple: true`. Metadata/options must be plain data; codecs can contain functions.

Dates require `defineAutoCodec<T, View>({view, encode, decode})` or a named codec
resolved by the adapter. React/Vue use `view: 'string'` and a native input ISO view.
Angular uses `view: 'date'` and can combine `dateOnlyCodec` with that tag. An explicit
named codec lets the same UI configuration work across all three. No implicit Date,
File, timezone or third-party object conversion is installed. MUI X remains a manual
binding integration in this release.

Leaf views subscribe only to their field; actions/summary subscribe to form state.
Collections subscribe to row structure and collection behavior. Root reset events
remount control views to clear drafts even if the domain value was already empty.
This intentionally resets focus/local widget state on form reset.

## Local opt-in diagnostics

```ts
import { attachValixaDevtools } from 'valixa-devtools';
const inspection = attachValixaDevtools(form, {
  name: 'Registration', historyLimit: 100
});
const snapshot = inspection.getSnapshot(); // readonly, redacted
const field = inspection.inspectField('name'); // explicit lazy field projection
inspection.pause(); // pauses retained timeline, not current-state updates
inspection.resume();
inspection.clear(); // timeline only
inspection.detach(); // unsubscribes and drops current/history data
```

No attachment happens until this explicit call. `enabled: false` installs no form
subscriptions. There is no global registry, network transmission, telemetry,
console logging or persistent storage. Importing the headless root or panel does
not access DOM globals. Avoid attaching in production; gate attachment and optional
imports using your application's development build flag. The package itself has no
bundler-specific environment assumption.

All current values, initial values and literal error messages are redacted by default.
Schema paths, labels/rules, graph metadata, error codes, row identities, locale and
status flags remain visible. Do not put secrets in schema labels, rule parameters,
field names or form names: structural configuration is intentionally inspectable.

Reveal selected current values with `visibleValues: ['name', 'profile', 'rows[].city']`.
`'*'` is an explicit broad opt-in. Sensitive name patterns and `sensitive: ['myField']`
still override it. `allowSensitive: true` is a separate override for those patterns;
file-like objects remain redacted. Messages additionally require `includeMessages: true`
and an allowed path (`'$form'` for form-wide errors). Messages can interpolate values;
keep them redacted when recording/sharing screenshots. Events never record values,
messages, error parameters or handler results, even when display values are opted in.

Inspection bounds: `historyLimit` defaults to 100 (0 disables retention, max 10,000),
`maxDepth: 6`, `maxNodes: 1000`, `maxStringLength: 256`, `maxRows: 1000`.
Only the current sanitized snapshot is retained alongside bounded event metadata.
Limits bound inspected value traversal/row sources, not the application's own schema
size or caller-held snapshots. Detach/disposal clears owned data and references;
it cannot revoke immutable snapshots retained by application code. Live event
subscribers see disposal before cleanup; retained disposal history is cleared.

## Panel bindings

`valixa-devtools/panel` exports `mountValixaDevtools(host, inspections)` returning
`update(inspections)` and `destroy()`. It uses the host's ownerDocument, text nodes
and native SVG; no application UI library is needed. It supports form selection,
state/selected-field/errors/behavior metadata, dependency graph, row identities,
search, timeline, pause/resume, clear and detach. Search filters field choices,
graph nodes and timeline entries; the state inspector keeps the complete sanitized
current state. The graph shows at most 80 matching nodes in the selected scope.

Thin bindings accept an explicit `inspections` list:

| Framework | Import | Usage |
| --- | --- | --- |
| React | `valixa-react/devtools` | `<ValixaDevtools inspections={[inspection]} />` |
| Vue | `valixa-vue/devtools` | `<ValixaDevtools :inspections="[inspection]" />` |
| Angular | `valixa-angular-devtools` | `<valixa-devtools [inspections]="[inspection]"/>` |

Panels borrow inspections: unmount/destroy releases panel subscriptions but does not
detach inspections. The attaching owner must detach during effect/scope/DestroyRef
cleanup. React attachment should be inside an effect (including StrictMode cleanup).
Angular mounts afterNextRender, so server rendering produces an empty host.

## Event ordering

`form.observeEvents(listener, {types?})` is the small additive core hook. It emits
immutable value-free metadata synchronously at actual lifecycle boundaries and
isolates observer exceptions. Return value unsubscribes. Use diagnostic listeners
for reads; reentrant writes are ordinary form operations and can interleave events.

Each form has monotonic `sequence`; real request owners get `request` IDs on first
observed use. DevTools adds attachment-local `ordinal` and stable row `scope`.
Independent promises complete in actual resolution order, not start order.
Automatic debounce records scheduled/cancelled timers; explicit validation starts
directly. Invalid validation emits failed then completed; successful validation emits
completed. Cancellation is emitted only when a timer/request is actually cancelled;
obsolete work cannot subsequently emit a committed completion. Submission emits
started then succeeded/failed/cancelled; busy rejection is not a new started request.
An invalid form is a submit failure with `reason: 'invalid'`, not a thrown handler
failure. Collection replace may emit row removals/additions then replaced. Reset
can emit cancellations/row lifecycle changes before the final reset event.

## Examples and verification

Run `pnpm example:react`, `pnpm example:vue`, or `pnpm example:angular`, then choose
**Auto Form**. All three use `examples/shared/generated.ts`, including async validation,
conditional nested fields, object choices, dates, custom seats and keyed addresses.
Their displayed submission result deliberately excludes the password.

Required gates remain `pnpm check`, `pnpm examples:build`, `pnpm test:browser`,
`pnpm test:packages`, `pnpm benchmark`, `pnpm benchmark:compare`.
Additional focused gates are `pnpm test:phase6`, `pnpm test:packages:phase6`, and
`pnpm benchmark:phase6`. No timing thresholds are asserted.
See [audit](phase-6-audit.md) and [implementation report](phase-6-report.md) for evidence
and tested compatibility limits. No packages are published by these commands.
