import { Component, signal } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { createValixa } from '@valixa/angular';
import { VALIXA_MATERIAL } from '@valixa/angular-material';
import { delay } from './api.js';

@Component({ selector: 'registration-form', standalone: true, imports: [...VALIXA_MATERIAL, MatInputModule, MatFormFieldModule, MatSelectModule, MatCheckboxModule, MatButtonModule],
  template: `<form novalidate (submit)="onSubmit($event)"><h2>Create your account</h2><p class="intro">Username “taken” and email “used@example.com” demonstrate async and server validation.</p>
    <mat-form-field><mat-label>Name</mat-label><input matInput [valixaField]="name" required><mat-error>{{ name.error() }}</mat-error></mat-form-field>
    <mat-form-field><mat-label>Email</mat-label><input matInput type="email" [valixaField]="email" required><mat-error>{{ email.error() }}</mat-error></mat-form-field>
    <mat-form-field><mat-label>Username</mat-label><input matInput [valixaField]="username" required><mat-error>{{ username.error() }}</mat-error></mat-form-field>
    <mat-form-field><mat-label>Password</mat-label><input matInput type="password" [valixaField]="password" required><mat-error>{{ password.error() }}</mat-error></mat-form-field>
    <mat-form-field><mat-label>Confirm password</mat-label><input matInput type="password" [valixaField]="confirm" required><mat-error>{{ confirm.error() }}</mat-error></mat-form-field>
    <mat-form-field><mat-label>Country</mat-label><mat-select [valixaField]="country" required><mat-option value="EG">Egypt</mat-option><mat-option value="US">United States</mat-option></mat-select><mat-error>{{ country.error() }}</mat-error></mat-form-field>
    <mat-checkbox [valixaField]="terms" required>I agree to the terms</mat-checkbox>
    @if (terms.error()) { <mat-error [id]="terms.errorId">{{ terms.error() }}</mat-error> }
    <div class="actions"><button matButton="filled" type="submit" [disabled]="form.submitting()">{{ form.submitting() ? 'Creating account…' : 'Create account' }}</button></div><p role="status">{{ message() }}</p>
  </form>` })
export class Registration {
  form = createValixa({ name: ['', 'required | min:2'], email: ['', 'required | email'], username: { initial: '', rules: 'required | min:3', validate: async (value: string, { signal }) => {
    await delay(250, signal); return value !== 'taken' || 'Username is unavailable.';
  } }, password: ['', 'required | min:8'], confirm: ['', 'required | same:password'], country: ['', 'required'], terms: [false, 'required'] }, { id: 'angular-register', validateOn: 'blur' });
  name = this.form.field('name'); email = this.form.field('email'); username = this.form.field('username'); password = this.form.field('password'); confirm = this.form.field('confirm'); country = this.form.field('country'); terms = this.form.field('terms');
  message = signal(''); submit = this.form.handleSubmit(async (data, { signal }) => {
    await delay(300, signal); if (data.email === 'used@example.com') { this.form.setError('email', 'Email is already registered.'); throw new Error('422'); } this.message.set('Account created.');
  });
  async onSubmit(event: Event) { this.message.set(''); try { await this.submit(event); } catch { this.message.set('Could not register. Review the field errors.'); } }
}
