// @vitest-environment jsdom
import './helpers/vue-env.js';
import { defineComponent, effectScope, nextTick } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import { VAutocomplete, VCombobox, VRadioGroup, VRadio, VTextField, VFileInput } from 'vuetify/components';
import { describe, expect, it } from 'vitest';
import { createValixa } from '@valixa/core';
import { defineValixaAdapter, useValixaAdapter } from '@valixa/vue';
import { fileMetadata, useVuetifyField, useVuetifyFileField } from '@valixa/vuetify';
import type { FileField, FileMetadata } from '@valixa/vuetify';

const global = () => ({ plugins: [createVuetify()] });
describe('advanced real Vuetify components', () => {
  it('selects object Autocomplete items and preserves selection through core copies', async () => {
    const items = [{ id: 1, title: 'Cairo' }, { id: 2, title: 'Giza' }];
    const form = createValixa({ city: { initial: null as { id: number; title: string } | null } });
    const App = defineComponent({ components: { VAutocomplete }, setup() {
      return { items, city: useVuetifyField(form, 'city', { kind: 'autocomplete', multiple: false, clearValue: null, returnObject: true, itemValue: 'id', itemTitle: 'title' }) };
    }, template: `<v-autocomplete label="City" :items="items" v-bind="city" />` });
    const wrapper = mount(App, { attachTo: document.body, global: global() });
    await wrapper.get('input').trigger('focus'); await wrapper.get('input').setValue('Cai'); await flushPromises();
    (document.querySelector('[role="option"]') as HTMLElement).click(); await flushPromises();
    expect(form.state.values.city).toEqual(items[0]); expect(wrapper.text()).toContain('Cairo');
    form.setError('city', 'Office full'); await nextTick(); expect(wrapper.text()).toContain('Office full');
    wrapper.getComponent(VAutocomplete).vm.$emit('update:modelValue', null); await nextTick(); expect(form.state.values.city).toBeNull();
    wrapper.unmount();
  });
  it('commits free-text and object Combobox values, including multiple selections', async () => {
    type Item = string | { id: number; title: string };
    const form = createValixa({ tags: { initial: [] as Item[] }, title: [''] });
    const App = defineComponent({ components: { VCombobox }, setup() { return {
      tags: useVuetifyField(form, 'tags', { kind: 'combobox', multiple: true, returnObject: true, itemTitle: 'title', itemValue: 'id' }),
      title: useVuetifyField(form, 'title', { kind: 'combobox', multiple: false, clearValue: '' })
    }; }, template: `<div><v-combobox label="Tags" :items="[]" v-bind="tags" /><v-combobox label="Title" :items="[]" v-bind="title" /></div>` });
    const wrapper = mount(App, { global: global() });
    await wrapper.findAll('input')[0]!.setValue('New tag'); await wrapper.findAll('input')[0]!.trigger('keydown', { key: 'Enter' }); await flushPromises();
    expect(form.state.values.tags).toEqual(['New tag']);
    const combo = wrapper.findAllComponents(VCombobox)[0]!;
    combo.vm.$emit('update:modelValue', ['New tag', { id: 1, title: 'Existing' }]); await nextTick();
    expect(form.state.values.tags).toEqual(['New tag', { id: 1, title: 'Existing' }]);
    const single = wrapper.findAll('input')[1]!; await single.setValue('Custom title'); await single.trigger('blur'); await flushPromises();
    expect(form.state.values.title).toBe('Custom title'); wrapper.unmount();
  });
  it('maps numeric edits and real radio choices without stringifying numbers', async () => {
    const form = createValixa({ budget: { initial: null as number | null }, plan: ['basic'] });
    const App = defineComponent({ components: { VTextField, VRadioGroup, VRadio }, setup() { return {
      budget: useVuetifyField(form, 'budget', { kind: 'number', emptyValue: null }), plan: useVuetifyField(form, 'plan', { kind: 'radio' })
    }; }, template: `<div><v-text-field label="Budget" v-bind="budget" /><v-radio-group v-bind="plan"><v-radio label="Basic" value="basic" /><v-radio label="Pro" value="pro" /></v-radio-group></div>` });
    const wrapper = mount(App, { global: global() });
    await wrapper.get('input[type="number"]').setValue('25.5'); expect(form.state.values.budget).toBe(25.5);
    await wrapper.get('input[type="number"]').setValue(''); expect(form.state.values.budget).toBeNull();
    await wrapper.findAll('input[type="radio"]')[1]!.setValue(); expect(form.state.values.plan).toBe('pro');
    wrapper.unmount();
  });
  it('keeps actual file bytes outside core and clears local files on reset/disposal', async () => {
    const form = createValixa({ uploads: { initial: [] as FileMetadata[] } }); let upload!: FileField;
    const App = defineComponent({ components: { VFileInput }, setup() { upload = useVuetifyFileField(form, 'uploads', fileMetadata, { multiple: true }); return { props: upload.props }; }, template: `<v-file-input label="Files" v-bind="props" />` });
    const wrapper = mount(App, { global: global() });
    const file = new File(['hello'], 'note.txt', { type: 'text/plain', lastModified: 100 });
    Object.defineProperty(wrapper.get('input[type="file"]').element, 'files', { value: [file], configurable: true });
    await wrapper.get('input[type="file"]').trigger('change');
    expect(form.state.values.uploads).toEqual([{ name: 'note.txt', size: 5, type: 'text/plain', lastModified: 100 }]);
    expect(upload.files.value[0]).toBe(file);
    form.setError('uploads', 'Too big'); await nextTick(); expect(upload.files.value[0]).toBe(file);
    form.reset(); await nextTick(); expect(upload.files.value).toEqual([]);
    upload.props.value['onUpdate:modelValue'](file); await nextTick(); expect(upload.files.value).toHaveLength(1);
    wrapper.unmount(); expect(upload.files.value).toEqual([]);
    expect(() => form.setValue('uploads', [file] as never)).toThrow('plain');
  });
  it('maps custom value prop and arbitrary payloads through explicit adapters', async () => {
    const form = createValixa({ seats: [1] });
    const adapter = defineValixaAdapter<number, { value: number; onAmount: (payload: { amount: number }) => void }>(field => ({
      value: field.state.value.value, onAmount: payload => field.setValue(payload.amount)
    }));
    const Custom = defineComponent({ props: { value: Number }, emits: { amount: (_payload: { amount: number }) => true },
      template: `<button @click="$emit('amount', {amount: (value || 0) + 1})">{{ value }}</button>` });
    const wrapper = mount(defineComponent({ components: { Custom }, setup() { return { props: useValixaAdapter(form, 'seats', adapter) }; }, template: `<Custom v-bind="props" />` }));
    await wrapper.get('button').trigger('click'); expect(form.state.values.seats).toBe(2); wrapper.unmount();
  });
});
