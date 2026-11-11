// @vitest-environment jsdom
import './setup.js';
import { ChangeDetectionStrategy, Component, Input, signal, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createValixa, ValixaFieldDirective } from 'valixa-angular';
import type { AngularField } from 'valixa-angular';

afterEach(() => TestBed.resetTestingModule());
@Component({ selector: 'counted-field', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, template: `<output>{{ render() }}</output>` })
class CountedField { @Input({ required: true }) field!: AngularField<string>; renders = 0; render() { this.renders++; return this.field.value(); } }
@Component({ standalone: true, imports: [CountedField], template: `<counted-field [field]="email"/><counted-field [field]="password"/>` })
class Isolated { form = createValixa({ email: [''], password: [''] }, { id: 'renders' }); email = this.form.field('email'); password = this.form.field('password'); }
@Component({ standalone: true, imports: [FormsModule, ValixaFieldDirective], template: `<input [valixaField]="name" [(ngModel)]="value">` })
class Conflicting { form = createValixa({ name: [''] }, { id: 'conflict' }); name = this.form.field('name'); value = ''; }
@Component({ standalone: true, imports: [ValixaFieldDirective], template: `@if (visible()) { <input [valixaField]="name"> }` })
class ConditionalField { form = createValixa({ name: ['start'] }, { id: 'conditional' }); name = this.form.field('name'); visible = signal(true); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { resolve, promise }; }

describe('Angular ownership, reactivity and requests', () => {
  it('cleans directive listeners when its view disappears without disposing the owner', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }); const fixture = TestBed.createComponent(ConditionalField); fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    fixture.componentInstance.visible.set(false); fixture.detectChanges(); input.value = 'detached'; input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.name.value()).toBe('start'); fixture.componentInstance.form.setValue('name', 'alive');
    expect(fixture.componentInstance.name.value()).toBe('alive');
  });
  it('does not rerender an unrelated OnPush field', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }); const fixture = TestBed.createComponent(Isolated); fixture.detectChanges(); await fixture.whenStable();
    const children = fixture.debugElement.children.map(child => child.componentInstance as CountedField); const previous = children[1]!.renders;
    fixture.componentInstance.form.setValue('email', 'Ada'); await fixture.whenStable();
    expect(children[1]!.renders).toBe(previous); expect(fixture.nativeElement.textContent).toContain('Ada');
  });
  it('rejects competing Angular Forms ownership', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    expect(() => TestBed.createComponent(Conflicting).detectChanges()).toThrow('Do not combine valixaField');
  });
  it('preserves async race protection and aborts signals at DestroyRef cleanup', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }); const old = deferred<boolean>(); let signal!: AbortSignal;
    const form = TestBed.runInInjectionContext(() => createValixa({ name: { initial: 'old', validate: (value: string, context) => {
      if (value === 'old') { signal = context.signal; return old.promise; } return true;
    } } }, { id: 'async' }));
    const first = form.validate(); expect(form.validating()).toBe(true); form.setValue('name', 'new'); expect(signal.aborted).toBe(true);
    await form.validate(); old.resolve(false); expect((await first).stale).toBe(true); expect(form.field('name').error()).toBeUndefined();
    const pending = deferred<void>(); let requestSignal!: AbortSignal; const request = form.submit((_, context) => { requestSignal = context.signal; return pending.promise; });
    await vi.waitFor(() => expect(requestSignal).toBeDefined()); TestBed.resetTestingModule(); expect(requestSignal.aborted).toBe(true);
    pending.resolve(); expect((await request).status).toBe('cancelled');
  });
  it('exposes loading, duplicate protection, errors, success and reset', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const form = TestBed.runInInjectionContext(() => createValixa({ name: ['Ada', 'required'] }, { id: 'submit' }));
    const pending = deferred<string>(); const submission = form.submit(() => pending.promise); await vi.waitFor(() => expect(form.validating()).toBe(false));
    expect(form.submitting()).toBe(true); expect((await form.submit(() => 'duplicate')).status).toBe('busy'); pending.resolve('ok'); expect((await submission).status).toBe('success');
    await expect(form.submit(() => { form.setError('name', 'Server rejected'); throw new Error('422'); })).rejects.toThrow('422');
    expect(form.field('name').error()).toBe('Server rejected'); expect(form.submitting()).toBe(false);
    form.reset(); expect(form.submitCount()).toBe(0); expect(form.field('name').error()).toBeUndefined();
  });
});
