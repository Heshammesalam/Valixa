# valixa-angular-auto

Optional standalone Angular Signals + Material Auto Forms, shipped as partial-Ivy
Angular Package Format. Requires Angular/Material 21.2 and Valixa core/angular/
angular-material/auto peers. No React/Vue dependency.

Import `ValixaAutoForm` into your standalone component. Author `ui` using
`defineAutoForm(schema, config)` from valixa-auto and create an Angular form with
the existing valixa-angular factory in an injection context.

```html
<valixa-auto-form [form]="form" [ui]="ui" [onSubmit]="save"
  (result)="onResult($event)" (failure)="onFailure($event)" />
```

All standard widgets, groups, conditions and keyed rows are supported. Dates require
an explicit `view:'date'` codec (for example dateOnlyCodec plus a view tag), registered
in a shallow copy of angularMaterialAdapter. Multiple autocomplete is rejected;
use multi-select or a custom template. File/third-party conversion is explicit.

`ValixaAutoRenderer` types custom template contexts using an example AngularField:

```html
<ng-template valixaAutoRenderer="counter" [autoField]="form.field('seats')"
  let-field let-config="config">
  <button type="button" (click)="field.setValue(field.value()+1)">
    {{config.label}}: {{field.value()}}
  </button>
</ng-template>
```

Place it inside valixa-auto-form. Respect disabled/readonly/blur/accessibility in custom
controls. Registry keys are runtime contracts; examples establish context typing,
not a global type proof for every registry reuse. Set showDefaultActions false and
project `[autoActions]` to replace controls. Forms/rows are borrowed; owner disposal
remains with the existing Angular form/collection lifecycle.

See docs/phase-6.md in the repository for shared UI metadata and compatibility.
