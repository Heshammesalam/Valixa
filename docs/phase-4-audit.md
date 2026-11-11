# Phase 4 audit and selected design

Before implementation, inspected all five package manifests/exports, core state,
validation/submission/disposal contracts, React/MUI and Vue/Vuetify sources,
architecture/reports, workspace scripts, consumers, tests and CI. No applicable
AGENTS.md was found. No core runtime change or breaking API change is proposed.

## Existing contracts to preserve

Core has immutable cached field snapshots and synchronous unsubscribe-based stores.
Validation is manual/submit by default; blur/change policies are opt-in. Writes
conservatively invalidate errors and obsolete async work. Submission executes via
`submit`, while `handleSubmit` returns a callback. Errors propagate, duplicate
requests are locked, cancellation is cooperative, and disposal is permanent.
Plain data only: Date/File/library instances cannot enter values.

React external-store hooks and Vue scope projections establish ownership and
subscription isolation, but their framework lifetimes do not fit Angular directly.
The existing baseline is 88 tests, six browser flows and five isolated consumers.

## Versions and tooling

Target Angular/Material 21.2, ng-packagr 21, strict TypeScript 5.9. Angular 21.2's
compiler peer range supports the workspace compiler. Use standalone directives,
signals, DestroyRef and zoneless change detection. Build libraries in partial Ivy
Angular Package Format through ng-packagr; build apps through Angular CLI/application
tooling. Framework imports remain external, and core stays unchanged.

## Selected API and ownership

```ts
form = createValixa({ email: ['', 'required | email'] }, { id: 'login' });
email = this.form.field('email');
submit = this.form.handleSubmit(async (data, { signal }) => { /* API */ });
```

```html
<form novalidate (submit)="onSubmit($event)">
  <mat-form-field>
    <mat-label>Email</mat-label>
    <input matInput [valixaField]="email" required />
    <mat-error>{{ email.error() }}</mat-error>
  </mat-form-field>
</form>
```

`createValixa` runs in an injection context (or takes an explicit DestroyRef), owns
one core form and exposes signal state plus cached field projections. Typed field
objects make unknown names fail in TypeScript and templates. Each field has one
core subscription for the owner's lifetime; directives consume signals through
Angular effects, avoiding duplicate core listeners. DestroyRef releases effects,
listeners and owned forms. Reinitialization is an explicit owner replacement.

## Directive and adapter boundaries

- A standalone typed directive consumes a supplied field, optional value codec and
  explicit control adapter. Native text/textarea/select/checked inputs have a renderer
  binding. Existing NG_VALUE_ACCESSOR providers can be consumed for custom CVAs.
- The directive is not a CVA and does not create FormControls, FormGroups or Angular
  Validators. Combining it with NgModel/FormControl directives is rejected.
- An explicit adapter token/provider supports custom input/output controls. No class
  name guessing. Material selectors/tokens identify actual supported components.
- Material uses its CVAs for select/checked/radio/toggle/date/autocomplete. MatInput
  uses the native renderer path. A Material error-state matcher reads core errors,
  including server/manual errors without requiring an Angular control.
- Adapters separately write values and status. Own user updates do not echo back
  through CVA writes, preserving autocomplete drafts and avoiding circular updates.
  Blocked readonly events restore the rendered value. Controls lacking readonly
  semantics use disabled presentation for that state; document this explicitly.
- Numeric/date codecs encode plain values. Autocomplete codecs distinguish typed
  drafts from selected objects and must represent invalid/unselected drafts in core.
  Native required/label metadata remains UI-owned, without a second validator engine.

## SSR/hydration risks

Use Renderer2/DI, with no browser globals during server rendering. IDs come from an
application-local sequence or explicit form ID; explicit IDs are recommended across
server/client bootstraps. SSR must be tested, and hydration consistency/subscription
cleanup investigated. Do not claim hydration until actual browser hydration passes.
Keep server/client initial values and form construction order consistent.

References: [Angular version compatibility](https://angular.dev/reference/versions),
[APF](https://angular.dev/tools/libraries/angular-package-format),
[library compilation](https://angular.dev/tools/libraries/creating-libraries).
