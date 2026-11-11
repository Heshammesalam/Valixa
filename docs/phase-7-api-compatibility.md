# Public API compatibility

Baseline: actual Phase 6 declarations captured before stabilization, with SHA-256
per declaration file in release/api-baseline.json. `release:check` rebuilds and
requires declaration equality after canonicalizing only the approved module-name changes and generated namespace aliases, including exported subpath and APF types.
Existing JavaScript, negative TypeScript fixtures, strict Angular templates and
installed consumers remain independent behavioral checks.

The approved publication-name change is an intentional import-path break from unpublished workspace names. No runtime or TypeScript signature breaking change was introduced during Phase 7.
Package version/metadata/ranges and build/release tooling changed; public declarations
retain their baseline hashes after module-specifier canonicalization. This does not claim compatibility with arbitrary
unstated framework majors or with code that relied on mutable snapshots/internal paths.

| Package group | Contract retained |
| --- | --- |
| core | Blueprints/rules, typed nested paths, independent validation/cancellation, discriminated submit results, collection identities, locale, snapshots, events |
| react / mui | Field-scoped hooks, ownership/StrictMode, explicit UI and MUI X codecs, optional Auto/DevTools subpaths |
| vue / vuetify | Scope-owned projections/raw stores, typed adapters, file boundary, awaited Auto listener, optional subpaths |
| angular / angular-material | Signals/DI/DestroyRef, borrowed row bridges, typed directives/codecs, standalone strict templates, APF |
| auto | Explicit typed UI normalization, immutable plans, capability errors and conversion boundaries |
| devtools | Explicit readonly redacted inspection, real events, bounded history and cleanup; optional native panel |
| angular-auto / angular-devtools | Typed custom contexts/capability checks and native lifecycle integration |

Naming differences are intentionally preserved: React/Vue use useValixa*, Angular
uses createValixa/bindValixa and Signals. Renaming them for superficial uniformity
would break framework-native usage. Vue's generic component boundary and Angular
custom key reuse limits remain documented rather than weakened with unsafe casts.

JavaScript gets runtime validation of schema/rule/capability structure, not erased
TypeScript value-type inference. Compiler-negative tests guard names/value types.
A disabled-instrumentation hot-path guard avoids computing diagnostic failure reasons when no observer exists; validation/event semantics and declarations are unchanged. No new product features are included in this stabilization release.
