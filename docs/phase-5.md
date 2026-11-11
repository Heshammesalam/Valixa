# Phase 5: advanced reactive engine

The [architecture audit and design](phase-5-audit.md) was written after inspecting core and all framework packages and verifying the 108-test starting baseline, before runtime edits. The first verified slice was value change → reverse graph traversal → selective invalidation → field scheduler → field subscriptions.

The [advanced core guide](../packages/core/ADVANCED.md) is the public API reference for dependency declarations/diagnostics, automatic scheduling, conditional state, explicit nested schemas, stable row collections, form validators, localization and framework usage. It ships inside the core tarball.

Each existing example application has a **Reactive engine** screen with native country input, conditional nested city, real UI-library row controls, live Arabic/English switching, keyed reorder/removal and nested submission output. Run `pnpm example:react`, `pnpm example:vue` or `pnpm example:angular`. Existing example screens remain available.

Verification commands:

```sh
pnpm check
pnpm examples:build
pnpm test:browser
pnpm test:packages
pnpm test:advanced
pnpm benchmark
```

The [implementation report](phase-5-report.md) records verified counts, package/browser coverage, measurements, scope limits and Phase 6 readiness. No packages are published.
