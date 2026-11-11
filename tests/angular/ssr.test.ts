// @vitest-environment node
import '@angular/compiler';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideServerRendering, renderApplication } from '@angular/platform-server';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { expect, it } from 'vitest';
import { createValixa } from 'valixa-angular';
import type { AngularForm } from 'valixa-angular';
import { VALIXA_MATERIAL } from 'valixa-angular-material';

let renderedForm: AngularForm<{ email: string }> | undefined;
@Component({ selector: 'ssr-material', standalone: true, imports: [...VALIXA_MATERIAL, MatInputModule, MatFormFieldModule], template: `
  <mat-form-field><mat-label>Email</mat-label><input matInput [valixaField]="email"><mat-error [id]="email.errorId">{{ email.error() }}</mat-error></mat-form-field>` })
class SsrMaterial {
  form = createValixa({ email: ['user@example.com', 'email'] }, { id: 'ssr' }); email = this.form.field('email');
  constructor() { renderedForm = this.form; this.form.setError('email', 'Server rejected'); }
}
it('server-renders actual Material signals/errors without browser globals and disposes request ownership', async () => {
  expect(typeof window).toBe('undefined');
  const html = await renderApplication(context => bootstrapApplication(SsrMaterial, {
    providers: [provideServerRendering(), provideZonelessChangeDetection()]
  }, context), { document: '<!doctype html><html><head></head><body><ssr-material></ssr-material></body></html>', url: 'http://localhost/', allowedHosts: ['localhost'] });
  expect(html).toContain('user@example.com'); expect(html).toContain('Server rejected'); expect(html).toContain('id="ssr-email"');
  expect(() => renderedForm!.setValue('email', 'after-request')).toThrow('disposed');
});
