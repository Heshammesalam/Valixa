import { Component, signal } from '@angular/core';
import { createValixa, ValixaFieldDirective } from '@valixa/angular';
import { delay } from './api.js';
@Component({ selector: 'native-login', standalone: true, imports: [ValixaFieldDirective], template: `
  <form novalidate (submit)="onSubmit($event)"><h2>Native Angular login</h2><p class="intro">Your HTML, with signal-based form behavior.</p>
    <div class="native"><label [for]="email.id">Email</label><input type="email" [valixaField]="email" autocomplete="email" required [attr.aria-describedby]="email.error() ? email.errorId : null">
      @if (email.error()) { <span [id]="email.errorId" role="alert">{{ email.error() }}</span> }
      <label [for]="password.id">Password</label><input type="password" [valixaField]="password" autocomplete="current-password" required [attr.aria-describedby]="password.error() ? password.errorId : null">
      @if (password.error()) { <span [id]="password.errorId" role="alert">{{ password.error() }}</span> }</div>
    <div class="actions"><button type="submit" [disabled]="form.submitting()">{{ form.submitting() ? 'Signing in…' : 'Sign in' }}</button><button type="button" (click)="reset()">Reset</button></div>
    <p role="status">{{ message() }}</p>
  </form>` })
export class NativeLogin {
  form = createValixa({ email: ['', 'required | email'], password: ['', 'required | min:8'] }, { id: 'angular-login' });
  email = this.form.field('email'); password = this.form.field('password'); message = signal('');
  submit = this.form.handleSubmit(async (_, { signal }) => { await delay(250, signal); this.message.set('Login complete.'); });
  async onSubmit(event: Event) { this.message.set(''); try { await this.submit(event); } catch { this.message.set('Login request failed. Please retry.'); } }
  reset() { this.form.reset(); this.message.set(''); }
}
