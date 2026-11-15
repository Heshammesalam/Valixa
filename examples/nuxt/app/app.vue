<script setup lang="ts">
import * as z from 'zod';
import { blueprint } from 'valixa';
import { parseStandard, standardFormValidator } from 'valixa/standard';
import { useValixa, useValixaAdapter, useValixaState, nativeText } from 'valixa-vue';
const route = useRoute();
const initialEmail = typeof route.query.email === 'string' ? route.query.email : 'nuxt@example.com';
const definition = blueprint({ email: [initialEmail] });
const schema = z.object({ email: z.email('Enter a valid email').transform(value => value.toLowerCase()) });
const form = useValixa(definition, { validateForm: standardFormValidator(schema, definition), validation: { mode: 'onChange' } });
const state = useValixaState(form), email = useValixaAdapter(form, 'email', nativeText);
const result = ref('');
async function submit() {
  try {
    const saved = await form.submit((values, { signal }) => parseStandard(schema, values, { signal }));
    result.value = saved.status === 'success' ? saved.data.email : saved.status;
  } catch { result.value = 'Request failed'; }
}
</script>
<template>
  <main><h1>Valixa with Nuxt</h1><p>Server-rendered, request-owned form with Standard Schema validation.</p>
    <form novalidate @submit.prevent="submit">
      <label :for="email.id">Email</label><input type="email" v-bind="email" />
      <span v-if="state.errors.email?.[0]" :id="email['aria-describedby']" role="alert">{{ state.errors.email[0] }}</span>
      <button type="submit" :disabled="state.submitting">Save profile</button>
      <output aria-label="Profile result">{{ result }}</output>
    </form>
  </main>
</template>
