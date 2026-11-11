<script setup lang="ts">
import { VTextField } from 'vuetify/components';
import type { CollectionRow } from '@valixa/core';
import { useVuetifyField } from '@valixa/vuetify';
import type { AddressValues } from '../../shared/reactive.js';
const props = defineProps<{ row: CollectionRow<AddressValues> }>();
const city = useVuetifyField(props.row.form, 'city', { kind: 'text' }), confirm = useVuetifyField(props.row.form, 'confirm', { kind: 'text' });
</script>
<template><section data-testid="address-row" :data-row-key="row.key"><v-text-field label="Address city" v-bind="city" /><v-text-field label="Confirm city" v-bind="confirm" /></section></template>
