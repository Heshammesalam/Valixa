// @vitest-environment jsdom
import './setup.js';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import { blueprint, collection } from '@valixa/core';
import { createValixa } from '@valixa/angular';
import { defineAutoCodec, defineAutoForm } from '@valixa/auto';
import { ValixaAutoForm, ValixaAutoRenderer, angularMaterialAdapter } from '@valixa/angular-auto';
import { dateOnlyCodec } from '@valixa/angular-material';

const schema = blueprint({ email: ['', 'required | email'], age: [18], seats: [1], rows: collection({ city: ['', 'required'] }) });
const rowUI = defineAutoForm(blueprint({ city: ['', 'required'] }), { fields: { city: { component: 'text', label: 'Row city' } } });
@Component({ standalone: true, imports: [ValixaAutoForm, ValixaAutoRenderer], template: `<valixa-auto-form [form]="form" [ui]="ui" [onSubmit]="save"><ng-template valixaAutoRenderer="counter" [autoField]="form.field('seats')" let-field let-config="config"><button type="button" aria-label="Add seat" (click)="field.setValue(field.value() + 1)">{{ config.label }} {{ field.value() }}</button></ng-template></valixa-auto-form>` })
class Generated {
  form = createValixa(schema, { id: 'generated' });
  ui = defineAutoForm(schema, { fields: { email: { component: 'email', label: 'Email' }, age: { component: 'number', label: 'Age', emptyValue: 0 }, seats: { component: 'custom', renderer: 'counter', label: 'Seats' } }, collections: { rows: { label: 'Rows', ui: rowUI, createItem: () => ({ city: '' }) } }, submitLabel: 'Save' });
  save = vi.fn(async (values: typeof schema.__values) => values.email);
}
@Component({ standalone: true, imports: [ValixaAutoForm], template: `<valixa-auto-form [form]="form" [ui]="ui" [onSubmit]="save"/>` })
class Dates {
  schema = blueprint({ day: { initial: null as string | null }, country: [''], city: [''] });
  form = createValixa(this.schema, { id: 'generated-date', behaviors: { city: { dependsOn: ['country'], visibleWhen: ({ values }) => Boolean(values.country), requiredWhen: ({ values }) => Boolean(values.country) } } });
  ui = defineAutoForm(this.schema, { fields: { day: { component: 'date', label: 'Day', codec: defineAutoCodec<string | null, Date | null>({ view: 'date', ...dateOnlyCodec }) }, city: { component: 'text', label: 'City' } } });
  save = () => {};
}
afterEach(() => TestBed.resetTestingModule());
it('Angular Material Auto Form validates, binds typed custom templates, submits and resets', async () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }); const fixture = TestBed.createComponent(Generated); fixture.detectChanges();
  const form = fixture.componentInstance.form; const element = fixture.nativeElement as HTMLElement;
  element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true })); await fixture.whenStable(); fixture.detectChanges(); expect(element.textContent).toContain('email is required.');
  const email = element.querySelector('input[type=email]') as HTMLInputElement; email.value = 'ada@example.com'; email.dispatchEvent(new Event('input'));
  (element.querySelector('button[aria-label="Add seat"]') as HTMLButtonElement).click(); expect(form.state().values.seats).toBe(2);
  element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true })); await fixture.whenStable(); expect(fixture.componentInstance.save).toHaveBeenCalledOnce(); expect(form.state().submitted).toBe(true);
  element.querySelector('form')!.dispatchEvent(new Event('reset', { cancelable: true })); fixture.detectChanges(); expect((element.querySelector('input[type=email]') as HTMLInputElement).value).toBe(''); fixture.destroy();
});
it('Angular Auto Form retains keyed row views and borrowed stores through reorder/removal', () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }); const fixture = TestBed.createComponent(Generated); fixture.detectChanges();
  const rows = fixture.componentInstance.form.array('rows'); rows.append({ city: 'Cairo' }); fixture.detectChanges(); const element = fixture.nativeElement.querySelector('[data-valixa-row]'), row = rows.items[0]!;
  rows.append({ city: 'Giza' }); rows.move(0, 1); fixture.detectChanges(); expect(fixture.nativeElement.querySelectorAll('[data-valixa-row]')[1]).toBe(element); expect(row.form.state.values.city).toBe('Cairo');
  rows.remove(1); fixture.detectChanges(); expect(() => row.form.setValue('city', 'late')).toThrow('disposed'); fixture.destroy();
});
it('Angular Auto Form exposes conditional required signals and explicit date codecs', () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }); const fixture = TestBed.createComponent(Dates); fixture.detectChanges(); const element = fixture.nativeElement as HTMLElement;
  expect(element.querySelectorAll('input')).toHaveLength(1); fixture.componentInstance.form.setValue('country', 'EG'); fixture.detectChanges(); expect(element.querySelectorAll('input')).toHaveLength(2);
  expect(fixture.componentInstance.form.field('city').state().required).toBe(true);
  expect(() => angularMaterialAdapter.validateField?.({ component: 'autocomplete', label: 'Tags', multiple: true }, 'tags')).toThrow('does not support multiple'); fixture.destroy();
});
