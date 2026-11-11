<script setup lang="ts">
import { ref } from 'vue';
import { VSelect, VCheckbox, VBtn, VAlert } from 'vuetify/components';
import { useValixa, useValixaState } from 'valixa-vue';
import { useVuetifyField } from 'valixa-vuetify';
import { registration } from './registration.js';
import RegistrationText from './RegistrationText.vue';
import { delay } from './api.js';
const form = useValixa(registration, { validateOn: 'blur' });
const state = useValixaState(form), message = ref('');
const country = useVuetifyField(form, 'country', { kind: 'select', multiple: false, clearValue: '', required: true });
const terms = useVuetifyField(form, 'terms', { kind: 'checkbox', required: true });
const submit = form.handleSubmit(async (data, { signal }) => {
  await delay(300, signal);
  if (data.email === 'used@example.com') { form.setError('email', 'Email is already registered.'); throw new Error('422'); }
  message.value = 'Account created.';
});
async function onSubmit(event: Event) { message.value = ''; try { await submit(event); } catch { message.value = 'Could not register. Review the field errors.'; } }
</script>
<template>
  <form novalidate @submit="onSubmit"><h2>Create your account</h2><p class="intro">Try username “taken” or email “used@example.com” to see validation and server errors.</p>
    <RegistrationText :form="form" name="name" label="Name" /><RegistrationText :form="form" name="email" label="Email" type="email" />
    <RegistrationText :form="form" name="username" label="Username" /><RegistrationText :form="form" name="password" label="Password" type="password" />
    <RegistrationText :form="form" name="confirm" label="Confirm password" type="password" />
    <v-select label="Country" :items="['Egypt', 'United States']" v-bind="country" /><v-checkbox label="I agree to the terms" v-bind="terms" />
    <div class="actions"><v-btn type="submit" color="primary" :loading="state.submitting" :disabled="state.submitting">Create account</v-btn></div>
    <v-alert v-if="message" :type="state.submitted ? 'success' : 'error'" role="status">{{ message }}</v-alert>
  </form>
</template>
