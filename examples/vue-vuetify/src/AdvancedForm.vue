<script setup lang="ts">
import { ref } from 'vue';
import { VAutocomplete, VCombobox, VSelect, VSwitch, VRadioGroup, VRadio, VFileInput, VTextField, VTextarea, VBtn, VAlert } from 'vuetify/components';
import { defineValixaAdapter, useValixa, useValixaAdapter, useValixaState } from 'valixa-vue';
import { fileMetadata, useVuetifyField, useVuetifyFileField } from 'valixa-vuetify';
import type { FileMetadata } from 'valixa-vuetify';
import SeatCounter from './SeatCounter.vue';
import { delay } from './api.js';
type City = { id: number; title: string };
const cities: City[] = [{ id: 1, title: 'Cairo' }, { id: 2, title: 'Giza' }];
const form = useValixa({ city: { initial: null as City | null, rules: 'required' }, skills: { initial: [] as string[] }, tags: { initial: [] as (string | City)[] },
  updates: [false], plan: ['basic'], seats: [1, 'minValue:1'], budget: { initial: null as number | null }, notes: [''], uploads: { initial: [] as FileMetadata[] } });
const city = useVuetifyField(form, 'city', { kind: 'autocomplete', multiple: false, clearValue: null, returnObject: true, itemTitle: 'title', itemValue: 'id', required: true });
const skills = useVuetifyField(form, 'skills', { kind: 'select', multiple: true });
const tags = useVuetifyField(form, 'tags', { kind: 'combobox', multiple: true, returnObject: true, itemTitle: 'title', itemValue: 'id' });
const updates = useVuetifyField(form, 'updates', { kind: 'switch' }), plan = useVuetifyField(form, 'plan', { kind: 'radio' });
const budget = useVuetifyField(form, 'budget', { kind: 'number', emptyValue: null }), notes = useVuetifyField(form, 'notes', { kind: 'textarea' });
const upload = useVuetifyFileField(form, 'uploads', fileMetadata, { multiple: true }); const fileProps = upload.props;
const adapter = defineValixaAdapter<number, { value: number; inactive: boolean; issue: string | undefined; onAmount: (payload: { amount: number }) => void }>(field => ({
  value: field.state.value.value, inactive: field.state.value.disabled || field.state.value.readonly,
  issue: field.state.value.errors[0], onAmount: payload => field.setValue(payload.amount)
}));
const seats = useValixaAdapter(form, 'seats', adapter), state = useValixaState(form), message = ref('');
const submit = form.handleSubmit(async (_, { signal }) => {
  await delay(300, signal);
  // Upload bytes through upload.files.value in a real API; data.uploads contains metadata only.
  message.value = `Preferences saved. ${upload.files.value.length} local file(s).`;
});
async function onSubmit(event: Event) { message.value = ''; try { await submit(event); } catch { message.value = 'Save failed. Please retry.'; } }
function reset() { form.reset(); upload.clearLocal(); message.value = ''; }
</script>
<template>
  <form novalidate @submit="onSubmit"><h2>Workspace preferences</h2><p class="intro">Rich values, custom components, and files kept outside core.</p>
    <v-autocomplete label="Office city" :items="cities" v-bind="city" clearable auto-select-first />
    <v-select label="Skills" :items="['Vue', 'TypeScript', 'Design']" v-bind="skills" chips />
    <v-combobox label="Tags" :items="cities" v-bind="tags" chips clearable />
    <v-text-field label="Monthly budget" v-bind="budget" /><v-textarea label="Notes" v-bind="notes" rows="2" />
    <v-file-input label="Attachments" v-bind="fileProps" chips />
    <SeatCounter v-bind="seats" />
    <v-switch label="Email updates" v-bind="updates" /><v-radio-group label="Plan" v-bind="plan" inline><v-radio label="Basic" value="basic" /><v-radio label="Pro" value="pro" /></v-radio-group>
    <div class="actions"><v-btn type="submit" color="primary" :loading="state.submitting" :disabled="state.submitting">Save preferences</v-btn><v-btn type="button" variant="outlined" @click="reset">Reset</v-btn>
      <v-btn type="button" variant="text" @click="form.setReadonly(!state.readonly)">{{ state.readonly ? 'Unlock fields' : 'Lock fields' }}</v-btn></div>
    <v-alert v-if="message" type="success" role="status">{{ message }}</v-alert>
  </form>
</template>
