<script setup lang="ts">
import { ref } from 'vue';
import { VBtn, VTextField } from 'vuetify/components';
import { nativeText, useValixa, useValixaAdapter, useValixaState } from 'valixa-vue';
import { useVuetifyField } from 'valixa-vuetify';
import { reactiveOptions, reactiveSchema } from '../../shared/reactive.js';
import AddressRow from './ReactiveRow.vue';
const form = useValixa(reactiveSchema, reactiveOptions), state = useValixaState(form);
const country = useValixaAdapter(form, 'country', nativeText), city = useVuetifyField(form, 'user.city', { kind: 'text' });
const addresses = form.array('addresses'), result = ref('');
const save = form.handleSubmit(values => { result.value = JSON.stringify(values); });
</script>
<template>
  <form novalidate @submit="event => { void save(event).catch(() => result = 'Request failed'); }">
    <h2>Reactive engine</h2><p>Conditional nested fields, row identity and live message localization.</p>
    <label :for="country.id">Country code</label><input v-bind="country" />
    <v-text-field v-if="form.getFieldState('user.city').visible" label="City" v-bind="city" />
    <AddressRow v-for="row in state.values.addresses.length ? addresses.items : []" :key="row.key" :row="row" />
    <v-btn type="button" @click="addresses.append({ city: '', confirm: '' })">Add address</v-btn>
    <v-btn type="button" :disabled="state.values.addresses.length < 2" @click="addresses.move(0, 1)">Move first down</v-btn>
    <v-btn type="button" :disabled="!state.values.addresses.length" @click="addresses.remove(0)">Remove first</v-btn>
    <v-btn type="button" @click="form.setLocale(state.locale === 'en' ? 'ar' : 'en')">Switch language</v-btn>
    <v-btn type="submit">Save reactive</v-btn><v-btn type="button" @click="form.reset(); result = ''">Reset reactive</v-btn>
    <output aria-label="Reactive result">{{ result }}</output>
  </form>
</template>
