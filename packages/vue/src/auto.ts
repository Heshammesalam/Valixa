import { computed, defineComponent, h, markRaw, onMounted, onScopeDispose, shallowRef, toRaw, watch } from 'vue';
import type { Component, PropType, Slots, VNodeChild } from 'vue';
import { createRenderingPlan, resolveAutoCodec } from '@valixa/auto';
import type { AutoCapabilities, AutoCodec, AutoUI, PlanNode, RuntimeField } from '@valixa/auto';
import type { SubmitHandler, ValixaForm } from '@valixa/core';
import { useValixaField, useValixaState } from './index.js';
import type { VueField } from './index.js';

export interface VueAutoRenderProps<T = any> { readonly field: VueField<T>; readonly config: RuntimeField; readonly codec?: AutoCodec<T> }
export interface VueAutoAdapter extends AutoCapabilities { readonly renderField: (props: VueAutoRenderProps) => VNodeChild }
export function defineVueAutoRenderer<T>(render: (props: VueAutoRenderProps<T>) => VNodeChild): (props: VueAutoRenderProps<T>) => VNodeChild { return render; }
export interface VueAutoFormProps<V extends Record<string, unknown>, R = unknown> { readonly form: ValixaForm<V>; readonly ui: AutoUI<V>; readonly adapter: VueAutoAdapter; readonly onSubmit: SubmitHandler<V, R> }
const shared = { form: { type: Object as PropType<ValixaForm<any>>, required: true }, adapter: { type: Object as PropType<VueAutoAdapter>, required: true }, overrides: { type: Object as PropType<Slots>, required: true } } as const;
const Leaf = defineComponent({ name: 'ValixaAutoField', props: { ...shared, node: { type: Object as PropType<Extract<PlanNode, { kind: 'field' }>>, required: true } }, setup(props) {
  const binding = useValixaField(props.form, props.node.name);
  const field: VueField<any> = { ...binding, state: computed(() => Object.freeze({ ...binding.state.value, disabled: binding.state.value.disabled || Boolean(props.node.config.disabled), readonly: binding.state.value.readonly || Boolean(props.node.config.readonly) })),
    setValue: value => { if (!props.node.config.disabled && !props.node.config.readonly) binding.setValue(value); } };
  return () => {
    if (!field.state.value.visible || props.node.config.presentationWhen?.(field.state.value) === false) return null;
    const context: VueAutoRenderProps = { field, config: props.node.config, ...(props.node.config.component === 'date' ? { codec: resolveAutoCodec(props.node.config, props.adapter) } : {}) };
    const renderDefault = () => props.adapter.renderField(context);
    return h('div', { class: props.node.config.className, 'data-valixa-field': props.node.name }, [props.overrides.field ? props.overrides.field({ ...context, renderDefault }) : renderDefault()]);
  };
} });
const Nodes: Component = defineComponent({ name: 'ValixaAutoNodes', props: { ...shared, nodes: { type: Array as PropType<readonly PlanNode[]>, required: true } }, setup: props => () => props.nodes.map(node => {
  const bindings = { form: props.form, adapter: props.adapter, overrides: props.overrides };
  if (node.kind === 'field') return h(Leaf, { ...bindings, key: `field:${node.name}`, node });
  if (node.kind === 'collection') return h(Collection, { ...bindings, key: `collection:${node.name}`, node });
  return h('fieldset', { key: `group:${node.id}`, 'data-valixa-group': node.id }, [h('legend', node.label), node.description ? h('p', node.description) : null,
    h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${node.columns}, minmax(0, 1fr))`, gap: '16px' } }, [h(Nodes, { ...props, nodes: node.children })])]);
}) });
const Collection: Component = defineComponent({ name: 'ValixaAutoCollection', props: { ...shared, node: { type: Object as PropType<Extract<PlanNode, { kind: 'collection' }>>, required: true } }, setup(props) {
  const collection = props.form.array(props.node.name), items = shallowRef(collection.items), field = useValixaField(props.form, props.node.name);
  let off: (() => void) | undefined;
  onMounted(() => { off = collection.subscribe(() => { if (items.value !== collection.items) items.value = collection.items; }); items.value = collection.items; }); onScopeDispose(() => off?.());
  return () => {
    if (!field.state.value.visible) return null;
    const blocked = field.state.value.disabled || field.state.value.readonly;
    return h('fieldset', { 'data-valixa-collection': props.node.name, disabled: field.state.value.disabled }, [h('legend', props.node.label),
      ...items.value.map((row, index) => h('div', { key: row.key, 'data-valixa-row': row.key }, [h(Nodes, { form: row.form, nodes: props.node.ui.nodes, adapter: props.adapter, overrides: props.overrides }),
        h('button', { type: 'button', disabled: blocked, onClick: () => collection.remove(index) }, props.node.removeLabel), props.node.movable ? h('button', { type: 'button', disabled: blocked || index === 0, 'aria-label': `Move row ${index + 1} up`, onClick: () => collection.move(index, index - 1) }, 'Move up') : null])),
      h('button', { type: 'button', disabled: blocked, onClick: () => collection.append(props.node.createItem()) }, props.node.addLabel)]);
  };
} });
const Actions = defineComponent({ name: 'ValixaAutoActions', props: { form: shared.form, ui: { type: Object as PropType<AutoUI<any>>, required: true }, error: String, overrides: shared.overrides }, setup(props) {
  const state = useValixaState(props.form);
  return () => [props.ui.summary && state.value.invalid ? h('div', { role: 'alert', 'aria-label': 'Form errors' }, [h('ul', [
    ...Object.entries(state.value.errors).flatMap(([name, messages]) => (messages as readonly string[]).map(message => h('li', `${name}: ${message}`))), ...state.value.formErrors.map(message => h('li', message))])]) : null,
  props.error ? h('p', { role: 'alert' }, props.error) : null,
  props.overrides.actions ? props.overrides.actions({ state: state.value, reset: () => props.form.reset() }) : h('div', [h('button', { type: 'submit', disabled: state.value.submitting || state.value.disabled }, state.value.submitting ? 'Submitting…' : props.ui.submitLabel), h('button', { type: 'reset', disabled: state.value.submitting }, props.ui.resetLabel)])];
} });
/** onSubmit is an awaited component listener/prop, so Vue @submit may return a promise. */
export const ValixaAutoForm = defineComponent({ name: 'ValixaAutoForm', inheritAttrs: false,
  props: { form: shared.form, ui: { type: Object as PropType<AutoUI<any>>, required: true }, adapter: shared.adapter, onSubmit: { type: Function as PropType<SubmitHandler<any, any>>, required: true } }, emits: ['result', 'error'],
  setup(props, { slots, attrs, emit }) {
    const store = computed(() => markRaw(toRaw(props.form)));
    const nodes = computed(() => createRenderingPlan(store.value, props.ui, props.adapter)), error = shallowRef(''), epoch = shallowRef(0);
    onMounted(() => watch(store, (form, previous, cleanup) => { if (previous) epoch.value++; cleanup(form.observeEvents(() => { epoch.value++; error.value = ''; }, { types: ['form.reset'] })); }, { immediate: true }));
    return () => h('form', { ...attrs, novalidate: true, onReset: (event: Event) => { event.preventDefault(); store.value.reset(); error.value = ''; }, onSubmit: (event: Event) => {
      event.preventDefault(); error.value = ''; void store.value.submit(props.onSubmit).then(result => emit('result', result)).catch(reason => { error.value = 'Submission failed.'; emit('error', reason); });
    } }, [h(Nodes, { key: epoch.value, form: store.value, nodes: nodes.value, adapter: props.adapter, overrides: slots }), h(Actions, { key: `actions:${epoch.value}`, form: store.value, ui: props.ui, error: error.value, overrides: slots })]);
  }
});
