// @vitest-environment jsdom
import './helpers/vue-env.js';
import { computed, defineComponent, effectScope, h, nextTick, watch } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import { VTextField } from 'vuetify/components';
import { expect, it } from 'vitest';
import { createValixa, nested } from '@valixa/core';
import type { CollectionRow } from '@valixa/core';
import { nativeText, useValixaAdapter, useValixaField, useValixaState } from '@valixa/vue';
import { useVuetifyField } from '@valixa/vuetify';
import { reactiveOptions, reactiveSchema } from '../examples/shared/reactive.js';
import type { AddressValues } from '../examples/shared/reactive.js';

it('Vue shallow projections retain unchanged computed value branches', async () => {
  const scope = effectScope(), form = createValixa({ user: nested({ name: ['', 'required'] }), other: [''] }); let notifications = 0;
  const branch = scope.run(() => { const state = useValixaState(form), user = computed(() => state.value.values.user); watch(user, () => notifications++); return user; })!;
  const before = branch.value; await form.validate(); await nextTick(); form.setValue('other', 'changed'); await nextTick();
  expect(branch.value).toBe(before); expect(notifications).toBe(0); scope.stop(); form.dispose();
});

it('Vue/Vuetify projects nested conditions, locale messages and stable collection row controls', async () => {
  const form = createValixa(reactiveSchema, reactiveOptions), addresses = form.array('addresses');
  const Row = defineComponent<{ row: CollectionRow<AddressValues> }>({ props: ['row'], setup(props) {
    const city = useVuetifyField(props.row.form, 'city', { kind: 'text' });
    return () => h('section', { 'data-row': props.row.key }, [h(VTextField, { label: 'Address city', ...city.value })]);
  } });
  const App = defineComponent({ setup() {
    const country = useValixaAdapter(form, 'country', nativeText), city = useVuetifyField(form, 'user.city', { kind: 'text' });
    const field = useValixaField(form, 'user.city'), state = useValixaState(form);
    return () => h('div', [h('input', { ...country.value, 'aria-label': 'Country code' }), field.state.value.visible ? h(VTextField, { label: 'City', ...city.value }) : null,
      ...state.value.values.addresses.map((_, index) => { const row = addresses.items[index]!; return h(Row, { key: row.key, row }); })]);
  } });
  const wrapper = mount(App, { global: { plugins: [createVuetify()] } });
  expect(wrapper.findComponent(VTextField).exists()).toBe(false);
  await wrapper.get('input').setValue('EG'); await form.validate(); await nextTick(); expect(wrapper.text()).toContain('City is required.');
  form.setLocale('ar'); await nextTick(); expect(wrapper.text()).toContain('المدينة مطلوب.');
  addresses.append({ city: 'Alex', confirm: '' }); await nextTick(); const rowElement = wrapper.get('[data-row]').element;
  addresses.append({ city: 'Giza', confirm: '' }); addresses.move(0, 1); await nextTick();
  expect(wrapper.findAll('[data-row]')[1]!.element).toBe(rowElement);
  const inputs = wrapper.findAll('[data-row] input'); await inputs[1]!.setValue('Cairo'); expect(form.state.values.addresses[1]!.city).toBe('Cairo');
  addresses.remove(0); await flushPromises(); expect(wrapper.findAll('[data-row]')).toHaveLength(1);
  wrapper.unmount(); form.dispose();
});
