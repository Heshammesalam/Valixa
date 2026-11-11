// @vitest-environment jsdom
import { act, fireEvent } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { createSSRApp, defineComponent, h, nextTick } from 'vue';
import { renderToString as renderVue } from '@vue/server-renderer';
import { expect, it } from 'vitest';
import { blueprint, createValixa, nested, parsePath } from 'valixa';
import { defineAutoForm } from 'valixa-auto';
import { useValixaField } from 'valixa-react';
import { useValixaField as vueField } from 'valixa-vue';
import { ValixaAutoForm } from 'valixa-react/auto';
import { muiAdapter } from 'valixa-mui/auto';
import { attachValixaDevtools } from 'valixa-devtools';
import { mountValixaDevtools } from 'valixa-devtools/panel';

it('rejects prototype paths and invalid patches atomically', () => {
  const form = createValixa({ user: nested({ name: ['Ada'] }) }), snapshot = form.state;
  for (const path of ['user.__proto__.polluted', 'user.constructor.prototype', 'user..name', 'user\\q']) expect(() => parsePath(path)).toThrow();
  expect(() => form.setValues(JSON.parse('{"user":{"name":"changed","__proto__":{"polluted":true}}}'))).toThrow();
  expect(form.state).toBe(snapshot); expect(({} as Record<string, unknown>).polluted).toBeUndefined(); form.dispose();
});
it('treats hostile presentation labels and diagnostic names as text, never executable HTML', () => {
  const attack = '<img src=x onerror="window.__valixaAttack=true">', schema = blueprint({ name: [''] });
  const form = createValixa(schema), ui = defineAutoForm(schema, { fields: { name: { component: 'text', label: attack } } });
  const html = renderToString(<ValixaAutoForm form={form} ui={ui} adapter={muiAdapter} onSubmit={() => {}} />);
  const host = document.createElement('div'); host.innerHTML = html; expect(host.querySelector('img')).toBeNull(); expect(host.textContent).toContain(attack);
  const inspection = attachValixaDevtools(form, { name: attack }), panelHost = document.createElement('div'), panel = mountValixaDevtools(panelHost, [inspection]);
  expect(panelHost.querySelector('img')).toBeNull(); expect(panelHost.textContent).toContain(attack); panel.destroy(); inspection.detach(); form.dispose();
});
it('hydrates a native React field without recoverable errors and retains live validation', async () => {
  const form = createValixa({ email: ['safe@example.com', 'required | email'] });
  function Native() { const field = useValixaField(form, 'email'); return <input aria-label="Email" value={field.state.value} onChange={event => field.setValue(event.target.value)} />; }
  const host = document.createElement('div'); document.body.append(host); host.innerHTML = renderToString(<Native />);
  const errors: unknown[] = []; let root!: Root;
  await act(async () => { root = hydrateRoot(host, <Native />, { onRecoverableError: error => errors.push(error) }); });
  fireEvent.change(host.querySelector('input')!, { target: { value: 'invalid' } }); expect(form.state.values.email).toBe('invalid'); expect((await form.validate()).valid).toBe(false); expect(errors).toEqual([]);
  await act(async () => root.unmount()); host.remove(); form.dispose();
});
it('hydrates a native Vue field and releases its live field subscription', async () => {
  const form = createValixa({ email: ['safe@example.com', 'email'] });
  const App = defineComponent({ setup() { const field = vueField(form, 'email'); return () => h('input', { 'aria-label': 'Email', value: field.state.value.value, onInput: (event: Event) => field.setValue((event.target as HTMLInputElement).value) }); } });
  const host = document.createElement('div'); document.body.append(host); host.innerHTML = await renderVue(createSSRApp(App));
  const app = createSSRApp(App), warnings: string[] = []; app.config.warnHandler = message => warnings.push(message); app.mount(host);
  const input = host.querySelector('input')!; input.value = 'next@example.com'; input.dispatchEvent(new Event('input')); await nextTick(); expect(form.state.values.email).toBe('next@example.com'); expect(warnings).toEqual([]);
  app.unmount(); form.setValue('email', 'after@example.com'); await nextTick(); expect(host.childElementCount).toBe(0); host.remove(); form.dispose();
});
