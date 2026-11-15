# Nuxt integration (development)

The private `examples/nuxt` app uses Nuxt **4.6.4**, Vue 3.5 and the development
Valixa workspace packages. The pinned Nuxt engine range is
`^22.22.3 || ^24.15.0 || >=26.0.0`; use Node 24.15.0 or newer in that range. This is
an explicit-import integration, not a published auto-import module.

```sh
pnpm build
pnpm examples:nuxt:build
pnpm test:nuxt
# Interactive development:
pnpm example:nuxt
```

Create each form inside component setup. Share immutable definitions and schema
objects, never a mutable form instance between server requests. Initial data must
match on server/client; this fixture obtains it from the same route query. Fetch
real initial data with Nuxt's request-aware APIs in your own application.

The app's native input binds with `useValixaAdapter(..., nativeText)` and reads
state using `useValixaState`. `standardFormValidator` supplies Zod validation;
`parseStandard` makes the submitted lowercase email explicit without mutating
the input while typing. Valixa composables own client subscriptions/disposal.

Production tests verify two independent HTTP responses contain their respective
initial values before JavaScript executes. Browser tests then verify stable labels,
hydration without mismatch errors, invalid input and successful transformed submit.
These pass on Chromium, Firefox and WebKit. Node-server SSR is covered; Nuxt 3,
edge/serverless deployment, navigation reuse and custom UI libraries in Nuxt are
not established by this fixture. React/Vue purchase-order workflows are tested
separately with their actual component libraries.

## Build-tool security

Adding the current Nuxt version exposed a low-severity advisory in its transitive
Rollup build dependency, [deepmerge GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).
No official patch was available. The scoped override uses a private MIT-licensed
[local patched copy](../vendor/deepmerge/README.md) with upstream/modified hashes.
It creates own data properties at all merge-destination writes instead of invoking
inherited prototype setters. The original exploit was reproduced locally, the fix
passes regression tests, and Nuxt production build/type/browser checks pass with it.
The audit returns zero known vulnerabilities without ignored advisories.

The copy is versioned `4.3.2-valixa.1` to identify modified code, **not** to claim an
official upstream release. It adds a local maintenance responsibility and should
be removed when an official verified fix becomes available. It is only used by
private build tooling and is not a dependency or bundled file of any Valixa library.

The new Standard Schema subpath is not yet on npm; the published 1.0.0-rc.1 alone
cannot run this development fixture. No new public version was released here.
