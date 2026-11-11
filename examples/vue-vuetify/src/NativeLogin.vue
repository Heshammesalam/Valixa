<script setup lang="ts">
import { ref } from 'vue';
import { nativeText, useValixa, useValixaAdapter, useValixaState } from '@valixa/vue';
import { delay } from './api.js';
const form = useValixa({ email: ['', 'required | email'], password: ['', 'required | min:8'] });
const email = useValixaAdapter(form, 'email', nativeText), password = useValixaAdapter(form, 'password', nativeText);
const state = useValixaState(form), message = ref('');
const submit = form.handleSubmit(async (_, { signal }) => { await delay(250, signal); message.value = 'Login complete.'; });
async function onSubmit(event: Event) { message.value = ''; try { await submit(event); } catch { message.value = 'Login request failed. Please retry.'; } }
function reset() { form.reset(); message.value = ''; }
</script>
<template>
  <form novalidate @submit="onSubmit"><h2>Native Vue login</h2><p class="intro">Your HTML, with Vue-native form behavior.</p>
    <div class="native"><label :for="email.id">Email</label><input v-bind="email" type="email" autocomplete="email" required />
      <span v-if="state.errors.email?.[0]" :id="email['aria-describedby']" role="alert">{{ state.errors.email[0] }}</span>
      <label :for="password.id">Password</label><input v-bind="password" type="password" autocomplete="current-password" required />
      <span v-if="state.errors.password?.[0]" :id="password['aria-describedby']" role="alert">{{ state.errors.password[0] }}</span></div>
    <div class="actions"><button type="submit" :disabled="state.submitting">{{ state.submitting ? 'Signing in…' : 'Sign in' }}</button><button type="button" @click="reset">Reset</button></div>
    <p role="status">{{ message }}</p>
  </form>
</template>
