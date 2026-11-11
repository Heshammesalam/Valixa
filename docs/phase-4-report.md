# Phase 4 implementation report

Completed: 2026-11-10. Phase 4 only. No Phase 5 implementation and no npm publishing.

## Audit and architecture

The [audit](phase-4-audit.md) records the required pre-implementation review of all
packages, core contracts, React/Vue integrations, scripts, tests, consumers and CI.
Core, React/MUI and Vue/Vuetify runtime code remained unchanged.

Implemented `@valixa/angular` and `@valixa/angular-material` using standalone Angular
APIs, signals, DI and DestroyRef, built by ng-packagr in partial-Ivy Angular Package
Format. Angular runtimes remain peers and external FESM imports. The artifacts are
packed from generated `dist/`, not workspace source manifests.

The Angular wrapper owns one core instance, one form-state signal bridge and cached
field projections. Each field subscribes once for the owning lifetime. Directives
consume those signals with effects, cleaning view listeners on destruction; owner
DestroyRef releases projections and disposes the core. OnPush isolation tests show
an email write does not rerender an unchanged password field.

The directive consumes CVAs rather than implementing a second forms system. Native
renderer bindings cover native controls; explicit DI adapters cover arbitrary
contracts. NgModel/FormControl ownership on the same element is rejected. Initial
values write in ngOnInit before content children initialize, fixing radio defaults;
later state is signal-driven. CVA/native own updates avoid echoing draft text, while
controlled input/output components receive accepted values back. Synchronous write
guards prevent CVA echo loops.

## Final public API

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

Angular exports `createValixa`, `AngularForm`, `AngularField`, `ValixaFieldDirective`,
native/CVA adapter helpers, explicit provider/token contracts, numberCodec and
ControlStatus/ValueCodec types. Forms expose immutable `state()` plus convenience
signals, cached `field()`/`error()`, and core mutation/validation/submission methods.
Factory use requires an injection context or explicit DestroyRef **and** ID.

Material exports `ValixaMaterialDirective`, `VALIXA_MATERIAL`, `autocompleteCodec`
and `dateOnlyCodec`. Supported: MatInput text/textarea/numeric, MatSelect scalar,
object/multiple with compareWith, MatCheckbox, MatRadioGroup, MatSlideToggle,
MatAutocomplete, MatDatepicker and MatError presentation.

Material CVAs handle actual component contracts. A public error-state matcher maps
known core errors without FormControls. Controls lacking readonly semantics map it
to disabled presentation. Numeric/date/autocomplete views require explicit codecs;
invalid date drafts become a plain sentinel validated by core, and autocomplete
search drafts clear committed object selection without erasing visible search.
Radio names use unique form/field IDs to keep separate forms independent.

## Examples

The complete Angular application has native login, Material registration and
advanced Material screens. It demonstrates validation, async username checking,
mapped 422 errors, pending states, retries, object/multiple selection, dates/numbers,
radio/toggle, a custom payload component, flags and reset. The API is simulated
locally; no credentials/data are transmitted or logged.

The production app prerenders the native route and uses provideClientHydration.
The browser test captures the actual server input node before bootstrap, verifies
hydration metadata and node reuse, then validates/submits/resets that binding.
Actual Material SSR is also tested in Node, including external errors and request
DestroyRef cleanup, with no window/browser globals.

## Verified environment and results

Windows; Node 24.12.0; pnpm 10.26.2; TypeScript 5.9.3; Angular core/compiler/forms/
platform packages 21.2.26; Angular Material/CDK 21.2.14; CLI/build/SSR 21.2.29;
ng-packagr 21.2.7; RxJS 7.8.2; Vitest 4.1.12; Playwright 1.65.0;
Chromium 158.0.8127.18. Peer ranges target Angular/Material 21.2.

| Gate | Evidence |
| --- | --- |
| `pnpm check` | Seven strict package builds, TypeScript checks, strict Vue/Angular templates, **108 passing tests across 18 files**, original JS/TS examples |
| Original regression coverage | All **88 prior tests** preserved, including 51 core tests |
| `pnpm test:angular` | **20 tests across 6 files**: signals/cache isolation, actual OnPush rendering, native/directive/CVA behavior, cleanup, errors, async races, submission/reset, custom controls, codecs, types and SSR |
| `pnpm examples:build` | Three production apps, nine screens, Angular AOT and one prerendered static route |
| `pnpm test:browser` | **9 production flows** pass, including all six original React/Vue flows and three Angular flows |
| `pnpm test:packages` | **7 independent consumers**: React, MUI, optional MUI X, Vue, Vuetify, Angular-only, Angular Material |
| `pnpm test:packages:angular` | Both APF consumers pass package/metadata/map/peer checks, JavaScript/SSR, strict positive and negative template compilation, real application builds and Chromium interactions |

Angular consumers install tarballs offline outside workspace ancestors, using actual
peers. Angular-only has no Material, React or Vue installed. Tests inspect FESM2022,
partial Angular directive declarations, types/maps and generated exports. Consumer
templates reject unknown fields and incompatible codecs. Production Angular CLI
builds link the installed APF libraries, then Chromium validates/submits the forms.
The consumer apps are not workspace aliases. Generated tarballs remain under ignored
`artifacts/packages`; temporary consumer folders remain inspectable in the OS temp.

Browser tests cover accessible errors/descriptions, required inputs, keyboard
selection, async username validation, server failure/retry, datepicker interaction,
autocomplete drafts, multiple objects, custom controls, radio/toggle, flags and reset.
No mock Material components substitute for integration coverage.

CI retains the Node matrix and prior checks, adds Angular packages/templates and
consumers, builds all three apps and installs Chromium for consumer/browser gates.
Configured Linux CI is not evidence of a local Linux run.

## Limits and qualifications

- Tested browser evidence is Chromium on Windows, not Firefox/WebKit/mobile or a
  complete accessibility/WCAG audit. Other Angular majors are untested.
- Hydration evidence covers the native initial screen with consistent IDs/data.
  Material screens/popups are tested after client navigation; blanket Material,
  incremental, event-replay and arbitrary routing hydration claims are not made.
- IDs must be unique per form. Defaults use an app-local sequence and APP_ID;
  explicit stable IDs are recommended for SSR and multiple application roots.
- Field projections intentionally remain cached until the owner is destroyed.
  Transient directive views release listeners/effects without disposing that owner.
  Schema replacement is explicit, not automatic prop-based reinitialization.
- DI erases custom adapter view generics; keep the explicit factory and codec
  contracts consistent. Native file controls require a separate explicit boundary.
- DateOnlyCodec targets NativeDateAdapter and requires a sentinel validator. Other
  date libraries and automatic Material min/max/filter-to-core translation are not
  claimed. Selection option/clearing values must match the field or use a codec.
- Core still conservatively invalidates errors/old runs. Initial valid is not proof
  of validation. There is no dependency graph, scheduler, dynamic path registration,
  locale expansion or large-form performance claim. Cancellation stays cooperative.
- Tooling reports informational workspace-export overrides during ng-packagr builds
  and optional WASI peer notices in isolated Angular build tooling. Generated APF
  exports and native production builds are independently verified. Combined demo
  bundle size is not a library size/performance claim.

## Phase 5 readiness

All four framework/UI integration phases now exercise the same unchanged core
snapshot, validation, subscription, reset and submission contracts. Angular-specific
lifecycle/CVA/Material behavior is isolated in its packages. Phase 5 can extend core
only with its own dependency-graph/scheduling/dynamic-field design and regression
evidence across these integrations. No Phase 5 work was started here.

Guides: [Angular](../packages/angular/README.md),
[Angular Material](../packages/angular-material/README.md),
[example application](../examples/angular-material/README.md).
