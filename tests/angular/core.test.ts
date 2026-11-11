// @vitest-environment jsdom
import './setup.js';
import { Component, DestroyRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createValixa, ValixaFieldDirective } from 'valixa-angular';
import type { AngularForm } from 'valixa-angular';

afterEach(() => TestBed.resetTestingModule());
@Component({ standalone: true, imports: [ValixaFieldDirective], template: `<input aria-label="Name" [valixaField]="name"><span>{{ name.error() }}</span><output>{{ form.submitting() }}</output>` })
class NativeForm {
  form = createValixa({ name: ['', 'required'] }, { id: 'native' });
  name = this.form.field('name');
}
@Component({ standalone: true, imports: [ValixaFieldDirective], template: `<input type="number" [valixaField]="age">` })
class MissingNumericCodec { form = createValixa({ age: [18] }, { id: 'numeric-required' }); age = this.form.field('age'); }
@Component({ standalone: true, imports: [ValixaFieldDirective], template: `
  <label><input type="radio" value="basic" [valixaField]="plan">Basic</label><label><input type="radio" value="pro" [valixaField]="plan">Pro</label>
  <input type="checkbox" [valixaField]="agree"><select multiple [valixaField]="tags"><option value="a">A</option><option value="b">B</option></select>` })
class NativeChoices {
  form = createValixa({ plan: ['basic'], agree: [false], tags: { initial: [] as string[] } }, { id: 'choices' });
  plan = this.form.field('plan'); agree = this.form.field('agree'); tags = this.form.field('tags');
}
describe('Angular signal ownership and native directive', () => {
  it('binds native checked controls and multiple selections with unique radio option IDs', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }); const fixture = TestBed.createComponent(NativeChoices); fixture.detectChanges();
    const radios = fixture.nativeElement.querySelectorAll('input[type=radio]') as NodeListOf<HTMLInputElement>;
    expect(radios[0]!.checked).toBe(true); expect(radios[0]!.id).not.toBe(radios[1]!.id);
    radios[1]!.click(); (fixture.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement).click();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement; select.options[0]!.selected = true; select.options[1]!.selected = true; select.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(fixture.componentInstance.form.state().values).toEqual({ plan: 'pro', agree: true, tags: ['a', 'b'] });
    fixture.componentInstance.form.reset(); fixture.detectChanges(); expect(select.selectedOptions).toHaveLength(0);
  });
  it('requires an explicit codec for native numeric values', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    expect(() => TestBed.createComponent(MissingNumericCodec).detectChanges()).toThrow('explicit valixaCodec');
  });
  it('initializes cached signals and isolates field updates', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const form = TestBed.runInInjectionContext(() => createValixa({ email: [''], password: [''] }, { id: 'isolated' }));
    const subscribe = vi.spyOn(form.core, 'subscribeField');
    const email = form.field('email'), password = form.field('password');
    expect(form.field('email')).toBe(email); expect(subscribe).toHaveBeenCalledTimes(2);
    const previous = password.state(); form.setValue('email', 'Ada');
    expect(email.value()).toBe('Ada'); expect(password.state()).toBe(previous); expect(form.state().dirty).toBe(true);
  });
  it('writes native values, touches on blur and displays validation errors through signals', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(NativeForm); fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe(''); expect(input.id).toBe('native-name');
    input.dispatchEvent(new Event('blur')); expect(fixture.componentInstance.name.state().touched).toBe(true);
    await fixture.componentInstance.form.validate(); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('name is required.');
    input.value = 'Ada'; input.dispatchEvent(new Event('input')); fixture.detectChanges(); expect(fixture.componentInstance.name.value()).toBe('Ada');
    fixture.componentInstance.form.reset(); fixture.detectChanges(); expect(input.value).toBe('');
  });
  it('reflects flags and releases owned forms on component destruction', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(NativeForm); fixture.detectChanges(); const form = fixture.componentInstance.form;
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    form.setReadonly(true); fixture.detectChanges(); expect(input.readOnly).toBe(true);
    input.value = 'blocked'; input.dispatchEvent(new Event('input')); expect(form.state().values.name).toBe(''); expect(input.value).toBe('');
    form.setDisabled(true); fixture.detectChanges(); expect(input.disabled).toBe(true);
    fixture.destroy(); expect(() => form.setValue('name', 'disposed')).toThrow('disposed');
  });
  it('supports explicit lifecycle ownership outside injection context and rejects missing context', () => {
    expect(() => createValixa({ name: [''] })).toThrow();
    let cleanup!: () => void;
    const destroy = { destroyed: false, onDestroy: (callback: () => void) => { cleanup = callback; return () => {}; } } satisfies DestroyRef;
    const form = createValixa({ name: ['Ada'] }, { id: 'explicit', destroyRef: destroy });
    expect(form.field('name').value()).toBe('Ada'); cleanup(); expect(() => form.reset()).toThrow('disposed');
  });
});
