import { Generated } from './generated.js';
import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { NativeLogin } from './native.js';
import { Registration } from './registration.js';
import { Advanced } from './advanced.js';
import { Reactive } from './reactive.js';
@Component({ selector: 'app-root', standalone: true, imports: [NativeLogin, Registration, Advanced, Reactive, Generated, MatButtonModule], template: `
  <main><header><span class="eyebrow">HEADLESS FORMS · ANGULAR + MATERIAL</span><h1>Valixa</h1><p>Your interface. One form engine.</p></header>
    <nav aria-label="Examples"><button matButton [attr.aria-pressed]="page() === 'native'" (click)="page.set('native')">Native Angular</button><button matButton [attr.aria-pressed]="page() === 'registration'" (click)="page.set('registration')">Registration</button><button matButton [attr.aria-pressed]="page() === 'advanced'" (click)="page.set('advanced')">Advanced</button><button matButton [attr.aria-pressed]="page() === 'reactive'" (click)="page.set('reactive')">Reactive engine</button><button matButton (click)="page.set('auto')">Auto Form</button></nav>
    <section class="card">@switch (page()) { @case ('auto') { <generated-form/> } @case ('native') { <native-login/> } @case ('registration') { <registration-form/> } @case ('advanced') { <advanced-form/> } @case ('reactive') { <reactive-form/> } }</section>
    <footer>Examples use a local simulated API. No data leaves this page.</footer>
  </main>` })
export class App { page = signal<'native' | 'registration' | 'advanced' | 'reactive' | 'auto'>('native'); }
