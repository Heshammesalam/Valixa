# valixa-angular-material

Angular Material 21.2 control bindings for Valixa's Angular signal bridge. Angular
and Material remain peers. Built in partial-Ivy Angular Package Format.

## Getting started

```ts
import { Component } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { createValixa } from 'valixa-angular';
import { VALIXA_MATERIAL } from 'valixa-angular-material';

@Component({
  standalone: true,
  imports: [...VALIXA_MATERIAL, MatInputModule, MatFormFieldModule],
  template: `
    <mat-form-field>
      <mat-label>Email</mat-label>
      <input matInput [valixaField]="email" required>
      <mat-error>{{ email.error() }}</mat-error>
    </mat-form-field>`
})
export class EmailField {
  form = createValixa({ email: ['', 'required | email'] }, { id: 'email-form' });
  email = this.form.field('email');
}
```

`VALIXA_MATERIAL` contains `ValixaFieldDirective` and `ValixaMaterialDirective`.
Import your actual Material modules and styles normally. Do not add Angular Forms
directives on the same control. No FormControl/Group/Validators are created.

## Component contracts

| Control | Binding behavior |
| --- | --- |
| MatInput text/textarea | Native input events, initial/programmatic value writes, blur, flags, Material ID and error state |
| MatInput numeric | Explicit `numberCodec(emptyValue)` required; finite numeric/plain values |
| MatSelect | Its actual CVA, scalar/object/multiple values and reset; native `compareWith` remains application-owned |
| MatCheckbox | Its actual checked CVA; disabled/readonly and external error descriptions |
| MatRadioGroup | Its actual CVA, initial selection before children initialize, child events and blur/touch |
| MatSlideToggle | Its actual CVA and switch semantics |
| MatAutocomplete input | Its trigger CVA plus required codec; typed drafts distinguished from selected objects |
| MatDatepicker input | Its date-input CVA plus required codec; dates/parse failures encoded as plain values |
| MatError | Error-state matcher follows known core errors, including manual/server errors without an Angular control |

Material selectors and actual DI tokens identify these supported hosts. No runtime
class-name guessing or universal event extractor is used. CVAs already normalize
component-specific events, so their callbacks connect directly to core through codecs.

Input fields retain native readonly semantics. Select/Checkbox/RadioGroup/SlideToggle
lack equivalent readonly behavior, so readonly maps to disabled presentation; core
still records readonly separately and allows programmatic writes. Autocomplete is
readonly and closes/disables its panel. Date input readonly blocks typing and its
picker accessor disables selection. Disabled applies normally. Guarded writers also
restore values if an already captured event arrives after flags changed.
Radio group names use the unique form/field ID, preventing same-named fields in
separate Valixa forms from unchecking each other's native radios.

Labels and required metadata belong to the UI. Material manages form-field label
and helper IDs; the adapter keeps the input/control ID consistent and uses public
error-state APIs. Standalone checked/group controls can use explicit descriptions:

```html
<mat-checkbox [valixaField]="terms" required>Agree</mat-checkbox>
@if (terms.error()) { <mat-error [id]="terms.errorId">{{ terms.error() }}</mat-error> }
```

Known core errors display immediately; no extra touched-based hiding policy or
Angular Validator engine is introduced. Core still controls when validation runs.

## Object/multiple selections and clearing

```html
<mat-select multiple [compareWith]="compareById" [valixaField]="offices">
  @for (office of cities; track office.id) {
    <mat-option [value]="office">{{ office.title }}</mat-option>
  }
</mat-select>
```

Core copies plain objects. Supply a stable `compareWith` when identity matters:
`compareById = (a: City, b: City) => a?.id === b?.id`. Multiple selections use arrays;
null/undefined scalar models display unselected through the Material CVA. Ensure
option/clearing values match the field type. Annotate nullable fields or provide
an explicit codec such as `encode: value => value ?? ''` for a nonnullable string
clear policy. Valixa does not silently coerce every Material selection.

## Autocomplete: committed options and typed drafts

```ts
type City = { id: number; title: string };
const isCity = (value: unknown): value is City =>
  value !== null && typeof value === 'object' && 'id' in value && 'title' in value;
form = createValixa({ city: { initial: null as City | null, rules: 'required' } });
city = this.form.field('city');
cityCodec = autocompleteCodec(isCity);
displayCity = (value: City | null) => value?.title ?? '';
```

```html
<input matInput [matAutocomplete]="auto" [valixaField]="city" [valixaCodec]="cityCodec">
<mat-autocomplete #auto="matAutocomplete" [displayWith]="displayCity">
  @for (city of cities; track city.id) { <mat-option [value]="city">{{ city.title }}</mat-option> }
</mat-autocomplete>
```

`autocompleteCodec(predicate)` commits selected objects and maps typed strings or
clearing to null. Editing an existing selection therefore cannot submit a stale
selected object. Own CVA updates do not echo back and erase the search draft;
programmatic changes/reset still write through the CVA. Match `required` or custom
rules to your draft/null policy. The helper is for object options; use a custom
codec/adapter for free text or string-option contracts that need selection tracking.

## Datepicker and numeric codecs

```ts
form = createValixa({ date: { initial: null as string | null,
  validate: (value: string | null) => value !== 'invalid' || 'Choose a valid date.' }
});
date = this.form.field('date');
dateCodec = dateOnlyCodec;
// Component providers: [provideNativeDateAdapter()]
```

```html
<input matInput [matDatepicker]="picker" [valixaField]="date" [valixaCodec]="dateCodec">
<mat-datepicker-toggle matIconSuffix [for]="picker" />
<mat-datepicker #picker />
```

`dateOnlyCodec` is for NativeDateAdapter: valid local civil dates encode as
YYYY-MM-DD, clearing as null, invalid dates as `'invalid'`. Decode uses local
components, avoiding UTC day shifts. The adapter distinguishes parse failure from
empty input using the input text and DateAdapter's invalid-date value. No Date
instance reaches core. Declare the sentinel validator, and declare matching core
rules for any Material min/max/filter constraints; picker UI constraints do not
replace submission validation. Other date libraries need an explicit matching codec
and have not been tested here.

Numeric MatInput uses `numberCodec` from `valixa-angular`, with a typed empty value
such as null or zero. Unsupported implicit numeric coercion is rejected at runtime
when no codec is supplied. Strict consumer templates also check codec/field types.

## Requests, custom controls and packaging

Use the Angular wrapper's existing `submit` / setup-created `handleSubmit` APIs,
signals, `setError`, reset and cancellation. Catch request rejections explicitly;
map your known server payloads rather than guessing HTTP response shapes. Core
semantics, including conservative error invalidation and stale-run protection,
remain authoritative. No dependency graph or scheduler is included.

Custom controls use `provideValixaControl` or an existing CVA from `valixa-angular`.
No wrapper component is required. Explicit adapters map value/status/events and own
their teardown; controlled input/output components get accepted values echoed back,
while native/CVA bindings preserve their already-updated view.

The npm artifact is the `dist/` ng-packagr output with FESM2022, partial declarations,
maps, peers and this guide. Angular Material is not bundled. The base Angular package
works without Material installed. Production consumer compilation and browser checks
use independently installed tarballs. Supported evidence is Angular/Material 21.2
and reported Chromium on Windows, not other majors or full WCAG conformance.
