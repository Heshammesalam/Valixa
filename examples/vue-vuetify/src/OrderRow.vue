<script setup lang="ts">
import { VTextField } from 'vuetify/components';
import type { CollectionRow } from 'valixa';
import { useVuetifyField } from 'valixa-vuetify';
import { useValixaState } from 'valixa-vue';
import { orderRow } from '../../shared/order.js';
const props = defineProps<{ row: CollectionRow<typeof orderRow.__values> }>();
const state = useValixaState(props.row.form);
const sku = useVuetifyField(props.row.form, 'sku', { kind: 'text' });
const quantity = useVuetifyField(props.row.form, 'quantity', { kind: 'text' });
</script>
<template><section data-testid="order-row" :data-row-key="row.key"><v-text-field label="Product code" v-bind="sku" /><v-text-field label="Quantity" v-bind="quantity" /><span v-if="state.pending" role="status" aria-label="Product availability">Checking product…</span></section></template>
