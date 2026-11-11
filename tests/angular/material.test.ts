// @vitest-environment jsdom
import './setup.js';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { OverlayContainer } from '@angular/cdk/overlay';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createValixa } from 'valixa-angular';
import { VALIXA_MATERIAL } from 'valixa-angular-material';

afterEach(() => TestBed.resetTestingModule());
@Component({ standalone: true, imports: [...VALIXA_MATERIAL, MatInputModule, MatFormFieldModule],
  template: `<form novalidate (submit)="onSubmit($event)"><mat-form-field><mat-label>Email</mat-label><input matInput [valixaField]="email" required><mat-error>{{ email.error() }}</mat-error></mat-form-field><button type="submit" [disabled]="form.submitting()">Save</button></form>` })
class Login {
  form = createValixa({ email: ['', 'required | email'] }, { id: 'material' }); email = this.form.field('email');
  save = vi.fn(async (data: { email: string }) => data.email); submit = this.form.handleSubmit(this.save);
  onSubmit(event: Event) { return this.submit(event); }
}
@Component({ standalone: true, imports: [...VALIXA_MATERIAL, MatFormFieldModule, MatSelectModule, MatCheckboxModule],
  template: `<mat-form-field><mat-label>Country</mat-label><mat-select [valixaField]="country"><mat-option value="EG">Egypt</mat-option><mat-option value="US">US</mat-option></mat-select><mat-error>{{ country.error() }}</mat-error></mat-form-field>
    <mat-checkbox [valixaField]="terms">Agree</mat-checkbox><mat-error [id]="terms.errorId">{{ terms.error() }}</mat-error>` })
class Preferences {
  form = createValixa({ country: ['', 'required'], terms: [false, 'required'] }, { id: 'preferences' });
  country = this.form.field('country'); terms = this.form.field('terms');
}
describe('Angular → Material input vertical slice', () => {
  it('shows MatError without Angular Forms, updates ARIA, and awaits validated submission', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(Login); fixture.detectChanges();
    const form = fixture.componentInstance; const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    await form.onSubmit(new Event('submit')); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('email is required.'); expect(input.getAttribute('aria-invalid')).toBe('true');
    const error = fixture.nativeElement.querySelector('mat-error'); expect(input.getAttribute('aria-describedby')).toContain(error.id);
    expect(fixture.nativeElement.querySelector('label').getAttribute('for')).toBe(input.id);
    input.value = 'user@example.com'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    await form.onSubmit(new Event('submit')); fixture.detectChanges(); expect(form.save).toHaveBeenCalledOnce(); expect(form.form.state().submitted).toBe(true);
  });
});

describe('Material select and checked CVAs', () => {
  it('selects through the actual overlay, checks values and resets without FormControls', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(Preferences); fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('mat-select') as HTMLElement;
    select.click(); fixture.detectChanges(); await fixture.whenStable();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    (overlay.querySelector('mat-option') as HTMLElement).click(); fixture.detectChanges();
    expect(fixture.componentInstance.country.value()).toBe('EG');
    const checkbox = fixture.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement;
    checkbox.click(); fixture.detectChanges(); expect(fixture.componentInstance.terms.value()).toBe(true);
    fixture.componentInstance.form.reset(); fixture.detectChanges(); expect(checkbox.checked).toBe(false);
    expect(select.textContent).not.toContain('Egypt');
  });
  it('presents manual errors and maps readonly to disabled for controls without readonly', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(Preferences); fixture.detectChanges(); const form = fixture.componentInstance.form;
    await form.validate(); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('country is required.');
    const select = fixture.nativeElement.querySelector('mat-select') as HTMLElement;
    expect(select.getAttribute('aria-invalid')).toBe('true');
    const checkbox = fixture.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement;
    expect(checkbox.getAttribute('aria-describedby')).toBe(fixture.componentInstance.terms.errorId);
    form.setReadonly(true); fixture.detectChanges(); expect(checkbox.disabled).toBe(true); expect(select.getAttribute('aria-disabled')).toBe('true');
    form.setValue('country', 'US'); fixture.detectChanges(); expect(fixture.componentInstance.country.value()).toBe('US');
  });
});
