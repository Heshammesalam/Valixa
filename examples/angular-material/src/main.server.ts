import { bootstrapApplication, provideClientHydration } from '@angular/platform-browser';
import type { BootstrapContext } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideServerRendering, withRoutes, RenderMode } from '@angular/ssr';
import { App } from './app.js';
export default (context: BootstrapContext) => bootstrapApplication(App, { providers: [
  provideZonelessChangeDetection(), provideClientHydration(), provideServerRendering(withRoutes([{ path: '**', renderMode: RenderMode.Prerender }]))
] }, context);
