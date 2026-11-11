import { Component, DestroyRef, inject, signal } from '@angular/core';
import { createValixa } from '@valixa/angular';
import { dateOnlyCodec } from '@valixa/angular-material';
import { defineAutoCodec } from '@valixa/auto';
import { ValixaAutoForm, ValixaAutoRenderer, angularMaterialAdapter } from '@valixa/angular-auto';
import { ValixaDevtools } from '@valixa/angular-devtools';
import { attachValixaDevtools } from '@valixa/devtools';
import { generatedSchema, generatedOptions, generatedUI, saveGenerated } from '../../shared/generated.js';
@Component({ selector: 'generated-form', standalone: true, imports: [ValixaAutoForm, ValixaAutoRenderer, ValixaDevtools], template: `<h2>Auto Form</h2><p>Explicit UI metadata, custom controls and local diagnostics.</p><valixa-auto-form [form]="form" [ui]="ui" [adapter]="adapter" [onSubmit]="save"><ng-template valixaAutoRenderer="counter" [autoField]="form.field('seats')" let-field let-config="config"><button type="button" aria-label="Add seat" [disabled]="field.state().disabled || field.state().readonly" (click)="field.setValue(field.value() + 1)">{{ config.label }}: {{ field.value() }}</button></ng-template></valixa-auto-form><output aria-label="Generated result">{{ result() }}</output><valixa-devtools [inspections]="[inspection]"/>` })
export class Generated {
  readonly form = createValixa(generatedSchema, generatedOptions); readonly ui = generatedUI; readonly result = signal('');
  readonly adapter = { ...angularMaterialAdapter, codecs: { civilDate: defineAutoCodec<string | null, Date | null>({ view: 'date', ...dateOnlyCodec }) } };
  readonly inspection = attachValixaDevtools(this.form.core, { name: 'Generated registration', historyLimit: 60 });
  readonly save = async (values: typeof generatedSchema.__values) => { const saved = await saveGenerated(values); this.result.set(saved); return saved; };
  constructor() { const off = this.form.core.observeEvents(() => this.result.set(''), { types: ['form.reset'] }); inject(DestroyRef).onDestroy(() => { off(); this.inspection.detach(); }); }
}
