# Valixa

**Developers own the UI. Valixa owns the form behavior.**

The core is a headless TypeScript form engine with no runtime dependencies.
React hooks and Material UI adapters include optional MUI X date codecs. Phase 3
adds Vue composables and Vuetify bindings with a file boundary. Phase 4 adds Angular
signals/directives and Material adapters in Angular Package Format.
Phase 5 adds dependency-aware scheduling, conditional fields, explicit nested schemas,
stable dynamic rows, form validators and English/Arabic localization.
See [Phase 2](docs/phase-2.md), [Phase 3](docs/phase-3.md), [Phase 4](docs/phase-4.md)
and the [Phase 5 guide](docs/phase-5.md).

Phase 6 adds optional typed Auto Forms for all three UI stacks and opt-in, redacted
local DevTools. See the [Auto Forms and DevTools guide](docs/phase-6.md),
[architecture audit](docs/phase-6-audit.md) and [verification report](docs/phase-6-report.md).
Choose **Auto Form** in any framework example to try the shared generated schema.

Phase 5.1 optimizes immutable sharing, field projections, validation allocations and
collection propagation. See the [performance audit](docs/phase-5-1-performance-audit.md)
and [before/after report](docs/phase-5-1-report.md). `pnpm benchmark` retains the
original workloads; `pnpm benchmark:compare` pairs preserved Phase 5 with current core.

## Release status and documentation

The prepared candidate is **1.0.0-rc.1**; stable target **1.0.0**. Preparation is not npm publication. See the [release-readiness report](docs/phase-7-release-readiness.md) for actual registry and verification status, the [documentation index](docs/index.md) for installation/framework guides, and [release procedure](docs/releasing.md) for approval and OIDC requirements.

Repository: [Heshammesalam/Valixa](https://github.com/Heshammesalam/Valixa).

## Run locally

Use Node 24 and pnpm 10.26.2 (the versions used for local verification).

```sh
pnpm install
pnpm check
```

`check` builds declarations and ESM, type-checks source/tests/TypeScript examples,
runs Vitest, and executes both JavaScript and TypeScript consumer examples.
The core package is not published. Examples resolve it through the workspace.

## First form

```ts
import { createValixa } from '@valixa/core';

const form = createValixa({
  email: ['', 'required | email'],
  password: ['', 'required | min:8']
});

form.setValue('email', 'user@example.com');
const result = await form.validate();
console.log(result.valid); // false
console.log(result.errors); // { password: ['password is required.'] }

form.setValue('password', 'long-enough');
const submission = await form.submit(async (data, { signal }) => {
  // Call your API here, passing signal where supported.
  return { email: data.email };
});
console.log(submission.status); // success
form.dispose();
```

JavaScript uses exactly the same API, without annotations. TypeScript infers field
names and values. `setValue('unknown', ...)` and mismatched values fail type checks.

## Workspace

- `packages/core`: reusable blueprints, validation, form state and subscriptions.
- `packages/react`: stable form ownership, field subscriptions and custom adapters.
- `packages/mui`: explicit MUI props and optional `@valixa/mui/x` date bindings.
- `packages/vue`: scope-owned raw forms, typed projections and custom adapters.
- `packages/vuetify`: explicit Vuetify bindings and local-file/metadata handling.
- `packages/angular`: DestroyRef-owned signals and typed native/CVA directives.
- `packages/angular-material`: actual Material controls, codecs and error presentation.
- `examples/core`: runnable JavaScript and TypeScript examples.
- `examples/react`: runnable native, registration and advanced MUI forms.
- `examples/vue-vuetify`: native Vue, registration and advanced Vuetify forms.
- `examples/angular-material`: prerendered native login and two Material screens.
- `tests`: validation, lifecycle, concurrency and compile-time API checks.
- `docs`: [public API](docs/api.md), [architecture](docs/architecture.md), and
  [implementation report](docs/implementation-report.md).

Only implemented packages exist. Later phases add independent packages without
framework dependencies entering core.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm build` | Emit core ESM, source maps and declarations |
| `pnpm typecheck` | Build and check source, examples and type assertions |
| `pnpm test` | Execute Vitest |
| `pnpm example:js` | Run the JavaScript consumer after build |
| `pnpm example:ts` | Run the TypeScript consumer after build |
| `pnpm check` | Run all the above checks |
| `pnpm changeset` | Record a release change (requires a Git checkout) |
| `pnpm example:react` | Start the React/MUI example application after package build |
| `pnpm example:vue` | Start the Vue/Vuetify example application after package build |
| `pnpm example:angular` | Start the Angular/Material app after package build |
| `pnpm examples:build` | Build all three apps and nine example screens |
| `pnpm test:packages` | Independently install and check tarballs |
| `pnpm test:packages:vue` | Check Vue/Vuetify tarballs, SSR and tree-shaking |
| `pnpm test:angular` | Focused Angular/Material integration tests |
| `pnpm test:packages:angular` | APF, SSR, strict templates and independent consumer browser checks |
| `pnpm test:browser` | Exercise all production apps in installed Chromium |

ESM only. No CommonJS compatibility claim. Nothing is published by CI.

License: MIT.
