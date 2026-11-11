# @valixa/react

Headless React hooks for `@valixa/core`. React is a peer dependency, never bundled.
This release targets React 19.2; see the repository report for tested versions.

```tsx
import { useValixa, useValixaField, useValixaState } from '@valixa/react';

function Login() {
  const form = useValixa({ email: ['', 'required | email'] });
  const email = useValixaField(form, 'email');
  const state = useValixaState(form);
  return <form noValidate onSubmit={event => {
    void form.handleSubmit(async (data, { signal }) => {
      // await yourApi.login(data, { signal });
    })(event).catch(error => { /* Set request error UI here. */ });
  }}>
    <label htmlFor={email.id}>Email</label>
    <input id={email.id} name={email.name} value={email.state.value}
      onChange={event => email.setValue(event.target.value)} onBlur={email.onBlur}
      disabled={email.state.disabled} readOnly={email.state.readonly}
      aria-invalid={Boolean(email.error)} aria-describedby={email.error ? email.errorId : undefined} />
    {email.error && <span id={email.errorId}>{email.error}</span>}
    <button disabled={state.submitting}>Log in</button>
  </form>;
}
```

## Hooks and ownership

`useValixa(definitionOrBlueprint, options?)` returns the actual core `ValixaForm`
with full TypeScript field/value inference. It initializes once, preserves identity
and user input on rerenders, and does **not** subscribe its caller. Changes to input
or options after initialization are intentionally ignored. `reset()` restores the
original defaults. To replace the schema/options/defaults, explicitly remount:

```tsx
<Editor key={record.id + ':' + record.version} record={record} />
```

Inside `Editor`, call `useValixa` with that record's defaults. A new key discards old
form state and initializes a new owner. Never use blueprint object identity as a key.
Do not dispose an owned form manually while mounted. On real unmount, the hook
disposes it on the next microtask; Strict Mode's immediate effect replay cancels
that disposal. Disposal aborts validation/submission and clears subscriptions.

`useValixaField(form, name)` subscribes only to the named field using
`useSyncExternalStore`. It returns a `FieldBinding<T>`:

- `state`: immutable core `FieldState<T>`, including value, errors, dirty, touched,
  validating, disabled and readonly.
- `name`, `id`, `errorId`: name and React-generated label/description IDs.
- `error`: first current error, or undefined. No extra touched-based hiding policy.
- `setValue(value)`: stable user-event writer, guarding current disabled/readonly.
- `onBlur()`: stable callback calling core `setTouched` (and its opt-in blur trigger).

`useValixaState(form)` explicitly subscribes to the entire `FormState<V>`. Reading
`form.state` alone does not subscribe React. Put whole-form status in its own
component and inputs in separate components for render isolation. React still
rerenders normal children when their parent rerenders; use ordinary composition or
memoization as needed. A change that conservatively clears another field's error
must update that other field. No incremental validation graph is implied.

`ValixaProvider` accepts `{ form, children }` and carries only the stable form.
`useValixaContext<V>()` reads it and throws outside a provider. Since React context
erases its generic type, the consumer's explicit `V` must match the provider's form;
pass the form directly to hooks when you want inference without this assertion.
The provider never disposes externally created forms. Their creator owns disposal.

## Custom components and adapter registration

`defineAdapter<T, P>(map)` registers a reusable immutable `FieldAdapter<T, P>`.
Its mapping function receives a typed field binding and returns component props.
It is an ordinary pure function: do not call hooks in a mapper. This explicit
registration supports any prop names and payload transforms, with no global
registry or component-name guessing.

```tsx
type Props = {
  label: string;
  value: number;
  onAmountChange: (payload: { amount: number }) => void;
  error: boolean;
};
const adapter = defineAdapter<number, Omit<Props, 'label'>>(field => ({
  value: field.state.value,
  onAmountChange: payload => field.setValue(payload.amount),
  error: Boolean(field.error)
}));
const ConnectedCounter = connectValixa(MyCounter, adapter);
// <ConnectedCounter form={form} name="seats" label="Seats" />
```

`useValixaAdapter(form, name, adapter)` returns mapped props and subscribes to that
field. `connectValixa(Component, adapter)` returns a component accepting a typed
`form` and compatible `name`, plus unbound component props. Bound props cannot be
overridden. Adapter values are invariant: reader and writer types must both match
the field, so nullable writers cannot bind number-only fields accidentally.

`nativeText` is a provided adapter for string-valued native input/textarea controls.
It returns controlled value, handlers, flags, IDs and ARIA attributes. Render any
error text with the returned `aria-describedby` ID. Use explicit custom adapters
for nullable, numeric, checked, file, or arbitrary native payloads. Core currently
rejects File instances; normalize to supported data if you integrate file inputs.

## Core semantics remain authoritative

`submit(handler)` executes immediately; `handleSubmit(handler)` returns a callback.
Both retain core return values, duplicate protection and cancellation behavior.
Rejected submission Promises propagate. In React event callbacks, explicitly catch
them and set application request-error UI. Do not use an async event callback
without handling its rejection. Server errors use `form.setError(name, messages)`;
reset uses `form.reset()`. Pass method calls in closures when handing them to React.

Validation defaults to manual/submit. Change and blur triggers are opt-in core
options. Initial `valid` only means no known errors. No parallel React validation
engine exists. Core's snapshot copying and conservative invalidation remain.

Exports: `useValixa`, `useValixaField`, `useValixaState`, `ValixaProvider`,
`useValixaContext`, `defineAdapter`, `useValixaAdapter`, `connectValixa`, `nativeText`;
types `FieldBinding`, `FieldAdapter`, `CompatibleFieldName`.

ESM only. SSR supplies the initial core snapshot through `getServerSnapshot`; create
a fresh form per request and use consistent initial data for hydration. Hydration
and React Activity/Offscreen lifecycle behavior have not been verified. Client
Strict Mode, render isolation, cleanup and submission behavior have automated tests.

## Optional Auto Forms and DevTools

Phase 6 adds @valixa/react/auto and @valixa/mui/auto. Install @valixa/auto explicitly when using these optional entries. Manual root exports remain independent. Dates require explicit codecs; custom renderer registries and group/row metadata are application-owned.
The /devtools entry binds the shared panel to an explicit inspections list. Install @valixa/devtools, attach in the form owner lifecycle and detach on cleanup; panel unmount only releases panel subscriptions. Values/messages are redacted by default.
See docs/phase-6.md in the repository for examples, capabilities, privacy and compatibility limits.
