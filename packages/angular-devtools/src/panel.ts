import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input } from '@angular/core';
import type { ValixaInspection } from '@valixa/devtools';
import { mountValixaDevtools } from '@valixa/devtools/panel';
import type { DevtoolsPanel } from '@valixa/devtools/panel';

@Component({ selector: 'valixa-devtools', standalone: true, template: '' })
export class ValixaDevtools {
  readonly inspections = input.required<readonly ValixaInspection[]>();
  private readonly host = inject(ElementRef<HTMLElement>); private panel: DevtoolsPanel | undefined;
  constructor() {
    afterNextRender(() => { this.panel = mountValixaDevtools(this.host.nativeElement, this.inspections()); });
    effect(() => { const inspections = this.inspections(); this.panel?.update(inspections); });
    inject(DestroyRef).onDestroy(() => this.panel?.destroy());
  }
}
