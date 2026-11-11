import type { CollectionName, FieldValue, ValuesPatch } from '@valixa/core';
import { APP_ID, DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import { createValixa as createCore } from '@valixa/core';
import type { Blueprint, BlueprintInput, DeepReadonly, FieldName, FieldState, FormOptions, FormState, InferValues, SubmitHandler, ValixaForm } from '@valixa/core';

@Injectable({ providedIn: 'root' })
export class ValixaIds { private next = 0; private readonly app = inject(APP_ID); create(): string { return `${this.app}-valixa-${++this.next}`; } }
export interface AngularFormOptions<V = any> extends FormOptions<V> { readonly id?: string; readonly destroyRef?: DestroyRef }
export interface AngularField<T> {
  readonly name: string; readonly id: string; readonly errorId: string;
  readonly state: Signal<FieldState<T>>;
  readonly value: Signal<DeepReadonly<T>>;
  readonly error: Signal<string | undefined>;
  readonly setValue: (value: T) => void;
  readonly onBlur: () => void;
}

/** Owns signal projections and subscriptions; the supplied DestroyRef owns this bridge. */
export class AngularForm<V extends Record<string, unknown>> {
  readonly state: Signal<FormState<V>>;
  readonly submitting: Signal<boolean>;
  readonly validating: Signal<boolean>;
  readonly valid: Signal<boolean>;
  readonly submitCount: Signal<number>;
  private readonly fields = new Map<FieldName<V>, AngularField<FieldValue<V, FieldName<V>>>>();
  private readonly cleanup: (() => void)[] = [];
  private disposed = false;
  constructor(readonly core: ValixaForm<V>, readonly id: string, destroyRef: DestroyRef, private readonly ownsCore = true) {
    const state = signal(core.getSnapshot());
    this.state = state.asReadonly();
    this.cleanup.push(core.subscribe(() => state.set(core.getSnapshot())));
    this.submitting = computed(() => state().submitting); this.validating = computed(() => state().validating);
    this.valid = computed(() => state().valid); this.submitCount = computed(() => state().submitCount);
    destroyRef.onDestroy(() => this.dispose());
  }
  field<K extends FieldName<V>>(name: K): AngularField<FieldValue<V, K>> {
    if (this.disposed) throw new Error('Angular form has been disposed');
    const cached = this.fields.get(name);
    if (cached) return cached as AngularField<FieldValue<V, K>>;
    const snapshot = signal(this.core.getFieldState(name));
    this.cleanup.push(this.core.subscribeField(name, () => snapshot.set(this.core.getFieldState(name))));
    const field: AngularField<FieldValue<V, K>> = Object.freeze({ name, id: `${this.id}-${name}`, errorId: `${this.id}-${name}-error`, state: snapshot.asReadonly(),
      value: computed(() => snapshot().value), error: computed(() => snapshot().errors[0]),
      setValue: (value: FieldValue<V, K>) => { const current = this.core.getFieldState(name); if (!current.disabled && !current.readonly) this.core.setValue(name, value); },
      onBlur: () => this.core.setTouched(name) });
    this.fields.set(name, field as AngularField<FieldValue<V, FieldName<V>>>); return field;
  }
  error<K extends FieldName<V>>(name: K): string | undefined { return this.field(name).error(); }
  setValue<K extends FieldName<V>>(name: K, value: FieldValue<V, K>): void { this.core.setValue(name, value); }
  setValues(values: ValuesPatch<V>): void { this.core.setValues(values); }
  setError<K extends FieldName<V>>(name: K, error: string | readonly string[]): void { this.core.setError(name, error); }
  clearErrors(name?: FieldName<V>): void { this.core.clearErrors(name); }
  setTouched<K extends FieldName<V>>(name: K, touched = true): void { this.core.setTouched(name, touched); }
  setDisabled(value: boolean): void { this.core.setDisabled(value); }
  setReadonly(value: boolean): void { this.core.setReadonly(value); }
  setLocale(locale: string): void { this.core.setLocale(locale); }
  array<K extends CollectionName<V>>(name: K) { return this.core.array(name); }
  cancelValidation(): void { this.core.cancelValidation(); }
  get dependencies() { return this.core.dependencies; }
  validate(name?: FieldName<V>) { return this.core.validate(name); }
  submit<R>(handler: SubmitHandler<V, R>) { return this.core.submit(handler); }
  handleSubmit<R>(handler: SubmitHandler<V, R>) { return this.core.handleSubmit(handler); }
  cancelSubmit(): void { this.core.cancelSubmit(); }
  reset(): void { this.core.reset(); }
  dispose(): void { if (this.disposed) return; this.disposed = true; for (const off of this.cleanup.splice(0)) off(); if (this.ownsCore) this.core.dispose(); }
}

export function createValixa<const S extends BlueprintInput>(input: S | Blueprint<S>, options: AngularFormOptions<InferValues<S>> = {}): AngularForm<InferValues<S>> {
  const destroyRef = options.destroyRef ?? inject(DestroyRef);
  const id = options.id ?? inject(ValixaIds).create();
  const { id: _id, destroyRef: _destroyRef, ...coreOptions } = options;
  return new AngularForm(createCore(input, coreOptions), id, destroyRef);
}
/** Borrow a collection row/external store. DestroyRef releases projections without disposing the store. */
export function bindValixa<V extends Record<string, unknown>>(core: ValixaForm<V>, options: { readonly id?: string; readonly destroyRef?: DestroyRef } = {}): AngularForm<V> {
  return new AngularForm(core, options.id ?? inject(ValixaIds).create(), options.destroyRef ?? inject(DestroyRef), false);
}
