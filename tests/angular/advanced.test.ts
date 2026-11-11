// @vitest-environment jsdom
import './setup.js';
import { Component, EventEmitter, forwardRef, inject, signal, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import type { ControlValueAccessor } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { provideNativeDateAdapter } from '@angular/material/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { afterEach, describe, expect, it } from 'vitest';
import { createValixa, numberCodec, provideValixaControl, ValixaFieldDirective } from 'valixa-angular';
import { VALIXA_MATERIAL, autocompleteCodec, dateOnlyCodec } from 'valixa-angular-material';

afterEach(() => TestBed.resetTestingModule());
type City = { id: number; title: string };
const cities: City[] = [{ id: 1, title: 'Cairo' }, { id: 2, title: 'Giza' }];
const isCity = (value: unknown): value is City => typeof value === 'object' && value !== null && 'id' in value && 'title' in value;
@Component({ standalone: true, imports: [...VALIXA_MATERIAL, MatInputModule, MatAutocompleteModule, MatDatepickerModule, MatRadioModule, MatSlideToggleModule],
  providers: [provideNativeDateAdapter()], template: `<input matInput aria-label="City" [matAutocomplete]="auto" [valixaField]="city" [valixaCodec]="cityCodec">
    <mat-autocomplete #auto="matAutocomplete" [displayWith]="display"><mat-option [value]="cities[0]">Cairo</mat-option><mat-option [value]="cities[1]">Giza</mat-option></mat-autocomplete>
    <input matInput aria-label="Date" [matDatepicker]="picker" [valixaField]="date" [valixaCodec]="dateCodec"><mat-datepicker #picker></mat-datepicker>
    <input matInput type="number" aria-label="Budget" [valixaField]="budget" [valixaCodec]="numeric">
    <mat-radio-group [valixaField]="plan"><mat-radio-button value="basic">Basic</mat-radio-button><mat-radio-button value="pro">Pro</mat-radio-button></mat-radio-group>
    <mat-slide-toggle [valixaField]="updates">Updates</mat-slide-toggle>` })
class Advanced {
  form = createValixa({ city: { initial: null as City | null, rules: 'required' }, date: { initial: null as string | null,
    validate: (value: string | null) => value !== 'invalid' || 'Invalid date' }, budget: { initial: null as number | null }, plan: ['basic'], updates: [false] }, { id: 'advanced' });
  city = this.form.field('city'); date = this.form.field('date'); budget = this.form.field('budget'); plan = this.form.field('plan'); updates = this.form.field('updates');
  cityCodec = autocompleteCodec(isCity); dateCodec = dateOnlyCodec; numeric = numberCodec(null); cities = cities;
  display = (city: City | null) => city?.title ?? '';
}
@Component({ selector: 'custom-cva', standalone: true, providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CustomCva), multi: true }],
  template: `<button [disabled]="disabled()" (click)="edit()">{{ value() }}</button>` })
class CustomCva implements ControlValueAccessor {
  value = signal(''); disabled = signal(false); change: (value: string) => void = () => {}; touched = () => {};
  writeValue(value: string) { this.value.set(value); this.change(value); } // Deliberately echoes synchronously: directive must guard circular writes.
  registerOnChange(fn: (value: string) => void) { this.change = fn; } registerOnTouched(fn: () => void) { this.touched = fn; }
  setDisabledState(value: boolean) { this.disabled.set(value); }
  edit() { this.value.set('edited'); this.change('edited'); this.touched(); }
}
@Component({ selector: 'custom-output', standalone: true,
  providers: [provideValixaControl(() => {
    const component = inject(CustomOutput);
    return { writeValue: (value: number) => component.value.set(value), setState: (status) => component.disabled.set(status.disabled || status.readonly),
      connect: (change, touched) => { const off = component.amount.subscribe(payload => { change(payload.amount); touched(); }); return () => off.unsubscribe(); } };
  })], template: `<button [disabled]="disabled()" (click)="amount.emit({amount: value()+1})">{{ value() }}</button>` })
class CustomOutput { value = signal(0); disabled = signal(false); amount = new EventEmitter<{ amount: number }>(); }
@Component({ standalone: true, imports: [ValixaFieldDirective, CustomCva, CustomOutput],
  template: `<custom-cva [valixaField]="text"/><custom-output [valixaField]="count"/>` })
class Customs { form = createValixa({ text: ['start'], count: [1] }, { id: 'custom' }); text = this.form.field('text'); count = this.form.field('count'); }
@Component({ standalone: true, imports: [...VALIXA_MATERIAL, MatRadioModule], template: `
  <mat-radio-group [valixaField]="first"><mat-radio-button value="basic">First Basic</mat-radio-button><mat-radio-button value="pro">First Pro</mat-radio-button></mat-radio-group>
  <mat-radio-group [valixaField]="second"><mat-radio-button value="basic">Second Basic</mat-radio-button><mat-radio-button value="pro">Second Pro</mat-radio-button></mat-radio-group>` })
class SeparateRadioForms {
  one = createValixa({ plan: ['basic'] }, { id: 'radio-one' }); two = createValixa({ plan: ['basic'] }, { id: 'radio-two' });
  first = this.one.field('plan'); second = this.two.field('plan');
}

describe('advanced Material controls and explicit custom adapters', () => {
  it('keeps identically named radio fields in separate forms independent', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }); const fixture = TestBed.createComponent(SeparateRadioForms); fixture.detectChanges();
    const radios = fixture.nativeElement.querySelectorAll('input[type=radio]') as NodeListOf<HTMLInputElement>;
    expect(radios[0]!.name).not.toBe(radios[2]!.name); radios[1]!.click(); fixture.detectChanges();
    expect(radios[2]!.checked).toBe(true); expect(fixture.componentInstance.second.value()).toBe('basic'); expect(fixture.componentInstance.first.value()).toBe('pro');
  });
  it('distinguishes object selection from search drafts without erasing draft text', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }); const fixture = TestBed.createComponent(Advanced);
    fixture.detectChanges(); await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input[aria-label=City]') as HTMLInputElement;
    input.focus(); input.value = 'Cai'; input.dispatchEvent(new Event('input')); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.componentInstance.city.value()).toBeNull(); expect(input.value).toBe('Cai');
    const overlay = TestBed.inject(OverlayContainer).getContainerElement(); (overlay.querySelector('mat-option') as HTMLElement).click(); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.componentInstance.city.value()).toEqual(cities[0]);
    input.value = 'Other'; input.dispatchEvent(new Event('input')); fixture.detectChanges(); expect(fixture.componentInstance.city.value()).toBeNull(); expect(input.value).toBe('Other');
  });
  it('encodes native dates and invalid drafts, numbers, radio and slide-toggle values', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }); const fixture = TestBed.createComponent(Advanced); fixture.detectChanges(); await fixture.whenStable();
    const date = fixture.nativeElement.querySelector('input[aria-label=Date]') as HTMLInputElement;
    date.value = '11/8/2026'; date.dispatchEvent(new Event('input')); fixture.detectChanges(); expect(fixture.componentInstance.date.value()).toBe('2026-11-08');
    date.value = 'not a date'; date.dispatchEvent(new Event('input')); fixture.detectChanges(); expect(fixture.componentInstance.date.value()).toBe('invalid');
    expect((await fixture.componentInstance.form.validate()).errors.date).toEqual(['Invalid date']);
    const number = fixture.nativeElement.querySelector('input[type=number]') as HTMLInputElement; number.value = '25.5'; number.dispatchEvent(new Event('input')); expect(fixture.componentInstance.budget.value()).toBe(25.5);
    const radios = fixture.nativeElement.querySelectorAll('input[type=radio]'); expect((radios[0] as HTMLInputElement).checked).toBe(true); (radios[1] as HTMLInputElement).click();
    (fixture.nativeElement.querySelector('button[role=switch]') as HTMLElement).click(); fixture.detectChanges();
    expect(fixture.componentInstance.plan.value()).toBe('pro'); expect(fixture.componentInstance.updates.value()).toBe(true);
    fixture.componentInstance.form.reset(); fixture.detectChanges(); expect(number.value).toBe('');
  });
  it('consumes custom CVAs and explicit payload adapters without write loops', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }); const fixture = TestBed.createComponent(Customs); fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button'); (buttons[0] as HTMLElement).click(); (buttons[1] as HTMLElement).click(); fixture.detectChanges();
    expect(fixture.componentInstance.text.value()).toBe('edited'); expect(fixture.componentInstance.count.value()).toBe(2);
    expect(buttons[1].textContent).toContain('2');
    expect(fixture.componentInstance.count.state().touched).toBe(true);
    fixture.componentInstance.form.setValue('text', 'programmatic'); fixture.detectChanges(); expect(buttons[0].textContent).toContain('programmatic');
    fixture.componentInstance.form.setReadonly(true); fixture.detectChanges(); expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
  });
});
