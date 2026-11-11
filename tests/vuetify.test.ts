// @vitest-environment jsdom
import './helpers/vue-env.js';
import { defineComponent, nextTick } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import { VTextField, VBtn, VTextarea, VSelect, VCheckbox, VSwitch } from 'vuetify/components';
import { describe, expect, it, vi } from 'vitest';
import { useValixa, useValixaState } from '@valixa/vue';
import { useVuetifyField } from '@valixa/vuetify';
import { createValixa } from '@valixa/core';

describe('Vue → real Vuetify vertical slice', () => {
  it('reacts through compiled template bindings, validates and awaits submission', async () => {
    const save = vi.fn(async (data: { email: string }) => data.email);
    const App = defineComponent({ components: { VTextField, VBtn }, setup() {
      const form = useValixa({ email: ['', 'required | email'] }, { validateOn: 'blur' });
      const email = useVuetifyField(form, 'email', { kind: 'text', required: true });
      const state = useValixaState(form); const onSubmit = form.handleSubmit(save);
      return { form, email, state, onSubmit };
    }, template: `<form novalidate @submit="onSubmit"><v-text-field label="Email" v-bind="email" /><v-btn type="submit" :loading="state.submitting">Save</v-btn></form>` });
    const wrapper = mount(App, { global: { plugins: [createVuetify()] } });
    await wrapper.get('input').trigger('blur'); await flushPromises();
    expect(wrapper.text()).toContain('email is required.'); expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('input').attributes('required')).toBeDefined();
    await wrapper.get('input').setValue('user@example.com'); await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(save).toHaveBeenCalledOnce(); expect(save.mock.calls[0]?.[0]).toEqual({ email: 'user@example.com' });
    wrapper.unmount(); await nextTick();
  });
});

describe('basic Vuetify contracts', () => {
  it('normalizes text clearing and textarea updates while preserving core flags/errors', async () => {
    const form = createValixa({ text: ['start'], notes: [''] });
    const App = defineComponent({ components: { VTextField, VTextarea }, setup() {
      return { text: useVuetifyField(form, 'text', { kind: 'text' }), notes: useVuetifyField(form, 'notes', { kind: 'textarea' }) };
    }, template: `<div><v-text-field label="Text" v-bind="text" /><v-textarea label="Notes" v-bind="notes" /></div>` });
    const wrapper = mount(App, { global: { plugins: [createVuetify()] } });
    wrapper.getComponent(VTextField).vm.$emit('update:modelValue', null); await nextTick(); expect(form.state.values.text).toBe('');
    await wrapper.get('textarea').setValue('Long note'); expect(form.state.values.notes).toBe('Long note');
    form.setError('text', ['Server rejected']); await nextTick(); expect(wrapper.text()).toContain('Server rejected');
    const described = wrapper.get('input').attributes('aria-describedby'); expect(wrapper.find(`#${described}`).text()).toContain('Server rejected');
    form.setReadonly(true); await nextTick(); await wrapper.get('textarea').setValue('blocked'); expect(form.state.values.notes).toBe('Long note');
    form.setDisabled(true); await nextTick(); expect(wrapper.get('input').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });
  it('uses booleans for actual Checkbox/Switch clicks, blur and reset', async () => {
    const form = createValixa({ agreed: [false, 'required'], updates: [false] });
    const App = defineComponent({ components: { VCheckbox, VSwitch }, setup() {
      return { agreed: useVuetifyField(form, 'agreed', { kind: 'checkbox' }), updates: useVuetifyField(form, 'updates', { kind: 'switch' }) };
    }, template: `<div><v-checkbox label="Agree" v-bind="agreed" /><v-switch label="Updates" v-bind="updates" /></div>` });
    const wrapper = mount(App, { global: { plugins: [createVuetify()] } });
    const inputs = wrapper.findAll('input'); await inputs[0]!.setValue(true); await inputs[1]!.setValue(true);
    expect(form.state.values).toEqual({ agreed: true, updates: true });
    await inputs[0]!.trigger('blur'); expect(form.state.touched.agreed).toBe(true);
    form.reset(); await nextTick(); expect((inputs[0]!.element as HTMLInputElement).checked).toBe(false);
    form.setReadonly(true); await nextTick(); await inputs[0]!.setValue(true); expect(form.state.values.agreed).toBe(false);
    wrapper.unmount();
  });
  it('maps real Select menu choices, multiple payloads and explicit single clearing', async () => {
    const form = createValixa({ country: [''], tags: { initial: [] as string[] } });
    const App = defineComponent({ components: { VSelect }, setup() {
      return { country: useVuetifyField(form, 'country', { kind: 'select', multiple: false, clearValue: '' }),
        tags: useVuetifyField(form, 'tags', { kind: 'select', multiple: true }) };
    }, template: `<div><v-select label="Country" :items="['Egypt','US']" v-bind="country" /><v-select label="Tags" :items="['a','b']" v-bind="tags" /></div>` });
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [createVuetify()] } });
    await wrapper.findAll('input')[0]!.trigger('mousedown'); await flushPromises();
    const option = document.querySelector('[role="option"]') as HTMLElement;
    expect(option).toBeTruthy(); option.click(); await flushPromises(); expect(form.state.values.country).toBe('Egypt');
    const selects = wrapper.findAllComponents(VSelect);
    selects[0]!.vm.$emit('update:modelValue', null); selects[1]!.vm.$emit('update:modelValue', ['a', 'b']); await nextTick();
    expect(form.state.values.country).toBe(''); expect(form.state.values.tags).toEqual(['a', 'b']);
    wrapper.unmount();
  });
});
