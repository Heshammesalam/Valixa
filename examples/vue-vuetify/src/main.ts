import { createApp } from 'vue';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';
import 'vuetify/styles';
import App from './App.vue';
createApp(App).use(createVuetify({ icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  theme: { defaultTheme: 'valixa', themes: { valixa: { dark: false, colors: { primary: '#315c51', background: '#f4f6f3' } } } }
})).mount('#app');
