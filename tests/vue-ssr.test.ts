// @vitest-environment node
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createVuetify } from 'vuetify';
import { VTextField } from 'vuetify/components';
import { expect, it, vi } from 'vitest';
import { createValixa } from '@valixa/core';
import { useValixaField, useValixaState } from '@valixa/vue';
import { useVuetifyField } from '@valixa/vuetify';

it('SSR renders actual Vuetify bindings without subscribing external forms', async () => {
  const form = createValixa({ email: ['user@example.com', 'email'] });
  const fields = vi.spyOn(form, 'subscribeField'), all = vi.spyOn(form, 'subscribe');
  const App = defineComponent({ setup() {
    const email = useVuetifyField(form, 'email', { kind: 'text', required: true });
    useValixaField(form, 'email'); const state = useValixaState(form);
    return () => h('div', [h(VTextField, { ...email.value, label: 'Email' }), h('output', String(state.value.submitting))]);
  } });
  const render = async () => { const app = createSSRApp(App); app.use(createVuetify({ ssr: true })); return renderToString(app); };
  const first = await render(); const second = await render();
  expect(first).toContain('user@example.com'); expect(first).toContain('Email'); expect(first).toBe(second);
  expect(fields).not.toHaveBeenCalled(); expect(all).not.toHaveBeenCalled();
  form.setValue('email', 'still-alive@example.com');
});
