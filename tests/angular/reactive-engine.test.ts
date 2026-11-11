// @vitest-environment jsdom
import './setup.js';
import { Component, DestroyRef, Input, inject, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, expect, it } from 'vitest';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AngularForm, bindValixa, createValixa, ValixaFieldDirective } from '@valixa/angular';
import { VALIXA_MATERIAL } from '@valixa/angular-material';
import type { CollectionRow } from '@valixa/core';
import { reactiveOptions, reactiveSchema } from '../../examples/shared/reactive.js';
import type { AddressValues } from '../../examples/shared/reactive.js';

@Component({ selector: 'test-reactive-row', standalone: true, imports: [...VALIXA_MATERIAL, MatInputModule, MatFormFieldModule], template: `<section data-testid="address-row"><mat-form-field><mat-label>Address city</mat-label><input matInput [valixaField]="form.field('city')"></mat-form-field></section>` })
class Row {
  @Input({ required: true }) row!: CollectionRow<AddressValues>;
  private destroyRef = inject(DestroyRef); form!: AngularForm<AddressValues>;
  ngOnInit() { this.form = bindValixa(this.row.form, { id: this.row.key, destroyRef: this.destroyRef }); }
}
@Component({ standalone: true, imports: [Row, ValixaFieldDirective, ...VALIXA_MATERIAL, MatInputModule, MatFormFieldModule], template: `<input [valixaField]="country">@if (city.state().visible) { <mat-form-field><mat-label>City</mat-label><input matInput [valixaField]="city"><mat-error>{{ city.error() }}</mat-error></mat-form-field> } @for (row of items(); track row.key) { <test-reactive-row [row]="row"/> }` })
class Reactive {
  form = createValixa(reactiveSchema, { ...reactiveOptions, id: 'reactive-test' }); country = this.form.field('country'); city = this.form.field('user.city');
  addresses = this.form.array('addresses'); items = signal(this.addresses.items);
  constructor() { const off = this.addresses.subscribe(() => this.items.set(this.addresses.items)); inject(DestroyRef).onDestroy(off); }
}

afterEach(() => TestBed.resetTestingModule());
it('Angular signals preserve nested value identity during validation and locale switching', async () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(Reactive); fixture.detectChanges(); const form = fixture.componentInstance.form;
  const before = form.state().values; await form.validate(); fixture.detectChanges(); expect(form.state().values).toBe(before);
  form.setLocale('ar'); fixture.detectChanges(); expect(form.state().values.user).toBe(before.user); fixture.destroy();
});
it('Angular/Material binds nested conditions and keeps borrowed row stores alive through moves', async () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(Reactive); fixture.detectChanges(); const component = fixture.componentInstance;
  expect(fixture.nativeElement.querySelector('input[matInput]')).toBeNull();
  const country = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  country.value = 'EG'; country.dispatchEvent(new Event('input')); await component.form.validate(); fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('City is required.');
  component.form.setLocale('ar'); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('المدينة مطلوب.');
  component.addresses.append({ city: 'Alex', confirm: '' }); fixture.detectChanges();
  const row = component.addresses.items[0]!, element = fixture.nativeElement.querySelector('[data-testid=address-row]');
  component.addresses.append({ city: 'Giza', confirm: '' }); component.addresses.move(0, 1); fixture.detectChanges();
  expect(fixture.nativeElement.querySelectorAll('[data-testid=address-row]')[1]).toBe(element);
  component.addresses.remove(0); fixture.detectChanges(); expect(row.form.state.values.city).toBe('Alex');
  component.addresses.remove(0); fixture.detectChanges(); expect(() => row.form.setValue('city', 'late')).toThrow('disposed');
  fixture.destroy();
});
