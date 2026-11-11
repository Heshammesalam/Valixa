// @vitest-environment jsdom
import './setup.js';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { createValixa } from '@valixa/core';
import { attachValixaDevtools } from '@valixa/devtools';
import { ValixaDevtools } from '@valixa/angular-devtools';

@Component({ standalone: true, imports: [ValixaDevtools], template: '<valixa-devtools [inspections]="[inspection]"/>' })
class Host {
  form = createValixa({ password: ['private'], name: ['Ada'] });
  inspection = attachValixaDevtools(this.form);
}
it('Angular panel mounts after render, updates with signals and releases borrowed inspection on destroy', async () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }); const fixture = TestBed.createComponent(Host);
  const inspection = fixture.componentInstance.inspection, original = inspection.subscribe, release = vi.fn();
  vi.spyOn(inspection, 'subscribe').mockImplementation(listener => { const off = original(listener); return () => { release(); off(); }; });
  fixture.detectChanges(); await fixture.whenStable(); expect(fixture.nativeElement.textContent).toContain('Valixa DevTools'); expect(fixture.nativeElement.textContent).not.toContain('private');
  fixture.componentInstance.form.setValue('name', 'Grace'); await fixture.whenStable(); expect(fixture.nativeElement.textContent).toContain('field.changed');
  fixture.destroy(); expect(release).toHaveBeenCalled(); expect(inspection.getSnapshot().status).toBe('attached'); inspection.detach(); TestBed.resetTestingModule();
});
