# @valixa/devtools

Explicit local-only, readonly form inspection. No automatic attachment, global
registry, telemetry, network transmission, persistence or DOM dependency in the root.

```ts
import { attachValixaDevtools } from '@valixa/devtools';
const inspection = attachValixaDevtools(form, { name: 'Registration', historyLimit: 100 });
inspection.getSnapshot(); // sanitized readonly current data + bounded events
inspection.inspectField('email'); // lazy selected-field projection
inspection.pause(); inspection.resume(); inspection.clear();
inspection.detach(); // unsubscribe all root/row/event sources; discard owned data
```

Values, initial values and literal errors are redacted by default. Optional
`visibleValues` paths reveal selected current data; sensitive name patterns and
`sensitive` overrides still redact. Messages additionally require `includeMessages`.
`allowSensitive` is a separate explicit override; file-like metadata stays redacted.
Do not embed secrets in schema paths, labels, rules or form names: those are metadata.
History never records values/messages/handler results, regardless of display options.

Bounds: historyLimit 100 (0 disables, max 10000), maxDepth 6, maxNodes 1000,
maxStringLength 256, maxRows 1000. Pause affects retained events only; current state
continues updating. Detach/disposal clears owned data, but cannot revoke a snapshot
already retained by application code. `enabled:false` creates no subscriptions.
Gate attachment/imports with your application's development build flag.

Optional SSR-safe entry `@valixa/devtools/panel` exports
`mountValixaDevtools(host, inspections)` with `update`/`destroy`. The native DOM/SVG
panel borrows controllers. Its destroy only unsubscribes the panel; the attaching
owner must detach inspections. Optional bindings: @valixa/react/devtools,
@valixa/vue/devtools, @valixa/angular-devtools.

Core `observeEvents(listener,{types?})` provides immutable value-free events with
per-form sequence/request IDs. DevTools adds ordinal/scope. Cancellation comes from
real cancelled timers/requests; independent async work keeps real resolution order.

See docs/phase-6.md in the repository for ordering, redaction and UI details.
