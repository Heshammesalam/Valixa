# Core public API

All exports below come from `@valixa/core`. Core performs no rendering and imports
no framework or DOM APIs. Values must be acyclic plain objects, arrays or primitive
data; class instances, dates, files, functions, and symbols are rejected as values.
Use strings for dates until value normalization is implemented.

## Definitions and inference

`blueprint(input)` returns a reusable, deeply frozen `Blueprint<S>`. Its constructor
also accepts the same input. `createValixa(inputOrBlueprint, options?)` returns a
`ValixaForm<InferValues<S>>`. Each instance owns independent values and state.

```ts
import { blueprint, createValixa } from '@valixa/core';

const signup = blueprint({
  email: ['', 'required | email'],
  age: { initial: 18, rules: ['minValue:18'], label: 'Age' },
  password: ['', 'required | min:8'],
  confirm: ['', 'required | same:password'],
  username: {
    initial: '',
    rules: 'required',
    validate: async (value: string, { signal, values, field }) => {
      // Replace this with your availability check; forward signal to your API.
      return value !== 'reserved' || 'Username is unavailable.';
    }
  }
});
const form = createValixa(signup, {
  validateOn: 'submit',
  messages: { required: '{label} cannot be empty.' }
});
```

A field is `[initial, rules?]` or `{ initial, rules?, validate?, label?, dependsOn? }`.
Explicit `nested(schema)` and `collection(itemSchema, initialItems?)` introduce
addressable children and keyed row stores; existing object/array values remain atomic.
See [the advanced guide](ADVANCED.md) for their typed grammar and lifecycle.
`validate` accepts one callback or an array. Callbacks run sequentially within a
field, concurrently across fields, after built-in rules pass. `true` or `undefined`
passes; `false` uses the custom message template; a string becomes an error.
Exceptions become generic validation errors without exposing exception contents.
Custom validators should be pure and use `context.values` for cross-field reads.

Top-level string, number and boolean literals widen to their primitive types.
Annotate nullable or union initial values when necessary, e.g.
`initial: null as string | null`. Exported `InferValues`, `DeepReadonly`,
`FieldName`, `FieldInput`, `FieldDefinition`, `BlueprintInput`, `RuleInput`,
`Validator`, `ValidationOutcome` and `ValidationContext` describe the boundary.
Compiled blueprint metadata is readable but is not an extension point.

## Rules

`parseRules(string | readonly string[])` returns readonly `ParsedRule[]`.
`RuleSyntaxError` identifies invalid syntax, unknown rules and invalid parameters.
Definitions are checked eagerly, including missing `same` references.

Grammar: `identifier (":" parameter)? ("|" identifier (":" parameter)?)*`.
An empty expression means no rules. Arrays compose pipelines. There is no dynamic
execution, quoted-string expression language or implicit rule registration.

| Rule | Behavior |
| --- | --- |
| `required` | Reject null, undefined, empty string, empty array and false; accept zero |
| `email` | Basic email shape; does not verify deliverability or full RFC grammar |
| `url` | Platform URL parser, HTTP(S) protocol and nonempty hostname; no whitespace, host resolution or reachability check |
| `min:n`, `max:n` | String length (UTF-16 code units) or array length; n is a nonnegative integer |
| `minValue:n`, `maxValue:n` | Finite numeric values; no implicit string coercion |
| `same:field` | `Object.is` comparison against another top-level field |

Non-required rules skip null, undefined, empty strings and empty arrays. Required
does not trim whitespace. Normalize values before writing them if needed. Pattern
checks and custom named rules can be expressed as custom validators in this phase.

`defaultMessages` exposes the immutable English message catalog.
`options.messages` overrides templates by rule name, `custom`, or `exception`;
`{label}` and `{param}` interpolate. Locale switching and Arabic catalogs are
deferred. Arbitrary validator strings are displayed as text by future UI bindings,
never HTML.

## State and writes

`form.state` and `form.getSnapshot()` expose the same deeply immutable
`FormState<V>`. Snapshot identity is stable between transitions.

| State | Meaning |
| --- | --- |
| `values`, `initialValues` | Current data and original immutable defaults |
| `errors` | Sparse field-to-message-array map, no field values or exception text |
| `touched` | Set explicitly, on blur via bindings, or for every field on submit |
| `dirty`, `pristine` | Deep comparison with original defaults; revert makes pristine |
| `valid`, `invalid` | Absence/presence of known errors; initial valid is not proof of validation |
| `validating` | One or more field/form/row requests are running |
| `pending` | Running work or debounced automatic validation is scheduled |
| `formErrors`, `errorDetails`, `locale` | Form-wide messages, structured metadata and selected locale |
| `submitting` | Submission owns validation or an active handler |
| `submitted` | Most recent submission succeeded; false when a new attempt starts |
| `submitCount` | Accepted attempts, including invalid or failed attempts |
| `disabled`, `readonly` | Global flags available to bindings |

- `setValue(name, value)` writes a typed field.
- `setValues(partial)` validates field names and copies data before applying one
  batch. Equal writes do nothing. Changes invalidate the changed/dependent closure;
  custom validators with unknown dependencies retain conservative invalidation.
- `setTouched(name, touched = true)` changes touched state.
- `setError(name, messageOrMessages)` applies server/application errors.
- `clearErrors(name?)` clears one field or all fields. Error writes invalidate
  pending validation, protecting server errors from older responses.
- `setDisabled(boolean)`, `setReadonly(boolean)` update global metadata. Programmatic
  writes and explicit validation remain allowed. Disabled forms cannot submit.
  Fields remain in data. Declarative behaviors can add per-field state.
- `reset()` restores original defaults, clears errors/touched/submitted/count and
  aborts validation/submission. Flags and subscriptions remain.
- `dispose()` is idempotent, aborts work and clears subscriptions. Subsequent writes,
  subscriptions, validation and submission reject. Final snapshots remain readable.

Atomic nested objects/arrays are copied/frozen as before. Explicit nested schemas
expose leaf paths; dynamic collections expose independently owned row stores.

## Subscriptions

`subscribe(listener)` returns an idempotent unsubscribe function and fires for
every state transition. `subscribeField(name, listener)` fires only when that
field's `FieldState` changes. Neither invokes its callback immediately. Call
`getSnapshot()` / `getFieldState(name)` to read initial state and read again in the
callback. `getFieldState` includes `value`, `initialValue`, `errors`, `touched`,
`dirty`, `validating`, `pending`, `disabled`, `readonly`, `visible`, `required`
and `validationEnabled`.

Unchanged field snapshots retain identity. Notifications are synchronous, with
`setValues` batching multiple writes; validation has separate pending/result
transitions. Listeners must not throw. Unsubscribe on consumer teardown, then
dispose the form when its owner is destroyed. React hooks live in `@valixa/react`;
the core package itself has no framework integration dependencies.

## Validation and cancellation

`await validate(name?)` returns `ValidationResult<V>`:
`{ valid, errors, stale }`. With no name it validates all fields; with a name it
updates only that field's errors, while `valid` still reflects all known errors.
Unvalidated fields are not implicitly valid. No touched state changes here.

The default remains manual/submit. Legacy `validateOn: 'change'` validates the
changed/dependent closure; `'blur'` validates a field when touched. The additive
`validation` option supports modes, per-field debounce and running-request timeout.

A newer request supersedes previous work for its target fields; independent field
requests coexist. Value changes invalidate their dependency closure. Reset, error
operations and disposal cancel owned work. Every callback receives an `AbortSignal`;
ignored cancellation cannot allow stale commits. A stale result has `valid: false,
stale: true`. Full validate/submit is fresh and also runs optional form validation.
See [scheduling, behaviors, nested schemas, collections and localization](ADVANCED.md)
for complete semantics, error precedence and explicit limitations.

## Submission

`await submit(handler)` executes immediately. `handleSubmit(handler)` returns an
event callback accepting an optional structural `{ preventDefault() }` event.
This avoids overloading an immediate Promise API with callback-factory behavior.

`handler(values, { signal })` receives an isolated mutable copy of validated data.
`SubmitResult<V, R>` is a discriminated union:

- `{ status: 'success', data: R }`: handler resolved.
- `{ status: 'invalid', errors }`: validation failed; handler was not called.
- `{ status: 'busy' }`: another submission owns the form.
- `{ status: 'stale' }`: data or validation changed before handler execution.
- `{ status: 'cancelled' }`: disabled form or submission was cancelled.

Handler failures reject the Promise; `submitting` clears in `finally`. The caller
owns error UI. `cancelSubmit()` signals cancellation and invalidates validation.
Reset and disposal also cancel. Abort is cooperative: a callback ignoring its
signal may continue its external side effects. The submission lock remains until
the pending callback settles, preventing overlapping requests.

Edits during the handler are allowed; it keeps the already-validated data copy.
Success does not reset automatically. Call `reset()` after success if desired.
Retry validates again, replacing previous server errors. There is no HTTP-client
dependency or automatic 422 payload guesser. Map your API's known payload explicitly:

```ts
try {
  await form.submit(async data => {
    // const response = await yourApi(data);
    // if (response.status === 422) {
    //   form.setError('email', response.errors.email);
    //   throw new Error('Server rejected submission');
    // }
  });
} catch (error) {
  // Show a request-level message; field errors remain in form.state.errors.
}
```

Other exported types: `Errors`, `FormState`, `FieldState`, `ValidationResult`,
`FormOptions`, `SubmitHandler`, `SubmitContext`, `SubmitResult`.

## Readonly descriptions and optional lifecycle observation

`form.describe()` returns a lazily cached value-free blueprint description (paths, labels, parsed rules, validator counts, child collection schemas). `form.getBehaviorStates()` returns readonly configured behavior states without creating all field projections.

`form.observeEvents(listener, {types?})` returns an unsubscribe function. Immutable events contain per-form sequence/type and optional field/request/reason/index/to/key metadata; no values, messages or handler output. Observer exceptions are isolated. Actual cancelled timers/jobs emit cancellation; independent async work keeps actual resolution order. Invalid validation emits failed then completed; cancelled runs do not commit completion. Root disposal emits then clears observers. Use listeners for diagnostic reads, since reentrant writes can interleave ordinary operations. No event objects are allocated without an interested listener.

Optional @valixa/auto and @valixa/devtools consume these contracts without introducing framework/DOM imports into core. See the repository Phase 6 guide for full event ordering and privacy.
