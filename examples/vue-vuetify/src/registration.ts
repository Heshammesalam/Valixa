import { blueprint } from '@valixa/core';
import { delay } from './api.js';
export const registration = blueprint({ name: ['', 'required | min:2'], email: ['', 'required | email'],
  username: { initial: '', rules: 'required | min:3', validate: async (value: string, { signal }) => {
    await delay(250, signal); return value !== 'taken' || 'Username is unavailable.';
  } }, password: ['', 'required | min:8'], confirm: ['', 'required | same:password'], country: ['', 'required'], terms: [false, 'required'] });
export type Registration = typeof registration.__values;
