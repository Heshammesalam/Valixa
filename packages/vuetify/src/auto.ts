import { h } from 'vue';
import { VAutocomplete, VCheckbox, VRadio, VRadioGroup, VSelect, VSwitch, VTextarea, VTextField } from 'vuetify/components';
import { choiceValue, selectedOptions } from '@valixa/auto';
import type { AutoCodec } from '@valixa/auto';
import type { VueAutoAdapter, VueAutoRenderProps } from '@valixa/vue/auto';
import type { VNodeChild } from 'vue';

function renderWidget({ field, config, codec }: VueAutoRenderProps): VNodeChild {
  const state = field.state.value, inline = config.errorPlacement !== 'summary' && config.errorPlacement !== 'none';
  const errors = inline ? [...state.errors] : [];
  const described = [config.description ? `${field.id}-description` : '', errors.length ? `${field.id}-error` : ''].filter(Boolean).join(' ') || undefined;
  const common = { id: field.id, name: field.name, label: config.label, disabled: state.disabled, readonly: state.readonly, required: state.required, onBlur: field.onBlur,
    error: state.errors.length > 0, rules: [], validateOn: 'submit' as const, 'aria-invalid': state.errors.length > 0, 'aria-describedby': described, 'aria-required': state.required };
  let control: VNodeChild;
  if (['text', 'email', 'password', 'textarea', 'number', 'date'].includes(config.component)) {
    const number = config.component === 'number', date = config.component === 'date';
    const props = { ...common, type: number ? 'number' : date ? 'date' : config.component === 'textarea' ? 'text' : config.component, modelValue: date ? codec!.decode(state.value) : state.value ?? '',
      'onUpdate:modelValue': (value: unknown) => { const text = value == null ? '' : String(value); field.setValue(date ? codec!.encode(text) : number ? text.trim() === '' || !Number.isFinite(Number(text)) ? config.emptyValue : Number(text) : text); } };
    control = config.component === 'textarea' ? h(VTextarea, props) : h(VTextField, props);
  } else if (config.component === 'checkbox' || config.component === 'switch') {
    const props = { ...common, modelValue: Boolean(state.value), 'onUpdate:modelValue': (value: unknown) => field.setValue(Boolean(value)) };
    control = config.component === 'checkbox' ? h(VCheckbox, props) : h(VSwitch, props);
  } else if (config.component === 'select' || config.component === 'autocomplete') {
    const options = (config.options ?? []).map((option, index) => ({ title: option.label, index: String(index) }));
    const selected = selectedOptions(config, state.value).map(String);
    const props = { ...common, items: options, itemTitle: 'title', itemValue: 'index', multiple: Boolean(config.multiple), returnObject: false,
      modelValue: config.multiple ? selected : selected[0] ?? null,
      'onUpdate:modelValue': (value: unknown) => field.setValue(choiceValue(config, (Array.isArray(value) ? value : value == null ? [] : [value]).map(Number))) };
    control = config.component === 'select' ? h(VSelect, props) : h(VAutocomplete, props);
  } else if (config.component === 'radio') {
    control = h(VRadioGroup, { ...common, name: field.id, modelValue: String(selectedOptions(config, state.value)[0] ?? ''), 'onUpdate:modelValue': (value: unknown) => field.setValue(choiceValue(config, [Number(value)])) }, () => (config.options ?? []).map((option, index) => h(VRadio, { key: index, label: option.label, value: String(index), disabled: state.disabled || state.readonly })));
  } else throw new TypeError(`Vuetify Auto Form cannot render ${config.component}`);
  return h('div', [control, config.description ? h('small', { id: `${field.id}-description` }, config.description) : null, errors.length ? h('span', { id: `${field.id}-error`, role: 'alert' }, errors.join(' ')) : null]);
}
export function createVuetifyAutoAdapter(options: { readonly custom?: Readonly<Record<string, (props: VueAutoRenderProps<any>) => VNodeChild>>; readonly codecs?: Readonly<Record<string, AutoCodec<any>>> } = {}): VueAutoAdapter {
  return Object.freeze({ name: 'Vuetify', widgets: ['text', 'email', 'password', 'number', 'textarea', 'select', 'checkbox', 'radio', 'switch', 'autocomplete', 'date', 'custom'] as const, dateView: 'string', custom: Object.freeze(Object.keys(options.custom ?? {})), ...(options.codecs ? { codecs: options.codecs } : {}),
    renderField: (props: VueAutoRenderProps) => props.config.component === 'custom' ? options.custom![props.config.renderer!]!(props) : renderWidget(props) });
}
export const vuetifyAdapter = createVuetifyAutoAdapter();
