# Phase 1 implementation report

Date: 2026-11-08. Scope: Core MVP only. Phase 2 has not started.

## Delivered

- Initialized the empty workspace as a pnpm monorepo.
- Added the dependency-free `@valixa/core` ESM package with explicit exports,
  declarations, source maps and included sources.
- Implemented typed tuple/object blueprints with reusable isolated instances.
- Implemented eagerly parsed built-in rules, custom validators and asynchronous
  validators with abort signals and stale-result protection.
- Added immutable values/errors/touched/dirty and lifecycle state, reset, explicit
  error management, form subscriptions and field subscriptions.
- Added validated async submission, duplicate prevention, cancellation signals,
  server-error writes and an explicit event-handler factory.
- Added runnable JavaScript and TypeScript examples demonstrating the exact
  email/password validation slice, then field subscriptions and submission.
- Added public API documentation, architecture notes, MIT license, changelog,
  Changesets configuration, lockfile and a CI verification matrix.

## Verified locally

Environment: Windows, Node 24.12.0, pnpm 10.26.2, TypeScript 5.9.3,
Vitest 4.1.12.

`pnpm check` passed:

- Strict TypeScript build and declaration generation.
- Strict source/example/test compilation, including negative field-name/value
  assertions with `@ts-expect-error`.
- **51 passing tests across 2 files** covering parser errors, built-in and custom
  validation, cross-field equality, async races, exception handling, state,
  subscriptions, immutable data, reset/disposal and submission lifecycle.
- JavaScript and TypeScript examples executed successfully using package exports.

Created `artifacts/valixa-core-0.1.0.tgz` with:

```sh
pnpm --filter @valixa/core pack --pack-destination artifacts
```

The tarball includes ESM, declarations, maps, sources, README, full API reference
and license. It was installed offline into an isolated consumer under `artifacts/`;
the JavaScript example executed successfully and TypeScript resolved its public
declarations successfully. This checks package consumption without workspace links.
Generated artifacts and the isolated installation are ignored by Git.

The configured Linux CI matrix for Node 20/22/24 has not run locally. No framework
integration, browser integration, accessibility or performance compatibility claim
is made. No package was published.

## Deliberate API decisions

`submit(handler)` executes now. `handleSubmit(handler)` returns an event callback.
Keeping these separate avoids ambiguity between the requested Promise-based core
submission API and future framework event usage.

Validation defaults to submit/manual. Change/blur triggers are opt-in. All errors
are conservatively invalidated on changed values because custom validators can
read any field. There is no incremental dependency graph in this phase. Partial
validation updates one field while global `valid` reflects all known errors;
initial `valid` does not imply the form has been validated.

Cancellation signals prevent obsolete state commits, but handlers that ignore
their signals may continue external effects. The submission lock remains until
the handler settles. Callers must handle rejected submission Promises.

## Deferred

React/MUI, Vue/Vuetify, Angular/Angular Material and native DOM bindings; custom
adapter registration; dependency graphs and cycles; conditional behaviors; nested
paths and dynamic collections; form-level validation; transformations; debounce
and timeout policies; Arabic/localization switching; auto forms; devtools;
large-form benchmarks. No placeholder packages advertise these features.

Nested objects and arrays currently work as atomic top-level field values. Rich
objects such as Date/File are rejected. English message templates and field labels
can be overridden, but this is not yet a full localization system.
