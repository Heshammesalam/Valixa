// @vitest-environment jsdom
import './helpers/vue-env.js';
import { defineComponent, h, nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import { expect, it, vi } from 'vitest';
import { blueprint, collection, createValixa } from 'valixa';
import { defineAutoForm } from 'valixa-auto';
import { ValixaAutoForm, defineVueAutoRenderer } from 'valixa-vue/auto';
import { createVuetifyAutoAdapter, vuetifyAdapter } from 'valixa-vuetify/auto';

it('Vue/Vuetify Auto Form validates, awaits @submit listener promises and resets', async () => {
  const schema = blueprint({ email: ['', 'required | email'], age: [18] }), form = createValixa(schema);
  const ui = defineAutoForm(schema, { fields: { email: { component: 'email', label: 'Email' }, age: { component: 'number', label: 'Age', emptyValue: 0 } }, submitLabel: 'Save' });
  let finish!: () => void; const save = vi.fn((_values: typeof schema.__values) => new Promise<void>(resolve => { finish = resolve; }));
  const wrapper = mount(ValixaAutoForm, { props: { form, ui, adapter: vuetifyAdapter, onSubmit: save }, global: { plugins: [createVuetify()] } });
  await wrapper.get('form').trigger('submit'); await flushPromises(); expect(save).not.toHaveBeenCalled(); expect(wrapper.text()).toContain('email is required.');
  await wrapper.get('input[type=email]').setValue('ada@example.com'); await wrapper.get('input[type=number]').setValue('20'); await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(form.state.submitting).toBe(true); expect(save.mock.calls[0]?.[0]).toEqual({ email: 'ada@example.com', age: 20 }); finish(); await flushPromises(); expect(form.state.submitted).toBe(true);
  await wrapper.get('form').trigger('reset'); expect(form.state.values.email).toBe(''); wrapper.unmount(); form.dispose();
});
it('Vue Auto Form keeps unrelated fields isolated and cleans field subscriptions on view teardown', async () => {
  const schema = blueprint({ first: [''], second: [''] }), form = createValixa(schema); const renders: Record<string, number> = {};
  const off = vi.fn(), original = form.subscribeField.bind(form); vi.spyOn(form, 'subscribeField').mockImplementation((name, listener) => { const release = original(name, listener); return () => { off(); release(); }; });
  const custom = defineVueAutoRenderer<string>(({ field, config }) => { renders[field.name] = (renders[field.name] ?? 0) + 1; return h('input', { 'aria-label': config.label, value: field.state.value.value, onInput: (event: Event) => field.setValue((event.target as HTMLInputElement).value) }); });
  const ui = defineAutoForm(schema, { fields: { first: { component: 'custom', renderer: 'text', label: 'First' }, second: { component: 'custom', renderer: 'text', label: 'Second' } } });
  const App = defineComponent({ setup: () => () => h(ValixaAutoForm, { form, ui, adapter: createVuetifyAutoAdapter({ custom: { text: custom } }), onSubmit: () => {} }) });
  const wrapper = mount(App); const count = renders.second; await wrapper.get('input[aria-label=First]').setValue('one'); await nextTick(); expect(renders.second).toBe(count);
  wrapper.unmount(); expect(off).toHaveBeenCalledTimes(2); expect(() => form.setValue('first', 'alive')).not.toThrow(); form.dispose();
});
it('Vue Auto Form renders conditional required fields and stable collection rows', async () => {
  const schema = blueprint({ country: [''], city: [''], rows: collection({ city: ['', 'required'] }) }), form = createValixa(schema, { behaviors: { city: { dependsOn: ['country'], visibleWhen: ({ values }) => Boolean(values.country), requiredWhen: ({ values }) => Boolean(values.country) } } });
  const rowUI = defineAutoForm(blueprint({ city: ['', 'required'] }), { fields: { city: { component: 'text', label: 'Row city' } } });
  const ui = defineAutoForm(schema, { fields: { city: { component: 'text', label: 'City' } }, collections: { rows: { label: 'Rows', ui: rowUI, createItem: () => ({ city: '' }) } } });
  const wrapper = mount(ValixaAutoForm, { props: { form, ui, adapter: vuetifyAdapter, onSubmit: () => {} }, global: { plugins: [createVuetify()] } });
  expect(wrapper.find('input').exists()).toBe(false); form.setValue('country', 'EG'); await nextTick(); expect(wrapper.get('input').attributes('required')).toBeDefined();
  const rows = form.array('rows'); rows.append({ city: 'Cairo' }); await nextTick(); const first = wrapper.get('[data-valixa-row]').element;
  rows.append({ city: 'Giza' }); rows.move(0, 1); await nextTick(); expect(wrapper.findAll('[data-valixa-row]')[1]!.element).toBe(first);
  wrapper.unmount(); form.dispose();
});
