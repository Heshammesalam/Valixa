<script setup lang="ts">
defineProps<{ value: number; inactive: boolean; issue: string | undefined }>();
const emit = defineEmits<{ amount: [payload: { amount: number }] }>();
</script>
<template><div><p>Seats: {{ value }}</p><button type="button" :disabled="inactive" :aria-invalid="Boolean(issue)" @click="emit('amount', {amount: value + 1})">Add seat</button><p v-if="issue">{{ issue }}</p></div></template>
