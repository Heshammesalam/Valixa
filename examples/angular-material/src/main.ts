import { bootstrapApplication } from '@angular/platform-browser';
import { provideClientHydration } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { App } from './app.js';
bootstrapApplication(App, { providers: [provideZonelessChangeDetection(), provideClientHydration()] }).catch(error => console.error(error));
