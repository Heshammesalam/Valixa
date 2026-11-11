import { Blueprint, blueprint } from './blueprint.js';
import { copy, equal, freeze } from './data.js';
import { checkRule, defaultMessages } from './rules.js';
import type {
  BlueprintInput, DeepReadonly, Errors, FieldName, FieldState, FormOptions, FormState,
  InferValues, SubmitHandler, SubmitResult, ValidationResult
} from './types.js';

type Listener = () => void;
const noErrors: readonly string[] = Object.freeze([]);

/** A synchronous external store with asynchronous, versioned validation. */
export class ValixaForm<V extends Record<string, unknown>> {
  private values: V;
  private readonly initial: V;
  private errors: Partial<Record<FieldName<V>, readonly string[]>> = Object.create(null);
  private touched: Record<FieldName<V>, boolean>;
  private pending = new Set<FieldName<V>>();
  private listeners = new Set<Listener>();
  private fieldListeners = new Map<FieldName<V>, Set<Listener>>();
  private fieldSnapshots = new Map<FieldName<V>, FieldState<V[FieldName<V>]>>();
  private snapshot!: FormState<V>;
  private revision = 0;
  private validationId = 0;
  private validationController: AbortController | undefined;
  private submitController: AbortController | undefined;
  private submitting = false;
  private submitted = false;
  private submitCount = 0;
  private disabled: boolean;
  private readonlyFlag: boolean;
  private disposed = false;
  private readonly names: FieldName<V>[];
  private readonly options: FormOptions;

  constructor(private readonly definition: Blueprint<BlueprintInput>, options: FormOptions = {}) {
    this.options = freeze(copy(options));
    this.names = Object.keys(definition.fields) as FieldName<V>[];
    this.initial = freeze(Object.fromEntries(this.names.map(name => [name, copy(definition.fields[name]!.initial)])) as V);
    this.values = copy(this.initial);
    this.touched = Object.fromEntries(this.names.map(name => [name, false])) as Record<FieldName<V>, boolean>;
    this.disabled = options.disabled ?? false;
    this.readonlyFlag = options.readonly ?? false;
    this.publish();
  }
  private assertActive(): void { if (this.disposed) throw new Error('Form has been disposed'); }
  private assertField(name: FieldName<V>): void {
    if (!Object.hasOwn(this.definition.fields, name)) throw new TypeError(`Unknown field: ${name}`);
  }
  private invalidate(): void {
    this.revision++;
    this.validationId++;
    this.validationController?.abort();
    this.validationController = undefined;
    this.pending.clear();
  }
  private publish(): void {
    const values = freeze(copy(this.values)) as DeepReadonly<V>;
    const errors: Errors<V> = freeze(Object.assign(Object.create(null), this.errors));
    const dirty = !equal(this.values, this.initial);
    const invalid = Object.values(errors).some(messages => (messages as readonly string[]).length > 0);
    this.snapshot = Object.freeze({ values, initialValues: this.initial as DeepReadonly<V>, errors,
      touched: freeze({ ...this.touched }), dirty, pristine: !dirty, valid: !invalid, invalid,
      validating: this.pending.size > 0, submitting: this.submitting, submitted: this.submitted,
      submitCount: this.submitCount, disabled: this.disabled, readonly: this.readonlyFlag });
    const changed: FieldName<V>[] = [];
    for (const name of this.names) {
      const next: FieldState<V[FieldName<V>]> = Object.freeze({ value: values[name] as DeepReadonly<V[FieldName<V>]>, initialValue: this.initial[name] as DeepReadonly<V[FieldName<V>]>,
        errors: this.errors[name] ?? noErrors, touched: this.touched[name], dirty: !equal(this.values[name], this.initial[name]),
        validating: this.pending.has(name), disabled: this.disabled, readonly: this.readonlyFlag });
      if (!equal(next, this.fieldSnapshots.get(name))) { this.fieldSnapshots.set(name, next); changed.push(name); }
    }
    for (const listener of [...this.listeners]) listener();
    for (const name of changed) for (const listener of [...(this.fieldListeners.get(name) ?? [])]) listener();
  }
  /** Stable until the next state transition; suitable for external-store subscriptions. */
  getSnapshot = (): FormState<V> => this.snapshot;
  get state(): FormState<V> { return this.snapshot; }
  /** Subscribe to all transitions. No immediate callback; read getSnapshot() first. */
  subscribe = (listener: Listener): (() => void) => {
    this.assertActive(); this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  };
  getFieldState<K extends FieldName<V>>(name: K): FieldState<V[K]> {
    this.assertField(name); return this.fieldSnapshots.get(name)! as FieldState<V[K]>;
  }
  subscribeField<K extends FieldName<V>>(name: K, listener: Listener): () => void {
    this.assertActive(); this.assertField(name);
    let listeners = this.fieldListeners.get(name);
    if (!listeners) { listeners = new Set(); this.fieldListeners.set(name, listeners); }
    listeners.add(listener);
    return () => { listeners.delete(listener); if (!listeners.size) this.fieldListeners.delete(name); };
  }
  setValue<K extends FieldName<V>>(name: K, value: V[K]): void {
    const patch: Partial<V> = {}; patch[name] = value; this.setValues(patch);
  }
  /** One notification batch; programmatic writes remain allowed when readonly/disabled. */
  setValues(patch: Partial<V>): void {
    this.assertActive();
    const entries = Object.entries(patch) as [FieldName<V>, V[FieldName<V>]][];
    for (const [name] of entries) this.assertField(name);
    const next = copy({ ...this.values, ...patch });
    if (equal(next, this.values)) return;
    this.invalidate(); this.values = next;
    // Existing errors may depend on any value; Phase 1 invalidates them conservatively.
    this.errors = Object.create(null);
    this.publish();
    if (this.options.validateOn === 'change') void this.validate();
  }
  setTouched<K extends FieldName<V>>(name: K, touched = true): void {
    this.assertActive(); this.assertField(name);
    if (this.touched[name] !== touched) { this.touched[name] = touched; this.publish(); }
    if (touched && this.options.validateOn === 'blur') void this.validate(name);
  }
  setError<K extends FieldName<V>>(name: K, message: string | readonly string[]): void {
    this.assertActive(); this.assertField(name); this.invalidate();
    this.errors[name] = freeze(typeof message === 'string' ? [message] : [...message]); this.publish();
  }
  clearErrors(name?: FieldName<V>): void {
    this.assertActive(); if (name !== undefined) this.assertField(name); this.invalidate();
    if (name === undefined) this.errors = Object.create(null); else delete this.errors[name]; this.publish();
  }
  setDisabled(disabled: boolean): void {
    this.assertActive(); if (this.disabled === disabled) return; this.disabled = disabled; this.publish();
  }
  setReadonly(readonly: boolean): void {
    this.assertActive(); if (this.readonlyFlag === readonly) return; this.readonlyFlag = readonly; this.publish();
  }
  private message(rule: string, label: string, param = ''): string {
    const template = this.options.messages?.[rule] ?? defaultMessages[rule] ?? defaultMessages.custom!;
    return template.replace(/\{label\}/g, () => label).replace(/\{param\}/g, () => param);
  }
  /** Validates all fields, or one field. A newer run supersedes any older run. */
  async validate(name?: FieldName<V>): Promise<ValidationResult<V>> {
    this.assertActive(); if (name !== undefined) this.assertField(name);
    this.validationController?.abort();
    const controller = new AbortController(); this.validationController = controller;
    const id = ++this.validationId;
    const names = name === undefined ? this.names : [name];
    const values = freeze(copy(this.values));
    this.pending = new Set(names); this.publish();
    const results = await Promise.all(names.map(async field => {
      const config = this.definition.fields[field]!;
      const context = { values, field, signal: controller.signal };
      const messages: string[] = [];
      for (const rule of config.rules) if (!checkRule(rule, values[field], context)) messages.push(this.message(rule.name, config.label, rule.param));
      // Skip custom/remote validators when basic constraints fail.
      if (!messages.length) for (const validator of config.validators) {
        if (controller.signal.aborted) break;
        try {
          const result = await validator(values[field], context);
          if (result === false) messages.push(this.message('custom', config.label));
          else if (typeof result === 'string') messages.push(result);
        } catch {
          if (!controller.signal.aborted) messages.push(this.message('exception', config.label));
        }
      }
      return [field, freeze(messages)] as const;
    }));
    if (this.disposed || id !== this.validationId || controller.signal.aborted) return { valid: false, errors: this.snapshot.errors, stale: true };
    for (const [field, messages] of results) {
      if (messages.length) this.errors[field] = messages; else delete this.errors[field];
    }
    this.pending.clear(); this.validationController = undefined; this.publish();
    return { valid: this.snapshot.valid, errors: this.snapshot.errors, stale: false };
  }
  /** Executes immediately. Use handleSubmit() to obtain an event callback. */
  async submit<R>(handler: SubmitHandler<V, R>): Promise<SubmitResult<V, R>> {
    this.assertActive();
    if (this.submitting) return { status: 'busy' };
    if (this.disabled) return { status: 'cancelled' };
    const controller = new AbortController(); this.submitController = controller;
    this.submitting = true; this.submitted = false; this.submitCount++;
    for (const name of this.names) this.touched[name] = true;
    this.publish();
    const revision = this.revision;
    try {
      const validation = await this.validate();
      if (controller.signal.aborted) return { status: 'cancelled' };
      if (validation.stale || revision !== this.revision) return { status: 'stale' };
      if (!validation.valid) return { status: 'invalid', errors: validation.errors };
      const data = await handler(copy(this.values), { signal: controller.signal });
      if (controller.signal.aborted) return { status: 'cancelled' };
      this.submitted = true;
      return { status: 'success', data };
    } catch (error) {
      if (controller.signal.aborted) return { status: 'cancelled' };
      throw error;
    } finally {
      this.submitting = false; this.submitController = undefined;
      if (!this.disposed) this.publish();
    }
  }
  handleSubmit<R>(handler: SubmitHandler<V, R>): (event?: { preventDefault(): void }) => Promise<SubmitResult<V, R>> {
    return event => { event?.preventDefault(); return this.submit(handler); };
  }
  cancelSubmit(): void { this.assertActive(); this.submitController?.abort(); this.invalidate(); this.publish(); }
  reset(): void {
    this.assertActive(); this.submitController?.abort(); this.invalidate();
    this.values = copy(this.initial); this.errors = Object.create(null); this.submitted = false; this.submitCount = 0;
    for (const name of this.names) this.touched[name] = false;
    this.publish();
  }
  /** Idempotent; aborts work, clears subscriptions, and rejects future mutations. */
  dispose(): void {
    if (this.disposed) return;
    this.submitController?.abort(); this.invalidate(); this.submitting = false;
    this.listeners.clear(); this.fieldListeners.clear(); this.disposed = true; this.publish();
  }
}

export function createValixa<const S extends BlueprintInput>(input: S | Blueprint<S>, options: FormOptions = {}): ValixaForm<InferValues<S>> {
  const definition = input instanceof Blueprint ? input : blueprint(input);
  return new ValixaForm(definition as Blueprint<BlueprintInput>, options);
}
