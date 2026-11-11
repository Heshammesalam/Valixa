# Phase 2 implementation report

Date: 2026-11-08. Phase 2 is implemented; Phase 3 has not started.

## Audit and API

Reviewed the existing core implementation, exported types, public API, tests and
architecture before implementation. The [audit](phase-2-audit.md) identifies
snapshot stability, Strict Mode cleanup, blueprint identity, rendering isolation,
plain-data date constraints and submission rejection handling as integration risks.
No core runtime code was changed or redesigned.

Selected `useValixa` for stable ownership, `useValixaField` for individual field
subscriptions and `useValixaState` for explicit form-state subscriptions. `useMuiField`
provides pure component-specific mapping methods. There are no hidden hooks in
`form.field()` or equivalent ordinary functions. Blueprint/options identity changes
preserve input; explicit keyed remounts reinitialize. A provider carries only the
stable form. Custom adapters have an explicit invariant reader/writer value type,
payload transformation and a connected component factory.

## Delivered

- `@valixa/react`: Strict Mode-safe ownership, external-store hooks, context,
  lifecycle cleanup, native text mapping, typed adapter registration and connection.
- `@valixa/mui`: TextField, numeric input, Select, Checkbox, Switch, RadioGroup,
  Autocomplete and optional `@valixa/mui/x` DatePicker codec.
- Controlled value normalization, blur/touched handling, first-error helper text,
  label/description IDs, disabled/readonly props and guarded event writes.
- Explicit date codecs keep library objects outside core. Invalid picker edits
  become a caller-selected plain-data sentinel checked by ordinary core validators.
- Complete native login, MUI registration and advanced examples with simulated
  asynchronous API behavior, server errors, custom payloads, loading and reset.
- ESM/declaration/source packaging, peers, package READMEs, release changeset,
  expanded CI, integration tests, independent install checks and browser tests.

## Verification evidence

Local environment: Windows, Node 24.12.0, pnpm 10.26.2, TypeScript 5.9.3,
Vitest 4.1.12, React/React DOM 19.2.9, MUI 7.3.11, MUI X 8.29.5,
Emotion React 11.14.0 / Styled 11.14.1, Dayjs 1.11.23, Playwright 1.65.0.

| Check | Result |
| --- | --- |
| `pnpm check` | Strict package builds, source/test/example type checks, 68 passing tests in 6 files, and both Phase 1 consumer examples |
| Phase 1 regression suite | All original 51 tests remain passing |
| React field render isolation | Email writes leave unchanged password render counts unchanged; cached snapshots and stable handlers tested |
| Lifecycle | Strict Mode replay, real unmount/disposal, unsubscription, pending cancellation, stable identity and explicit keyed reinitialization tested |
| MUI integration | Actual component interactions plus event-contract tests, numeric/multiple payloads, object option equality, error ARIA and picker codec/invalid-state validation |
| `pnpm examples:build` | All three screens compile into a production Vite build |
| `pnpm test:browser` | 3 production-build end-to-end tests pass in Chromium 158.0.8127.18 on Windows |
| `pnpm test:packages` | 3 independent consumers pass runtime/server-render and strict declaration checks, including the optional picker declaration |

Package consumers are created under the OS temporary directory, outside workspace
ancestors, using tarballs and offline peer installs. React is checked without MUI;
MUI is checked without MUI X; a third consumer installs X/Dayjs. Workspace dependency
specifiers are verified as rewritten. Outputs are under `artifacts/packages/`.
TypeScript inference and invalid names/values/adapter contracts are checked against
declarations as well as workspace output. Core has no React, MUI or browser imports;
frameworks remain external to emitted library modules.

Browser flows exercise native errors and accessible descriptions, async username
validation, checkbox/Select registration, Autocomplete clearing/multiple values,
numeric editing, Switch/RadioGroup, picker selection, request loading, mapped 422
errors, successful retry, custom components and reset. Core's conservative policy
means editing another field cancels a pending blur validator; tests explicitly
await blur results before subsequent edits, and submission revalidates everything.

## Known limits

- Browser evidence covers Chromium on Windows only; no Firefox/WebKit/mobile or
  full accessibility conformance claim. Configured Linux CI has not run locally.
- Peer ranges are explicit; other React/MUI majors are not tested or advertised.
- SSR rendering is smoke-tested. Hydration and React Activity/Offscreen effect
  reconnection are not verified. Owned-form cleanup defers disposal one microtask.
- Context consumers supply their own matching value type; direct form props retain
  inference. Reinitialization is an explicit owner remount, not a mutable schema API.
- Autocomplete free-solo/disable-clearable variants need custom adapters. Object
  options require equality callbacks. Slot overrides must preserve binding props.
- Date codecs and blueprint rules must agree, including invalid/min/max dates.
  Core still rejects Date/Dayjs/File instances. Only Dayjs picker usage was tested.
- Core validation remains conservative and cancels obsolete whole runs. There is
  no dependency graph, debounce scheduler, dynamic path registration or new locale
  system. Field isolation does not prevent normal parent-induced rerenders.
- The combined demo includes the whole picker/MUI set in one roughly 700 kB
  minified bundle and emits Vite's chunk-size advisory; this is not a library bundle
  size or performance claim. Library output does not bundle its framework peers.

## Phase 3 readiness

The unchanged core contracts are ready for a separately tested Vue integration.
Framework lifecycle and component event handling are contained in the React/MUI
packages; no React behavior has leaked into core. Vue/Vuetify will require its own
reactivity, cleanup, component and package-consumption verification. No Phase 3
implementation or compatibility is claimed here. No packages were published.
