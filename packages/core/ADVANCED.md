# Advanced reactive forms

These APIs extend the existing `@valixa/core` store. No framework or DOM is imported into core. Existing tuple/definition fields and atomic object/array values retain their meaning.

## Dependencies and automatic validation

```ts
const form = createValixa({
  subtotal: [0],
  discount: { initial: 0, dependsOn: ['subtotal'],
    validate: (value, { values }) => value <= Number(values.subtotal) },
  password: ['', 'required | min:8'],
  confirm: ['', 'same:password']
}, { validation: { mode: 'onChange', debounce: 300, timeout: 5000 } });
```

`same` infers an edge; explicit `dependsOn` adds edges. Omitted dependencies on a custom validator mean it may read any value; every mutation invalidates that validator and its dependents. `dependsOn: []` explicitly declares independence. Declare **all** values a custom validator reads. Reverse traversal includes transitive dependents and visits each once. Unrelated errors and field snapshot identities remain intact. Error invalidation includes mapped server errors on affected fields.

`form.dependencies` exposes frozen `dependencies`, `dependents`, `unknown` and `cycles` indexes. Missing references and cycles containing a new explicit `dependsOn` edge throw during blueprint construction, with an actionable cycle path. Existing inferred-only `same` cycles remain supported: validators compare a frozen snapshot and each affected field is traversed once, without recursive revalidation; diagnostics list those cycles. Unknown-dependency wildcards are not declared graph edges and do not create artificial cycles. Graphs describe validation reads, never derived-value computations.

| Mode | Trigger |
| --- | --- |
| omitted / `manual` | Explicit `validate` and `submit` only |
| `onSubmit` | Same automatic policy as manual; submit always validates |
| `onChange` | Changed and dependent fields, after a value mutation |
| `onBlur` | A field when `setTouched(name, true)`/binding blur is called |
| `immediate` | Initially, and changed/dependent fields on mutation |

Legacy `validateOn: 'change' | 'blur' | 'submit'` remains supported. An explicit new `validation.mode` takes precedence. No trigger is added by default. A no-op value write does not validate. On blur mode, a value change invalidates dependent errors, but waits for an explicit blur/validation trigger to revalidate them.

Debounce is independently owned **per field**, including the initial immediate-mode run. `pending` includes scheduled timers and running validation; `validating` means running work. The optional form validator has its own single debounce timer. `validate(name)` bypasses debounce for that field; `validate()` and submit cancel queued field/form timers and validate everything freshly. Automatic and explicit requests for independent fields coexist. Replacing a request for a field aborts its previous owner. Validators within one field remain sequential, after built-in constraints; independent fields execute concurrently. Results ready in the same microtask turn share a snapshot publication.

`timeout` is a finite positive duration **per running field/form request**, excluding debounce. Timeout aborts the signal and produces the structured `timeout` error. Omit it for no timeout. Cancellation also settles core validation promises when application validators ignore signals; it cannot undo remote side effects. `cancelValidation()`, reset, disposal and superseding error operations release owned timers. Cancelled/obsolete results return `stale` and cannot commit. `cancelValidation` is idempotent after disposal; other mutations still reject.

## Conditional state

```ts
const form = createValixa({ country: [''], city: [''] }, {
  behaviors: { city: {
    dependsOn: ['country'],
    visibleWhen: ({ values }) => Boolean(values.country),
    enabledWhen: ({ values }) => Boolean(values.country),
    requiredWhen: ({ values }) => Boolean(values.country),
    readonlyWhen: ({ values }) => values.country === 'locked',
    validateWhen: ({ values }) => Boolean(values.country)
  } }
});
form.getFieldState('city'); // visible, disabled, readonly, required, validationEnabled
```

Predicates are synchronous, pure functions over frozen value snapshots. Explicit dependencies limit reevaluation; omitted dependencies are conservative. Dependencies/targets must name existing fields in that store. Behavior dependencies control reevaluation, separately from validator dependency declarations.

| State | Values | Validation | Submission |
| --- | --- | --- | --- |
| Hidden | Retained | Continues unless `validateWhen` returns false | Included |
| Disabled | Retained; binding user writes blocked | Continues, matching existing behavior | Included; a globally disabled form cannot submit |
| Readonly | Retained; binding user writes blocked | Continues | Included |
| Conditionally required | Retained | Adds the required rule; does not remove an existing static required rule | Included |
| `validateWhen: false` | Retained | Skips field rules/custom validators; fresh validation clears its field errors | Included |

Visibility is application state: use `visible` in React conditional rendering, Vue `v-if`, or Angular `@if`. No adapter removes DOM automatically. Binding flags are projected; core programmatic writes remain allowed. MUI and Angular native controls expose `aria-required`; Vuetify accepts explicit required metadata and otherwise uses core metadata. Applications can choose visual required markers without enabling a second validation owner.

`resetWhen` resets a field **to its initial value on a false-to-true transition**, including initial evaluation. It does not repeatedly erase subsequent edits while true. Reset cascades evaluate on a draft, and only converge before publication; nonconvergent transitions throw. Ordinary reset restores initial values and reevaluates all behaviors without enabling automatic validation. It clears errors/touched/submission state; locale and global flags remain. Server errors are literals, survive presentation-only changes, and are invalidated by affected value or validation-eligibility changes. There is no automatic submission exclusion or configurable hidden-field erasure policy; express clearing with `resetWhen` and an appropriate initial value.

## Explicit nested schemas and paths

```ts
import { createValixa, nested } from '@valixa/core';
const form = createValixa({
  user: nested({ name: ['', 'required'], email: ['', 'email'] }),
  profile: { initial: { city: 'Cairo' as string } }, // atomic
  tags: { initial: [] as string[] }                // atomic
});
form.setValue('user.name', 'Ahmed');
form.setValues({ user: { email: 'a@example.com' } });
form.state.values.user.name;
form.field('user.email').state.errors;
```

Grammar is unambiguous: `[initial, rules?]` or `{initial, ...}` defines an atomic field; **only** `nested(schema)` introduces addressable children. Bare nested objects are rejected. An atomic object cannot be addressed via its internal properties. Nested patches preserve siblings. Values/submission payloads are nested data; compatibility `errors`/`touched` maps use canonical leaf path keys. `nestedErrors`, `nestedTouched`, and `nestedDirty` provide nested projections. `field(name)` is a cached core controller with a current `state` getter, `setValue`, `onBlur` and `subscribe`; its writes have core programmatic semantics.

Nested path segments escape `.` as `\.` and `\` as `\\` (double these backslashes inside JavaScript string literals). `escapePath(segment)` and `parsePath(path)` are exported. Existing top-level literal names—including dots/backslashes—retain exact lookup priority. Conflicting canonical paths are rejected. Empty nested segments and `__proto__`, `prototype`, `constructor` segments are rejected. Malformed escapes are rejected by `parsePath`; no expression evaluation or prototype traversal occurs. Atomic values can contain plain data properties without becoming navigable paths. Type inference supports up to eight nested levels beneath a top-level nested container; deeper schemas require a shallower grouping boundary. `FieldName<V>`, `FieldValue<V, K>`, and `ValuesPatch<V>` are shared by framework packages.

## Dynamic collections

```ts
import { collection, createValixa } from '@valixa/core';
const form = createValixa({ addresses: collection({ city: ['', 'required'], street: [''] }) });
const addresses = form.array('addresses');
addresses.append({ city: '', street: '' });
const row = addresses.items[0]!;
row.form.setValue('city', 'Cairo');
addresses.prepend({ city: 'Giza', street: '' });
addresses.move(0, 1);
// row.key and row.form remain stable across moves.
```

`collection(itemSchema, initialItems?)` opts into row management. Existing atomic arrays stay atomic. Each row has `{key, form}`: an opaque collection-local monotonic UI key and an independently typed `ValixaForm`. Current position is its array index; **an index is never its identity**. Bind controls to `row.form` and use `row.key` for reconciliation. Nested item schemas and nested collections are supported. `ValueInput<T>` strips schema-only metadata from input values.

Operations are `append(item)`, `prepend(item)`, `insert(index, item)`, `remove(index)`, `move(from, to)`, `swap(a, b)`, `replace(items)`, `clear()` and `reset()`. Invalid indexes throw. Replace resets row lifetimes; move/swap preserve each surviving row's values, errors, initial values, touched/dirty state, graph, subscriptions and pending validation. Removed/replaced rows dispose, abort and can never commit into a later row. Core programmatic collection replacement through `setValues` also creates fresh row lifetimes; malformed collection patches are checked before changing form values.

`items`, frozen `values`, `getSnapshot()` and `subscribe()` expose collection state. A collection owns its row stores; application view unmounts should unsubscribe, not dispose surviving rows. Parent reset restores the originally configured items with **fresh** keys, clears row state and cancels timers without restarting initial immediate-mode validation. Parent global disabled/readonly and locale changes propagate to rows, including future appended rows. Parent submit touches and validates all rows and submits their ordered nested values. Parent errors aggregate row messages with current `[index]` prefixes; nested projections preserve per-row error/touched/dirty maps. A collection-root `validateWhen: false` skips row validation and excludes row errors from parent validity/projections while retaining each row's independently owned error state. Ordinary row writes schedule their own field closure; parent automatic work targets other dependents and form constraints, avoiding duplicate row requests. Structural changes can validate the complete collection.

Graph namespaces are explicit: item dependencies name fields **inside the row**. Parent dependencies name the collection root. Adding/removing rows creates/disposes their row graphs; reordering leaves graphs intact. Use parent `validateForm` (optionally `formDependsOn: ['addresses']`) for cross-row/aggregate constraints. Parent `form.setValue('addresses.0.city', ...)` is deliberately not an index-based field API; use `addresses.items[0].form.setValue('city', ...)`. No wildcard path expression or arbitrary index-identity rewriting is implemented. A parent complete validation becomes stale on a concurrent structural/value edit, even when surviving row work remains independently valid.

React: `useValixaField(row.form, 'city')` or `useMuiField`. Vue: `useValixaField` / `useVuetifyField` in a keyed row component. Subscribe to parent state or the collection for structural rendering. Angular: `form.array('addresses')` delegates to core, then `bindValixa(row.form, {id, destroyRef})` supplies **borrowed** signal projections in the keyed row component. Borrowed-view destruction releases projections while parent collection ownership retains the row store.

## Form validation and error precedence

```ts
const form = createValixa({ startDate: [''], endDate: [''] }, {
  formDependsOn: ['startDate', 'endDate'],
  validateForm: async (values, { signal }) => {
    // Forward signal to any remote request.
    return values.startDate > values.endDate
      ? { endDate: 'End date must follow start date', $form: 'Review the date range' }
      : {};
  }
});
```

The callback returns a field-path map of strings/string arrays; undefined entries are ignored. `$form` supplies form-wide strings in `state.formErrors`, unless `$form` is an actual schema field, in which case it retains normal field meaning. Unknown returned field names become an actionable form-wide validation failure. Exceptions become a generic structured form error without leaking exception contents. Only explicit field paths are accepted; errors inside collection rows belong to row stores. Use a collection-root form error for an aggregate constraint.

Full validation/submit runs field and form validation concurrently against frozen values, including form validation when field rules fail. `validate(name)` runs only that field. Automatic form work is one independent request/timer per form, restricted by `formDependsOn`; omitted dependencies mean any value may affect it. A timeout applies to form work as well. Reset/disposal/obsolete values prevent late commits. Precedence is field messages before form-field messages. `setError` cancels active work and supersedes form-field messages on that target; the **next fresh explicit validation** may replace it, preserving existing retry semantics. Form-wide failures contribute to `valid`/`invalid` even when `errors` is empty; render `state.formErrors` in form-level UI.

## Localization

English is the default. `locale`, `fallbackLocale`, locale-keyed `labels`, and existing rule `messages` configure presentation. `setLocale(locale)` rerenders structured built-in/custom-false/exception/timeout messages without revalidation. `state.errorDetails` retains `code`, `field`, `label`, `param` and `source`; literal custom/server/form-returned messages additionally retain `message`. String validators and server errors are application literals and are not implicitly translated. `messages` overrides rule catalogs in every locale.

```ts
import { registerLocale } from '@valixa/core';
registerLocale('fr', { messages: { required: '{label} est obligatoire.' }, labels: { email: 'Courriel' } });
const form = createValixa({ email: ['', 'required'] }, {
  locale: 'ar', fallbackLocale: 'en', labels: { ar: { email: 'البريد الإلكتروني' } }
});
await form.validate();
form.state.errors.email; // ['البريد الإلكتروني مطلوب.']
form.setLocale('fr');
```

Catalog fallback order is custom messages → selected locale → fallback locale → English. Label fallback follows selected/fallback locale overrides/catalogs and then the blueprint label. Catalog registration is process-wide configuration; the selected locale is owned by each form, not global user state. Register catalogs during application setup. Document direction is never changed. Applications choose `dir="rtl"`, logical CSS properties, component-library RTL/theme settings and translated literal messages themselves.

## Verification and scope

`pnpm test:advanced` runs focused core and representative framework tests; `pnpm test:performance` checks deterministic identity/notification contracts. The repository retains strict builds, all original tests, production browser flows and isolated installed-package consumers. `pnpm benchmark` retains its original workloads in `benchmarks/results.json`; `pnpm benchmark:compare` pairs preserved Phase 5 with current core and identical correctness assertions.

Phase 5.1 structurally shares immutable branches and reuses unchanged snapshots. Pending/error/locale transitions retain `values` identity; unrelated nested branches, error arrays and field projections remain stable. External values are still copied before becoming owned state, including shallow-frozen application objects. Native cancellation signals are allocated lazily and retain existing abort/stale behavior. Genuinely redundant operations do not create new snapshots or callbacks, while effective field/pending transitions retain subscription notifications.

Value-record copying, nested path projection and ordered collection operations can still cost O(form/collection size); active field subscribers require projection checks. Graph selectivity does not imply constant-time whole-form work. Profiling and retained-heap measurements are separate from end-to-end timings, and no cross-library speed claim is made. Auto Forms and DevTools UI are outside this phase.
