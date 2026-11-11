<script setup lang="ts">
import { VTextField } from 'vuetify/components';
import { useVuetifyField } from '@valixa/vuetify';
import type { ValixaForm } from '@valixa/core';
import type { Registration } from './registration.js';
const props = defineProps<{ form: ValixaForm<Registration>; name: 'name' | 'email' | 'username' | 'password' | 'confirm'; label: string; type?: string }>();
const field = useVuetifyField(props.form, props.name, { kind: 'text', required: true });
</script>
<template><v-text-field :label="label" :type="type || 'text'" v-bind="field" /></template>
