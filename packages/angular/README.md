# valixa-angular

Phase 5 adds shared typed nested paths, reactive field behavior/pending state,
`form.array`, `form.setLocale` and `form.cancelValidation`. For collection row
components, `bindValixa(row.form, { id, destroyRef })` creates borrowed signal
projections: view destruction unsubscribes without disposing the parent-owned row.
Track rows by `row.key`, and use `row.form` as the field namespace. See the core
package's `ADVANCED.md` for scheduling, row ownership and localization semantics.

Standalone Angular 21.2 signals, ownership and typed control bindings for Valixa.
Built with ng-packagr in partial-Ivy Angular Package Format. Angular is a peer;
the core remains framework-independent. No FormGroup or FormControl is required.

## First form

```ts
import { Component, signal } from '@angular/core';
import { createValixa, ValixaFieldDirective } from 'valixa-angular';

@Component({
  standalone: true,
  imports: [ValixaFieldDirective],
  template: `
    <form novalidate (submit)="onSubmit($event)">
      <label [for]="email.id">Email</label>
      <input [valixaField]="email" type="email"
        [attr.aria-describedby]="email.error() ? email.errorId : null">
      @if (email.error()) { <span [id]="email.errorId">{{ email.error() }}</span> }
      <button [disabled]="form.submitting()">Save</button>
      <button type="button" (click)="form.reset()">Reset</button>
      <p role="status">{{ requestError() }}</p>
    </form>`
})
export class Login {
  form = createValixa({ email: ['', 'required | email'] }, { id: 'login' });
  email = this.form.field('email');
  requestError = signal('');
  submit = this.form.handleSubmit(async (data, { signal }) => {
    // await yourApi.save(data, { signal });
  });
  async onSubmit(event: Event) {
    try { await this.submit(event); } catch { this.requestError.set('Please retry.'); }
  }
}
```

Create event callbacks once in a component initializer. `submit(handler)` executes
immediately; `handleSubmit(handler)` returns an event callback and prevents default
when passed the event. Rejections propagate. Event code must explicitly catch them.
Use native `novalidate` when Valixa should own validation.

## Ownership and signal access

`createValixa(inputOrBlueprint, options?)` creates an `AngularForm<InferValues<S>>`
around one core store. It injects DestroyRef and an application-local ID sequence;
call it in a component/service initializer, provider factory or injection context.
`options` accepts core `FormOptions`, plus explicit `id` and `destroyRef`.

Outside an injection context, supply **both** an explicit DestroyRef and form ID.
The caller owns that lifecycle. No implicit global owner is created. JavaScript can
use the same API without annotations where Angular tooling supports it; the package
checks include a plain-JavaScript form and SSR consumer.

The wrapper exposes:

- `state(): FormState<V>`: immutable values/defaults/errors/touched/dirty/pristine,
  validity, pending/submission flags/count, disabled and readonly state.
- `submitting()`, `validating()`, `valid()`, `submitCount()`: convenience signals.
- `field(name)`: a cached typed `AngularField<T>` with `name`, stable `id` and
  `errorId`, `state()`, `value()`, `error()`, guarded `setValue(T)` and `onBlur()`.
- `error(name)`: first current message, read reactively through its field signal.
- Core operations `setValue`, `setValues`, `setTouched`, `setError`, `clearErrors`,
  `setDisabled`, `setReadonly`, `validate`, `submit`, `handleSubmit`, `cancelSubmit`,
  `reset`, plus `dispose`. Return types and semantics match core.
- `core`: the owned core instance for inspection/advanced integration. Dispose the
  wrapper rather than bypassing its ownership through `core.dispose()`.

Each form has one whole-store bridge; field projections subscribe once on first
use and remain cached for that owner's lifetime. Directives consume these signals,
not additional core subscriptions. A transient view releases its DOM listeners and
effects without disposing its parent-owned form. DestroyRef releases all cached
subscriptions and disposes the owned core. Disposed forms must not be mutated.

Unchanged fields retain snapshot identity and do not notify their signal readers.
Use OnPush child components that read only their field when isolating rendering.
Reading whole-form state in a parent naturally broadens its dependencies. There is
no global change-detection trigger or second state engine. Programmatic writes
through the wrapper remain allowed when disabled/readonly; field user writers do not.

Construction is stable for the owning component lifetime. Changing input props
does not silently replace the form. Reset restores original defaults. Reinitialize
by replacing the owner or explicitly disposing/recreating it with a matching view.

## Typed directive and codecs

Import `ValixaFieldDirective` and pass a typed field object:

```html
<input [valixaField]="form.field('email')">
```

Unknown names fail both TypeScript and strict Angular template checks. No string
field registry or component-name guessing is involved. The directive writes the
initial value in `ngOnInit` before content children initialize, then uses effects
to render signal changes. It reads actual user events, marks touched on blur,
applies flags and `aria-invalid`, and tears down automatically.

Native support covers text/textarea, checkbox, radio and select (including multiple
string selections). Native file inputs require a separately designed explicit
adapter and are not supported by the built-in path.

Radio controls use the unique form/field ID as their native group name and add the
encoded option value to each input ID. Use wrapping labels for native radio options.

Numeric inputs require a codec:

```ts
form = createValixa({ amount: { initial: null as number | null } });
amount = this.form.field('amount');
numeric = numberCodec(null);
```

```html
<input type="number" [valixaField]="amount" [valixaCodec]="numeric">
```

`numberCodec(emptyValue)` converts finite input numbers and uses the explicitly
typed empty value for blank/invalid text. `ValueCodec<T, View>` has `encode(View): T`
and `decode(T): View`. Codecs must be pure and must encode supported plain data.
Snapshots passed to them are immutable. Use codecs for serialized/object/null
policies as needed; do not expect a DOM string to become a number automatically.

Labels, native required metadata and extra descriptions remain application-owned.
`field.id`/`errorId` provide stable IDs for those bindings. UI `required` does not
add a core rule; a core rule does not silently add native constraint validation.

## CVAs and explicit custom controls

The directive **consumes** a CVA; it is not one. It resolves an explicit
`VALIXA_CONTROL` provider first, then exactly one self NG_VALUE_ACCESSOR, then the
native renderer path. Unsupported/ambiguous custom hosts need an explicit adapter.
Combining `valixaField` with NgModel/FormControl/FormControlName on the same element
throws, preventing competing state/validation ownership and callback replacement.

Custom CVAs register normal change/touched callbacks. `writeValue` must not emit
user changes, as required by the CVA contract; a synchronous write guard also
prevents accidental echo loops. Teardown neutralizes callbacks. No application
valueChanges subscriptions or custom CVA for a standard control are required.

For explicit input/output components:

```ts
providers: [provideValixaControl<number>(() => {
  const control = inject(MyCounter);
  return {
    writeValue: value => control.value.set(value),
    setState: status => control.inactive.set(status.disabled || status.readonly),
    connect: (change, touched) => {
      const subscription = control.amount.subscribe(payload => {
        change(payload.amount); touched();
      });
      return () => subscription.unsubscribe();
    }
  };
})]
```

`ValixaControlAdapter<View>` separates `writeValue`, `setState(ControlStatus)` and
`connect(change, touched)`. Status includes errors/touched/dirty/pending/flags and
name/IDs, without field values. The adapter can map any input/output or error UI.
`provideValixaControl(factory)` registers it on the control host. DI erases the view
generic at the token boundary; keep its factory and codec view contracts consistent.

Controlled input/output components receive an echo of accepted core changes by
default. CVAs/native inputs set `preserveViewOnChange: true`, because their view
already updated; this also preserves autocomplete drafts/carets. An adapter can
require an explicit codec with `requiresCodec: true`. Blocked events restore the
core value. `valueAccessorAdapter(accessor, optionalStatusCallback)` is available
for explicit CVA factories and maps unsupported readonly to disabled presentation.

## Validation and requests

Core alone validates. Manual/submit is the default; change/blur are opt-in options.
Custom/async rules, cross-field equality, cancellation, stale-result prevention and
server errors keep their existing semantics. Changed values conservatively clear
errors and cancel obsolete runs. Initial `valid()` means no known errors, not that
validation has completed. No dependency graph or scheduler is added.

Handlers receive an isolated data copy and AbortSignal. Duplicate submissions are
locked; cancellation remains cooperative. Map known 422 payloads with `setError`;
no HTTP client/response shape is assumed. Failures reject, success does not reset
automatically, and reset/cancel/dispose retain core behavior.

## SSR and packaging

Rendering uses Renderer2/DI without browser globals. IDs come from an app-local
`ValixaIds` sequence using APP_ID, or explicit form IDs. Use explicit IDs and matching
initial values/construction order across server/client bootstraps. Native initial
screen hydration is tested by DOM-node reuse; it is not blanket coverage of every
Material popup, routing strategy or incremental/event-replay hydration mode.

The npm artifact is `dist/` produced by ng-packagr, not this source manifest.
It contains FESM2022, partial Angular metadata, declarations/maps and guides.
Angular/core/forms/RxJS are peers; Material is not required by this package.
Plain Node JIT/SSR consumers load `@angular/compiler`; AOT consumers link the APF
library through Angular tooling. Other Angular majors are not advertised.
