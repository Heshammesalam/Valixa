import type { FieldValue } from 'valixa';
import { computed, customRef, getCurrentInstance, getCurrentScope, inject, markRaw, onMounted, onScopeDispose, provide, shallowReadonly, useId } from 'vue';
import type { ComputedRef, EffectScope, InjectionKey, Ref } from 'vue';
import { createValixa } from 'valixa';
import type { Blueprint, BlueprintInput, FieldName, FieldState, FormOptions, FormState, InferValues, ValixaForm } from 'valixa';

function requireScope(): EffectScope {
  const scope = getCurrentScope();
  if (!scope) throw new Error('Valixa composables require an active Vue effect scope or component setup');
  return scope;
}

/** Creates one raw form; its scope owns disposal. Reinitialize with an explicit owner remount. */
export function useValixa<const S extends BlueprintInput>(input: S | Blueprint<S>, options?: FormOptions<InferValues<S>>): ValixaForm<InferValues<S>> {
  requireScope();
  const form = markRaw(createValixa(input, options));
  onScopeDispose(() => form.dispose());
  return form;
}

const scopes = new WeakMap<EffectScope, WeakMap<object, Map<string | symbol, Readonly<Ref<unknown>>>>>();
const wholeForm = Symbol('form');
/** Raw reads avoid deep proxies and remain fresh during setup/SSR, before mount subscriptions. */
function project<T>(store: object, key: string | symbol, read: () => T, subscribe: (listener: () => void) => () => void): Readonly<Ref<T>> {
  const scope = requireScope();
  let stores = scopes.get(scope);
  if (!stores) { stores = new WeakMap(); scopes.set(scope, stores); }
  let cache = stores.get(store);
  if (!cache) { cache = new Map(); stores.set(store, cache); }
  const existing = cache.get(key);
  if (existing) return existing as Readonly<Ref<T>>;
  let off: (() => void) | undefined;
  let active = true;
  let last = read();
  let notify = () => {};
  const projection = customRef<T>((track, trigger) => {
    notify = () => { const next = read(); if (next !== last) { last = next; trigger(); } };
    return {
      get() { track(); last = read(); return last; },
      set() { throw new TypeError('Valixa projections are read-only'); }
    };
  });
  const start = () => { if (active && !off) { off = subscribe(notify); notify(); } };
  if (getCurrentInstance()) onMounted(start); else start();
  onScopeDispose(() => { active = false; off?.(); cache.delete(key); });
  const result = shallowReadonly(projection);
  cache.set(key, result);
  return result;
}

export function useValixaState<V extends Record<string, unknown>>(form: ValixaForm<V>): Readonly<Ref<FormState<V>>> {
  return project(form, wholeForm, form.getSnapshot, form.subscribe);
}
export interface VueField<T> {
  readonly name: string;
  readonly id: string;
  readonly state: Readonly<Ref<FieldState<T>>>;
  readonly setValue: (value: T) => void;
  readonly onBlur: () => void;
}
let scopeId = 0;
export function useValixaField<V extends Record<string, unknown>, K extends FieldName<V>>(form: ValixaForm<V>, name: K): VueField<FieldValue<V, K>> {
  requireScope();
  const state = project(form, name, () => form.getFieldState(name), listener => form.subscribeField(name, listener));
  const id = `valixa-vue-${getCurrentInstance() ? useId() : `scope-${++scopeId}`}`;
  return Object.freeze({ name, id, state,
    setValue(value: FieldValue<V, K>) {
      const current = form.getFieldState(name);
      if (!current.disabled && !current.readonly) form.setValue(name, value);
    },
    onBlur() { form.setTouched(name); }
  });
}

export type ValixaKey<V extends Record<string, unknown>> = InjectionKey<ValixaForm<V>>;
export function createValixaKey<V extends Record<string, unknown>>(description = 'Valixa'): ValixaKey<V> { return Symbol(description); }
export function provideValixa<V extends Record<string, unknown>>(key: ValixaKey<V>, form: ValixaForm<V>): void {
  if (!getCurrentInstance()) throw new Error('provideValixa requires component setup');
  provide(key, form);
}
export function injectValixa<V extends Record<string, unknown>>(key: ValixaKey<V>): ValixaForm<V> {
  if (!getCurrentInstance()) throw new Error('injectValixa requires component setup');
  const form = inject(key);
  if (!form) throw new Error('No Valixa form was provided for this key');
  return form;
}

/** Explicit adapter registration. Map receives current raw state; callbacks can transform arbitrary payloads. */
export interface VueFieldAdapter<T, P extends object> { readonly map: (field: VueField<T>) => P }
export function defineValixaAdapter<T, P extends object>(map: (field: VueField<T>) => P): VueFieldAdapter<T, P> { return Object.freeze({ map }); }
export type CompatibleFieldName<V, T> = { [K in FieldName<V>]: [FieldValue<V, K>] extends [T] ? [T] extends [FieldValue<V, K>] ? K : never : never }[FieldName<V>];
export function useValixaAdapter<V extends Record<string, unknown>, T, P extends object>(
  form: ValixaForm<V>, name: CompatibleFieldName<V, T>, adapter: VueFieldAdapter<T, P>
): ComputedRef<P> {
  const field = useValixaField(form, name) as unknown as VueField<T>;
  return computed(() => adapter.map(field));
}
export interface NativeTextProps {
  id: string; name: string; value: string; disabled: boolean; readonly: boolean;
  onInput: (event: Event) => void; onBlur: () => void;
  'aria-invalid': boolean; 'aria-describedby': string | undefined;
}
export const nativeText = defineValixaAdapter<string, NativeTextProps>(field => ({
  id: field.id, name: field.name, value: field.state.value.value, disabled: field.state.value.disabled,
  readonly: field.state.value.readonly, onBlur: field.onBlur,
  onInput(event) { const target = event.target; if (target && 'value' in target && typeof target.value === 'string') field.setValue(target.value); },
  'aria-invalid': field.state.value.errors.length > 0,
  'aria-describedby': field.state.value.errors.length ? `${field.id}-error` : undefined
}));
