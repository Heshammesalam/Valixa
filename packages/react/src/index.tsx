'use client';
import type { FieldValue } from '@valixa/core';

import { createContext, createElement, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { createValixa } from '@valixa/core';
import type { Blueprint, BlueprintInput, FieldName, FieldState, FormOptions, FormState, InferValues, ValixaForm } from '@valixa/core';

/** Owns one form per mount. Later definition/options identities are ignored. */
export function useValixa<const S extends BlueprintInput>(input: S | Blueprint<S>, options?: FormOptions<InferValues<S>>): ValixaForm<InferValues<S>> {
  const [form] = useState(() => createValixa(input, options));
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    return () => {
      // Strict Mode replays setup before this runs; only a real unmount disposes.
      queueMicrotask(() => { if (generation.current === current) form.dispose(); });
    };
  }, [form]);
  return form;
}

/** Deliberately broad internal context; typed consumers must supply their value shape. */
const FormContext = createContext<ValixaForm<Record<string, unknown>> | null>(null);
export function ValixaProvider<V extends Record<string, unknown>>({ form, children }: { form: ValixaForm<V>; children: ReactNode }) {
  // Only the stable store crosses context; the provider never owns/disposes it.
  return createElement(FormContext.Provider, { value: form as unknown as ValixaForm<Record<string, unknown>> }, children);
}
export function useValixaContext<V extends Record<string, unknown>>(): ValixaForm<V> {
  const form = useContext(FormContext);
  if (!form) throw new Error('useValixaContext requires a ValixaProvider');
  return form as unknown as ValixaForm<V>;
}

/** Explicit whole-form subscription. Prefer field subscriptions for input components. */
export function useValixaState<V extends Record<string, unknown>>(form: ValixaForm<V>): FormState<V> {
  return useSyncExternalStore(form.subscribe, form.getSnapshot, form.getSnapshot);
}

export interface FieldBinding<T> {
  readonly name: string;
  readonly id: string;
  readonly errorId: string;
  readonly state: FieldState<T>;
  readonly error: string | undefined;
  /** User-originated writes respect disabled/readonly; core programmatic writes do not. */
  readonly setValue: (value: T) => void;
  readonly onBlur: () => void;
}

export function useValixaField<V extends Record<string, unknown>, K extends FieldName<V>>(form: ValixaForm<V>, name: K): FieldBinding<FieldValue<V, K>> {
  const reactId = useId();
  const subscribe = useCallback((listener: () => void) => form.subscribeField(name, listener), [form, name]);
  const getSnapshot = useCallback(() => form.getFieldState(name), [form, name]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setValue = useCallback((value: FieldValue<V, K>) => {
    const current = form.getFieldState(name);
    if (!current.disabled && !current.readonly) form.setValue(name, value);
  }, [form, name]);
  const onBlur = useCallback(() => { form.setTouched(name); }, [form, name]);
  return useMemo(() => ({ name, id: `valixa-${reactId}`, errorId: `valixa-${reactId}-error`, state,
    error: state.errors[0], setValue, onBlur }), [name, reactId, state, setValue, onBlur]);
}

/** Explicit, reusable adapter registration. Mapping functions must be pure (no hooks). */
export interface FieldAdapter<T, P extends object> { readonly map: (field: FieldBinding<T>) => P }
export function defineAdapter<T, P extends object>(map: (field: FieldBinding<T>) => P): FieldAdapter<T, P> {
  return Object.freeze({ map });
}
export type CompatibleFieldName<V, T> = {
  [K in FieldName<V>]: [FieldValue<V, K>] extends [T] ? [T] extends [FieldValue<V, K>] ? K : never : never
}[FieldName<V>];
export function useValixaAdapter<V extends Record<string, unknown>, T, P extends object>(
  form: ValixaForm<V>, name: CompatibleFieldName<V, T>, adapter: FieldAdapter<T, P>
): P {
  const field = useValixaField(form, name);
  return adapter.map(field as unknown as FieldBinding<T>);
}

/** Creates a field-subscribing component. Bound props cannot be overridden by callers. */
export function connectValixa<T, P extends object, B extends Partial<P>>(Component: ComponentType<P>, adapter: FieldAdapter<T, B>) {
  return function ValixaConnected<V extends Record<string, unknown>>(
    props: Omit<P, keyof B> & { form: ValixaForm<V>; name: CompatibleFieldName<V, T> }
  ) {
    const { form, name, ...rest } = props;
    const bound = useValixaAdapter(form, name, adapter);
    return createElement(Component, { ...rest, ...bound } as unknown as P);
  };
}

/** Native text controls. Number/checkbox/custom payloads use explicit typed adapters. */
export const nativeText = defineAdapter<string, {
  id: string; name: string; value: string; disabled: boolean; readOnly: boolean;
  onChange: (event: { target: { value: string } }) => void; onBlur: () => void;
  'aria-invalid': boolean; 'aria-describedby': string | undefined;
}>(field => ({
  id: field.id, name: field.name, value: field.state.value ?? '', disabled: field.state.disabled, readOnly: field.state.readonly,
  onChange: event => field.setValue(event.target.value), onBlur: field.onBlur,
  'aria-invalid': Boolean(field.error), 'aria-describedby': field.error ? field.errorId : undefined
}));
