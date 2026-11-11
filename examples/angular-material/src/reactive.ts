import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { AngularForm, bindValixa, createValixa, ValixaFieldDirective } from '@valixa/angular';
import { VALIXA_MATERIAL } from '@valixa/angular-material';
import type { CollectionRow } from '@valixa/core';
import { reactiveOptions, reactiveSchema } from '../../shared/reactive.js';
import type { AddressValues } from '../../shared/reactive.js';

@Component({ selector: 'reactive-address', standalone: true, imports: [MatInputModule, MatFormFieldModule, ...VALIXA_MATERIAL], template: `
  <section data-testid="address-row" [attr.data-row-key]="row().key">
    <mat-form-field><mat-label>Address city</mat-label><input matInput [valixaField]="form.field('city')"><mat-error>{{ form.error('city') }}</mat-error></mat-form-field>
    <mat-form-field><mat-label>Confirm city</mat-label><input matInput [valixaField]="form.field('confirm')"><mat-error>{{ form.error('confirm') }}</mat-error></mat-form-field>
  </section>` })
export class ReactiveAddress {
  readonly row = input.required<CollectionRow<AddressValues>>();
  private readonly destroyRef = inject(DestroyRef);
  form!: AngularForm<AddressValues>;
  ngOnInit(): void { this.form = bindValixa(this.row().form, { id: `address-${this.row().key}`, destroyRef: this.destroyRef }); }
}
@Component({ selector: 'reactive-form', standalone: true, imports: [ReactiveAddress, MatInputModule, MatFormFieldModule, MatButtonModule, ValixaFieldDirective, ...VALIXA_MATERIAL], template: `
  <form novalidate (submit)="save($event)"><h2>Reactive engine</h2><p>Conditional nested fields, row identity and live message localization.</p>
    <label [for]="country.id">Country code</label><input [valixaField]="country">
    @if (city.state().visible) { <mat-form-field><mat-label>City</mat-label><input matInput [valixaField]="city"><mat-error>{{ city.error() }}</mat-error></mat-form-field> }
    @for (row of items(); track row.key) { <reactive-address [row]="row"/> }
    <button matButton type="button" (click)="addresses.append({ city: '', confirm: '' })">Add address</button>
    <button matButton type="button" [disabled]="items().length < 2" (click)="addresses.move(0, 1)">Move first down</button>
    <button matButton type="button" [disabled]="!items().length" (click)="addresses.remove(0)">Remove first</button>
    <button matButton type="button" (click)="form.setLocale(form.state().locale === 'en' ? 'ar' : 'en')">Switch language</button>
    <button matButton type="submit">Save reactive</button><button matButton type="button" (click)="form.reset(); result.set('')">Reset reactive</button>
    <output aria-label="Reactive result">{{ result() }}</output>
  </form>` })
export class Reactive {
  readonly form = createValixa(reactiveSchema, { ...reactiveOptions, id: 'angular-reactive' });
  readonly country = this.form.field('country'); readonly city = this.form.field('user.city');
  readonly addresses = this.form.array('addresses'); readonly items = signal(this.addresses.items); readonly result = signal('');
  constructor() { const off = this.addresses.subscribe(() => this.items.set(this.addresses.items)); inject(DestroyRef).onDestroy(off); }
  save(event: Event): void { event.preventDefault(); void this.form.submit(values => this.result.set(JSON.stringify(values))).catch(() => this.result.set('Request failed')); }
}
