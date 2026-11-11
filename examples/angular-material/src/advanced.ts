import { Component, signal } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { createValixa, numberCodec } from '@valixa/angular';
import { VALIXA_MATERIAL, autocompleteCodec, dateOnlyCodec } from '@valixa/angular-material';
import { SeatCounter } from './counter.js';
import { delay } from './api.js';
type City = { id: number; title: string };
const isCity = (value: unknown): value is City => typeof value === 'object' && value !== null && 'id' in value && 'title' in value;
@Component({ selector: 'advanced-form', standalone: true, imports: [...VALIXA_MATERIAL, MatInputModule, MatFormFieldModule, MatSelectModule, MatAutocompleteModule, MatDatepickerModule, MatRadioModule, MatSlideToggleModule, MatButtonModule, SeatCounter],
  providers: [provideNativeDateAdapter()], template: `<form novalidate (submit)="onSubmit($event)"><h2>Workspace preferences</h2><p class="intro">Rich selections, civil dates, numeric values and a custom control.</p>
    <mat-form-field><mat-label>Office city</mat-label><input matInput [matAutocomplete]="auto" [valixaField]="city" [valixaCodec]="cityCodec" required><mat-autocomplete #auto="matAutocomplete" [displayWith]="displayCity">@for (option of cities; track option.id) { <mat-option [value]="option">{{ option.title }}</mat-option> }</mat-autocomplete><mat-error>{{ city.error() }}</mat-error></mat-form-field>
    <mat-form-field><mat-label>Other offices</mat-label><mat-select multiple [compareWith]="compareCity" [valixaField]="offices">@for (option of cities; track option.id) { <mat-option [value]="option">{{ option.title }}</mat-option> }</mat-select><mat-error>{{ offices.error() }}</mat-error></mat-form-field>
    <mat-form-field><mat-label>Start date</mat-label><input matInput [matDatepicker]="picker" [valixaField]="date" [valixaCodec]="dateCodec"><mat-datepicker-toggle matIconSuffix [for]="picker"/><mat-datepicker #picker/><mat-error>{{ date.error() }}</mat-error></mat-form-field>
    <mat-form-field><mat-label>Monthly budget</mat-label><input matInput type="number" [valixaField]="budget" [valixaCodec]="numeric"><mat-error>{{ budget.error() }}</mat-error></mat-form-field>
    <seat-counter [valixaField]="seats"/>
    <fieldset><legend>Plan</legend><mat-radio-group [valixaField]="plan"><mat-radio-button value="basic">Basic</mat-radio-button><mat-radio-button value="pro">Pro</mat-radio-button></mat-radio-group></fieldset>
    <mat-slide-toggle [valixaField]="updates">Email updates</mat-slide-toggle>
    <div class="actions"><button matButton="filled" type="submit" [disabled]="form.submitting() || form.state().disabled">{{ form.submitting() ? 'Saving…' : 'Save preferences' }}</button><button matButton="outlined" type="button" (click)="reset()">Reset</button>
      <button matButton type="button" (click)="form.setReadonly(!form.state().readonly)">{{ form.state().readonly ? 'Unlock fields' : 'Lock fields' }}</button>
      <button matButton type="button" (click)="form.setDisabled(!form.state().disabled)">{{ form.state().disabled ? 'Enable fields' : 'Disable fields' }}</button></div><p role="status">{{ message() }}</p>
  </form>` })
export class Advanced {
  cities: City[] = [{ id: 1, title: 'Cairo' }, { id: 2, title: 'Giza' }];
  form = createValixa({ city: { initial: null as City | null, rules: 'required' }, offices: { initial: [] as City[] }, date: { initial: null as string | null,
    validate: (value: string | null) => value !== 'invalid' || 'Choose a valid date.' }, budget: { initial: null as number | null }, seats: [1, 'minValue:1'], plan: ['basic'], updates: [false] }, { id: 'angular-advanced' });
  city = this.form.field('city'); offices = this.form.field('offices'); date = this.form.field('date'); budget = this.form.field('budget'); seats = this.form.field('seats'); plan = this.form.field('plan'); updates = this.form.field('updates');
  cityCodec = autocompleteCodec(isCity); dateCodec = dateOnlyCodec; numeric = numberCodec(null);
  displayCity = (value: City | null) => value?.title ?? ''; compareCity = (a: City, b: City) => a?.id === b?.id;
  message = signal(''); submit = this.form.handleSubmit(async (_, { signal }) => { await delay(300, signal); this.message.set('Preferences saved.'); });
  async onSubmit(event: Event) { this.message.set(''); try { await this.submit(event); } catch { this.message.set('Save failed. Please retry.'); } }
  reset() { this.form.reset(); this.message.set(''); }
}
