# Phase 2: React and Material UI

The [repository audit and API rationale](phase-2-audit.md) records the existing core
contracts and decisions made before implementation. Core behavior remains unchanged.
See the [implementation report](phase-2-report.md) for verified versions and limits.

Public references ship with each package:

- [React hooks, ownership, context and custom adapters](../packages/react/README.md)
- [MUI mappings and optional date codec](../packages/mui/README.md)
- [Runnable examples](../examples/react/README.md)

## Public API

```tsx
const form = useValixa({ email: ['', 'required | email'] });
const email = useMuiField(form, 'email');
return <TextField label="Email" {...email.textField()} />;
```

`useValixa` owns but does not subscribe. `useValixaField` and `useMuiField` subscribe
to one field; `useValixaState` opts into whole-form updates. Mapping methods are
pure ordinary functions, respecting Hook rules. `form.submit`, `handleSubmit`,
reset, errors and cancellation are the existing core APIs, without wrappers or a
parallel validation engine.

## Verification commands

```sh
pnpm check
pnpm test:packages
pnpm examples:build
pnpm exec playwright install chromium
pnpm test:browser
```

`test:packages` packs all libraries and installs three consumers outside workspace
ancestors: React without MUI, MUI without MUI X, and MUI with optional X. It checks
rewritten workspace dependencies, runtime ESM imports/server rendering and strict
declaration consumption with invalid-name/value assertions. It installs offline
from pnpm's populated store; run workspace install first. Temporary consumers are
kept under the OS temp directory to allow inspection; tarballs are under ignored
`artifacts/packages`. The script never publishes.

CI runs the checks and independent consumers for its Node matrix, then installs
Chromium and runs the production examples in a separate job. Local evidence and
the CI configuration are distinguished in the implementation report.

## Limits carried forward

Core still conservatively invalidates errors; change-trigger validation can cause
other fields' pending/errors to change and legitimately rerender them. Field-level
isolation does not imply an incremental validator graph. Core publication remains
O(form data size). Date/file/class values remain unsupported in core; dates use a
codec. No Phase 3 or later features have been added.

Custom adapter registration is explicit and local; no component-name guessing.
Provider context requires its consumer type to match. Blueprint/options changes
do not reinitialize forms; use an explicit keyed remount. SSR rendering has a
package smoke check; hydration and Activity/Offscreen reconnection are unverified.

## Phase 3 readiness

Vue can build on the unchanged core snapshot, field subscription, validation and
submission contracts. React-specific ownership and event mappings live in their
own packages. A Vue integration will need its own lifecycle and reactive binding
tests; React evidence does not establish Vue or Vuetify compatibility. The advanced
dependency graph, localization and dynamic field work remain separate later phases.
