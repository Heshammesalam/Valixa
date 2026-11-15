<script setup lang="ts">
import { ref } from 'vue';
import { VBtn, VTextField } from 'vuetify/components';
import { useValixa, useValixaState } from 'valixa-vue';
import { useVuetifyField } from 'valixa-vuetify';
import { OrderConflict, orderDefinition, orderOptions, saveOrder } from '../../shared/order.js';
import OrderRow from './OrderRow.vue';
const form = useValixa(orderDefinition, orderOptions), state = useValixaState(form), rows = form.array('items');
const email = useVuetifyField(form, 'email', { kind: 'text' }), address = useVuetifyField(form, 'shipping.address', { kind: 'text' });
const message = ref('');
async function submit() {
  message.value = '';
  try { const result = await form.submit((values, { signal }) => saveOrder(values, signal)); message.value = result.status === 'success' ? JSON.stringify(result.data) : result.status; }
  catch (error) { if (error instanceof OrderConflict) form.setError('email', error.message); else message.value = 'Request failed. Please retry.'; }
}
</script>
<template>
  <form novalidate @submit.prevent="submit">
    <h2>Purchase order pilot</h2>
    <p>Shared Zod rules, editable rows and a simulated API. Use blocked@example.com for a server rejection, or TAKEN as an unavailable product.</p>
    <v-text-field label="Customer email" v-bind="email" />
    <label for="order-delivery">Delivery</label><select id="order-delivery" :value="state.values.delivery" @change="form.setValue('delivery', ($event.target as HTMLSelectElement).value)"><option value="pickup">Pickup</option><option value="ship">Ship</option></select>
    <v-text-field v-if="state.values.delivery === 'ship'" label="Shipping address" v-bind="address" />
    <OrderRow v-for="row in state.values.items.length ? rows.items : []" :key="row.key" :row="row" />
    <p v-for="(error, i) in state.errors.items" :key="i" role="alert">{{ error }}</p>
    <p v-for="(error, i) in state.formErrors" :key="i" role="alert">{{ error }}</p>
    <v-btn type="button" @click="rows.append({ sku: '', quantity: '1' })">Add item</v-btn>
    <v-btn type="button" :disabled="state.values.items.length < 2" @click="rows.move(0, 1)">Move first item down</v-btn>
    <v-btn type="button" :disabled="!state.values.items.length" @click="rows.remove(0)">Remove first item</v-btn>
    <v-btn type="submit" :disabled="state.submitting">Place order</v-btn>
    <v-btn type="button" @click="form.cancelSubmit(); message = 'cancelled'">Cancel order</v-btn>
    <v-btn type="button" @click="form.reset(); message = ''">Reset order</v-btn>
    <output aria-label="Order result">{{ message }}</output>
  </form>
</template>
