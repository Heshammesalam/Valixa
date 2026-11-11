# Phase 4: Angular and Angular Material

The [audit](phase-4-audit.md) records the pre-implementation review and chosen
boundaries. See the [implementation report](phase-4-report.md) for tested versions
and results. Public guides ship with the APF artifacts:

- [Angular signals, ownership, typed directive, codecs and custom adapters](../packages/angular/README.md)
- [Material component reference, error state, date/autocomplete and accessibility](../packages/angular-material/README.md)
- [Three complete runnable examples](../examples/angular-material/README.md)

## Selected API

```ts
form = createValixa({ email: ['', 'required | email'] }, { id: 'login' });
email = this.form.field('email');
submit = this.form.handleSubmit(async (data, { signal }) => { /* API */ });
```

```html
<mat-form-field>
  <mat-label>Email</mat-label>
  <input matInput [valixaField]="email" required>
  <mat-error>{{ email.error() }}</mat-error>
</mat-form-field>
```

Import `VALIXA_MATERIAL` alongside the actual Material modules. Core validates,
Angular signals project state, and the directive consumes an existing CVA or native
renderer binding. Explicit adapters cover custom contracts. No Angular FormControl,
FormGroup, competing Validators or repeated valueChanges subscription is required.

## Verification

```sh
pnpm check
pnpm examples:build
pnpm exec playwright install chromium
pnpm test:browser
pnpm test:packages
```

`test:angular` and `test:packages:angular` focus on this integration. Full commands
retain all prior React/Vue coverage. Package checks create two extra offline
consumers outside workspace ancestors: Angular without Material, and Material with
actual peers. They inspect APF metadata/maps/exports, run JavaScript and SSR, compile
strict positive/negative Angular templates, build real consumer applications and
run those builds in Chromium. Install Chromium before package checks too.

Angular tarballs come from ng-packagr's `dist/` output, not workspace source
manifests. Generated consumers remain in OS temp for inspection and tarballs under
ignored `artifacts/packages`. No publishing command is part of verification.

## Boundaries

Injection/DestroyRef ownership and explicit IDs are documented in the Angular guide.
Native initial-screen hydration has actual DOM-reuse evidence; full Material popup,
incremental hydration and event-replay strategies are not claimed. Browser evidence
is Chromium on Windows. Other Angular majors require separate validation.

Core/React/Vue runtime contracts are preserved. No Phase 5 graph, scheduler, dynamic
path registration, locale system or benchmark feature has been started.
