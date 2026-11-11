<script setup lang="ts">
import GeneratedForm from './GeneratedForm.vue';
import { ref } from 'vue';
import { VApp, VMain, VContainer, VChip, VBtn, VCard } from 'vuetify/components';
import NativeLogin from './NativeLogin.vue';
import RegistrationForm from './RegistrationForm.vue';
import AdvancedForm from './AdvancedForm.vue';
import ReactiveForm from './ReactiveForm.vue';
const page = ref<'native' | 'registration' | 'advanced' | 'reactive' | 'auto'>('native');
</script>
<template>
  <v-app><v-main><v-container class="page">
    <header><v-chip size="small" variant="outlined">HEADLESS FORMS · VUE + VUETIFY</v-chip><h1>Valixa</h1><p>Your interface. One form engine.</p></header>
    <nav aria-label="Examples"><v-btn :variant="page === 'native' ? 'flat' : 'outlined'" color="primary" @click="page = 'native'">Native Vue</v-btn>
      <v-btn :variant="page === 'registration' ? 'flat' : 'outlined'" color="primary" @click="page = 'registration'">Registration</v-btn>
      <v-btn :variant="page === 'advanced' ? 'flat' : 'outlined'" color="primary" @click="page = 'advanced'">Advanced</v-btn>
      <v-btn :variant="page === 'reactive' ? 'flat' : 'outlined'" color="primary" @click="page = 'reactive'">Reactive engine</v-btn><v-btn variant="outlined" color="primary" @click="page = 'auto'">Auto Form</v-btn></nav>
    <v-card variant="outlined" class="form-card"><GeneratedForm v-if="page === 'auto'" /><NativeLogin v-else-if="page === 'native'" /><RegistrationForm v-else-if="page === 'registration'" /><ReactiveForm v-else-if="page === 'reactive'" /><AdvancedForm v-else /></v-card>
    <footer>Examples use a local simulated API. No data leaves this page.</footer>
  </v-container></v-main></v-app>
</template>
<style>
body { font-family: Inter, system-ui, sans-serif; }
.page { max-width: 680px; padding: 48px 24px; }
header h1 { font-size: 52px; letter-spacing: -.04em; margin: 14px 0 0; }
header p, footer, .intro { color: #52615a; }
nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 28px 0; }
.form-card { padding: 28px; background: white; border-color: #d2dbd4 !important; border-radius: 16px !important; }
form h2 { font-size: 25px; margin-bottom: 8px; }
.intro { margin-bottom: 24px; line-height: 1.6; }
.actions { display: flex; gap: 10px; margin: 12px 0 16px; }
.native { display: grid; gap: 10px; }
.native input { border: 1px solid #8b9b92; padding: 12px; border-radius: 8px; }
.native [role=alert] { color: #a62222; }
footer { margin-top: 24px; font-size: 12px; }
@media(max-width: 500px) { .page { padding: 24px 16px; } .form-card { padding: 20px; } }
</style>
