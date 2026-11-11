# Phase 2 repository audit and API decision

Before implementation, reviewed core's modules, exported types, full API reference,
architecture, state/subscription and type tests. The repository has no AGENTS.md
and is not currently a Git checkout. Existing generated artifacts are ignored.

## Existing contracts

- `createValixa` accepts a definition or `Blueprint<S>` and infers `InferValues<S>`.
- Public types include `ValixaForm`, `FieldState`, `FormState`, `FieldName`,
  `DeepReadonly`, `FormOptions`, validation and submission contracts.
- `getSnapshot` is a stable arrow function; snapshots retain identity until writes.
- `getFieldState` caches unchanged field snapshots; `subscribeField` only notifies
  changed fields. Subscriptions return cleanup functions and do not call immediately.
- Validation is submit/manual by default. Change validates all fields; blur touches
  and validates one field. Writes conservatively clear errors. Runs are versioned.
- `submit` executes; `handleSubmit` creates a callback. Failures reject; cancellation
  is cooperative. Reset restores defaults; disposal permanently rejects mutations.
- Values are immutable plain data. Date/Dayjs/File instances are rejected.

## Integration risks and decisions

1. **Strict Mode:** direct `dispose()` in effect cleanup would dispose the form
   during development's setup/cleanup/setup replay. Owned forms defer disposal one
   microtask, invalidated by a new setup. Uncommitted form allocations have no
   external resources. Tests cover replay and actual unmount with pending work.
2. **Blueprint identity:** inline object definitions change every render. `useValixa`
   initializes once and ignores subsequent definition/options identities. Reset
   restores those original defaults. Reinitialize by explicitly remounting the owner
   with a new React key; this also safely allows schema/type changes.
3. **Subscriptions:** `useValixa` owns a stable core form but does not subscribe.
   `useValixaState` explicitly subscribes to form state; `useValixaField` subscribes
   to one field via `useSyncExternalStore`. Parent-driven rerenders still follow
   normal React rules; field isolation does not prevent a parent rendering children.
4. **Hooks:** no `form.field()` function hides hooks. `useMuiField(form, name)` is the
   concise subscription boundary. Ordinary prop-mapping methods are pure and may
   be called conditionally. Each component contract has its own mapper.
5. **UI semantics:** field bindings guard disabled/readonly user writes while core
   still allows programmatic writes. MUI props route errors/ARIA to actual inputs.
   Checkbox, Select, RadioGroup and Autocomplete do not share one event extractor.
6. **Dates:** an optional `@valixa/mui/x` entry point uses an explicit codec between
   core plain values and picker date-library instances, preserving core constraints.
7. **Errors:** no second validation engine or swallowed submit rejection. Event
   examples explicitly catch request failures. Core is unchanged.

## Selected API

```tsx
const form = useValixa({ email: ['', 'required | email'] });
const email = useMuiField(form, 'email');
return <TextField label="Email" {...email.textField()} />;
```

Prefer separate field components for render isolation. Provider context carries
only the stable form, not changing snapshots. Custom adapter factories register a
typed mapping function with `defineAdapter`; `useValixaAdapter` and `connectValixa`
consume that explicit mapping, including arbitrary payload transformations.

React follows the official [external-store contract](https://react.dev/reference/react/useSyncExternalStore)
and [effect replay guidance](https://react.dev/reference/react/StrictMode).
MUI mapping follows its [Autocomplete contract](https://mui.com/material-ui/api/autocomplete/)
and [picker/date-library setup](https://mui.com/x/react-date-pickers/quickstart/).

Verification proceeds with TextField → errors → submit before adding component
variants. Package consumption is checked from tarballs, not source aliases.
