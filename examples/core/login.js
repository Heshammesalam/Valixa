import { blueprint, createValixa } from '@valixa/core';

const login = blueprint({
  email: ['', 'required | email'],
  password: ['', 'required | min:8']
});
const form = createValixa(login);
const unsubscribe = form.subscribeField('email', () => {
  console.log('Email dirty:', form.getFieldState('email').dirty);
});
form.setValue('email', 'user@example.com');
const result = await form.validate();
console.log(result.valid);
console.log(result.errors);
form.setValue('password', 'a-long-password');
const submitted = await form.submit(async data => {
  console.log('Submitting account for', data.email);
  return { id: 'example-account' };
});
if (submitted.status !== 'success') throw new Error('Example submission failed');
console.log(submitted);
unsubscribe();
form.dispose();
