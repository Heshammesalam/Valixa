'use client';
import { memo, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { createRenderingPlan, resolveAutoCodec } from '@valixa/auto';
import type { AutoCapabilities, AutoCodec, AutoUI, PlanNode, RuntimeField } from '@valixa/auto';
import type { SubmitHandler, SubmitResult, ValixaForm } from '@valixa/core';
import { useValixaField, useValixaState } from './index.js';
import type { FieldBinding } from './index.js';

export interface AutoRenderProps<T = any> { readonly field: FieldBinding<T>; readonly config: RuntimeField; readonly codec?: AutoCodec<T> }
export interface ReactAutoAdapter extends AutoCapabilities { readonly renderField: (props: AutoRenderProps) => ReactNode }
export function defineReactAutoRenderer<T>(component: ComponentType<AutoRenderProps<T>>): ComponentType<AutoRenderProps<T>> { return component; }
export interface AutoFieldSlot extends AutoRenderProps { readonly renderDefault: () => ReactNode }
export interface ValixaAutoFormProps<V extends Record<string, unknown>, R = unknown> {
  readonly form: ValixaForm<V>; readonly ui: AutoUI<V>; readonly adapter: ReactAutoAdapter;
  readonly onSubmit: SubmitHandler<V, R>; readonly onResult?: (result: SubmitResult<V, R>) => void; readonly onError?: (error: unknown) => void;
  readonly renderField?: (context: AutoFieldSlot) => ReactNode;
  readonly renderActions?: (context: { readonly submitting: boolean; readonly reset: () => void }) => ReactNode;
  readonly className?: string;
}
type Internal = { form: ValixaForm<any>; adapter: ReactAutoAdapter; renderField?: ((context: AutoFieldSlot) => ReactNode) | undefined };
const Leaf = memo(function AutoField({ form, node, adapter, renderField }: Internal & { node: Extract<PlanNode, { kind: 'field' }> }) {
  const binding = useValixaField(form, node.name);
  const field = useMemo(() => ({ ...binding,
    state: Object.freeze({ ...binding.state, disabled: binding.state.disabled || Boolean(node.config.disabled), readonly: binding.state.readonly || Boolean(node.config.readonly) }),
    setValue: (value: any) => { if (!node.config.disabled && !node.config.readonly) binding.setValue(value); }
  }), [binding, node.config]);
  if (!field.state.visible || node.config.presentationWhen?.(field.state) === false) return null;
  const props: AutoRenderProps = { field, config: node.config, ...(node.config.component === 'date' ? { codec: resolveAutoCodec(node.config, adapter) } : {}) };
  const renderDefault = () => adapter.renderField(props);
  return <div className={node.config.className} data-valixa-field={node.name}>{renderField ? renderField({ ...props, renderDefault }) : renderDefault()}</div>;
});
const Row = memo(function AutoRow({ form, nodes, ...rest }: Internal & { nodes: readonly PlanNode[] }) { return <>{nodes.map(node => <Node key={node.kind === 'group' ? `group:${node.id}` : `${node.kind}:${node.name}`} form={form} node={node} {...rest} />)}</>; });
function Collection({ form, node, ...rest }: Internal & { node: Extract<PlanNode, { kind: 'collection' }> }) {
  const collection = useMemo(() => form.array(node.name), [form, node.name]);
  const items = useSyncExternalStore(collection.subscribe, () => collection.items, () => collection.items);
  const field = useValixaField(form, node.name);
  if (!field.state.visible) return null;
  const blocked = field.state.disabled || field.state.readonly;
  return <fieldset data-valixa-collection={node.name} disabled={field.state.disabled}><legend>{node.label}</legend>
    {items.map((row, index) => <div key={row.key} data-valixa-row={row.key}>
      <Row form={row.form} nodes={node.ui.nodes} {...rest} />
      <button type="button" disabled={blocked} onClick={() => collection.remove(index)}>{node.removeLabel}</button>
      {node.movable && <button type="button" aria-label={`Move row ${index + 1} up`} disabled={blocked || index === 0} onClick={() => collection.move(index, index - 1)}>Move up</button>}
    </div>)}
    <button type="button" disabled={blocked} onClick={() => collection.append(node.createItem())}>{node.addLabel}</button>
  </fieldset>;
}
function Node({ node, ...props }: Internal & { node: PlanNode }) {
  if (node.kind === 'field') return <Leaf {...props} node={node} />;
  if (node.kind === 'collection') return <Collection {...props} node={node} />;
  return <fieldset data-valixa-group={node.id}><legend>{node.label}</legend>{node.description && <p>{node.description}</p>}
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${node.columns}, minmax(0, 1fr))`, gap: 16 }}><Row {...props} nodes={node.children} /></div>
  </fieldset>;
}
function Actions({ form, ui, error, renderActions }: { form: ValixaForm<any>; ui: AutoUI<any>; error: string; renderActions?: ValixaAutoFormProps<any>['renderActions'] | undefined }) {
  const state = useValixaState(form);
  return <>{ui.summary && state.invalid && <div role="alert" aria-label="Form errors"><ul>{Object.entries(state.errors).flatMap(([name, messages]) => (messages as readonly string[]).map((message, index) => <li key={`${name}:${index}`}>{name}: {message}</li>))}{state.formErrors.map((message, index) => <li key={`form:${index}`}>{message}</li>)}</ul></div>}
    {error && <p role="alert">{error}</p>}
    {renderActions ? renderActions({ submitting: state.submitting, reset: () => form.reset() }) : <div><button type="submit" disabled={state.submitting || state.disabled}>{state.submitting ? 'Submitting…' : ui.submitLabel}</button><button type="reset" disabled={state.submitting}>{ui.resetLabel}</button></div>}
  </>;
}
/** Optional renderer; the root owns no live form subscription and never owns/disposes the supplied form. */
export function ValixaAutoForm<V extends Record<string, unknown>, R = unknown>({ form, ui, adapter, onSubmit, onResult, onError, renderField, renderActions, className }: ValixaAutoFormProps<V, R>) {
  const nodes = useMemo(() => createRenderingPlan(form, ui, adapter), [form, ui, adapter]);
  const [error, setError] = useState(''), [epoch, setEpoch] = useState(0);
  useEffect(() => { setEpoch(value => value + 1); return form.observeEvents(() => { setEpoch(value => value + 1); setError(''); }, { types: ['form.reset'] }); }, [form]);
  return <form className={className} noValidate onReset={event => { event.preventDefault(); form.reset(); setError(''); }} onSubmit={event => {
    event.preventDefault(); setError(''); void form.submit(onSubmit).then(result => onResult?.(result)).catch(reason => { setError('Submission failed.'); onError?.(reason); });
  }}><Row key={epoch} form={form} nodes={nodes} adapter={adapter} renderField={renderField} /><Actions form={form} ui={ui} error={error} renderActions={renderActions} /></form>;
}
