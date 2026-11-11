<script setup lang="ts">
import { h, onScopeDispose, ref } from 'vue';
import { useValixa } from 'valixa-vue';
import { ValixaAutoForm, defineVueAutoRenderer } from 'valixa-vue/auto';
import { createVuetifyAutoAdapter } from 'valixa-vuetify/auto';
import { attachValixaDevtools } from 'valixa-devtools';
import { ValixaDevtools } from 'valixa-vue/devtools';
import { generatedSchema, generatedOptions, generatedUI, stringDate, saveGenerated } from '../../shared/generated.js';
const form = useValixa(generatedSchema, generatedOptions), result = ref('');
const adapter = createVuetifyAutoAdapter({ codecs: { civilDate: stringDate }, custom: { counter: defineVueAutoRenderer<number>(({ field, config }) => h('button', { type: 'button', 'aria-label': 'Add seat', disabled: field.state.value.disabled || field.state.value.readonly, onClick: () => field.setValue(field.state.value.value + 1) }, `${config.label}: ${field.state.value.value}`)) } });
const inspection = attachValixaDevtools(form, { name: 'Generated registration', historyLimit: 60 });
const off = form.observeEvents(() => result.value = '', { types: ['form.reset'] }); onScopeDispose(() => { off(); inspection.detach(); });
async function save(values: typeof generatedSchema.__values) { const saved = await saveGenerated(values); result.value = saved; return saved; }
</script>
<template><h2>Auto Form</h2><p>Explicit UI metadata, custom controls and local diagnostics.</p><ValixaAutoForm :form="form" :ui="generatedUI" :adapter="adapter" @submit="save" /><output aria-label="Generated result">{{ result }}</output><ValixaDevtools :inspections="[inspection]" /></template>
