import { Blueprint, blueprint } from './blueprint.js';
import { configuration, copy, equal, freeze } from './data.js';
import { BehaviorEngine } from './behaviors.js';
import { FieldCollection } from './collection.js';
import { writePath } from './paths.js';
import { renderError } from './locales.js';
import type { ValidationErrorDetail } from './locales.js';
import { checkRule } from './rules.js';
import type {
  BlueprintInput, DeepReadonly, Errors, FieldName, FieldState, FormOptions, FormState,
  CollectionBlueprint, CollectionName, FieldValue, FormValidationErrors, InferValues, SubmitHandler, SubmitResult, ValidationResult, ValuesPatch
} from './types.js';

type Listener = () => void;
const noErrors: readonly string[] = Object.freeze([]);

/** A synchronous external store with asynchronous, versioned validation. */
export class ValixaForm<V extends Record<string, unknown>> {
  private values: Record<string, unknown>;
  private readonly initial: Record<string, unknown>;
  private readonly initialSnapshot: DeepReadonly<V>;
  private errors: Partial<Record<FieldName<V>, readonly string[]>> = Object.create(null);
  private touched: Record<FieldName<V>, boolean>;
  private pending = new Set<FieldName<V>>();
  private listeners = new Set<Listener>();
  private fieldListeners = new Map<FieldName<V>, Set<Listener>>();
  private fieldSnapshots = new Map<FieldName<V>, FieldState<FieldValue<V, FieldName<V>>>>();
  private snapshot!: FormState<V>;
  private revision = 0;
  private jobs = new Map<FieldName<V>, AbortController>();
  private scheduled = new Map<FieldName<V>, ReturnType<typeof setTimeout>>();
  private submitController: AbortController | undefined;
  private submitting = false;
  private submitted = false;
  private submitCount = 0;
  private disabled: boolean;
  private readonlyFlag: boolean;
  private disposed = false;
  private readonly names: FieldName<V>[];
  private readonly options: FormOptions;
  private readonly behaviors: BehaviorEngine;
  private readonly collections = new Map<string, FieldCollection<any>>();
  private readonly controls = new Map<string, unknown>();
  private locale: string;
  private details: Partial<Record<FieldName<V>, readonly ValidationErrorDetail[]>> = Object.create(null);
  private formFieldErrors: Partial<Record<FieldName<V>, readonly string[]>> = Object.create(null);
  private formWideDetails: readonly ValidationErrorDetail[] = [];
  private formJob: AbortController | undefined;
  private formTimer: ReturnType<typeof setTimeout> | undefined;
  private publicationQueued = false;

  constructor(private readonly definition: Blueprint<BlueprintInput>, options: FormOptions = {}, initialValues?: Record<string, unknown>, initializeValidation = true) {
    this.options = configuration(options);
    this.locale = options.locale ?? 'en';
    const { debounce = 0, timeout } = options.validation ?? {};
    if (!Number.isFinite(debounce) || debounce < 0) throw new TypeError('validation.debounce must be a finite nonnegative number');
    if (timeout !== undefined && (!Number.isFinite(timeout) || timeout <= 0)) throw new TypeError('validation.timeout must be a finite positive number');
    this.names = Object.keys(definition.fields) as FieldName<V>[];
    for (const name of options.formDependsOn ?? []) if (!this.names.includes(name as FieldName<V>)) throw new TypeError(`Form validator depends on unknown field ${name}`);
    this.initial = freeze(initialValues === undefined ? Object.fromEntries(this.names.map(name => [name, copy(definition.fields[name]!.initial)])) : { ...Object.fromEntries(this.names.map(name => [name, copy(definition.fields[name]!.initial)])), ...copy(definition.flattenPatch(initialValues)) });
    this.initialSnapshot = freeze(this.definition.inflate(this.initial)) as DeepReadonly<V>;
    this.definition.assertCollections(this.initial);
    this.values = copy(this.initial);
    this.behaviors = new BehaviorEngine(this.options.behaviors ?? {}, this.names, flat => this.definition.inflate(flat));
    this.values = this.behaviors.evaluate(this.values, this.initial);
    this.touched = Object.fromEntries(this.names.map(name => [name, false])) as Record<FieldName<V>, boolean>;
    this.disabled = options.disabled ?? false;
    this.readonlyFlag = options.readonly ?? false;
    for (const [name, itemDefinition] of Object.entries(definition.collections)) {
      const rowOptions: FormOptions = { ...(options.validation ? { validation: options.validation } : {}), ...(options.validateOn ? { validateOn: options.validateOn } : {}), ...(options.messages ? { messages: options.messages } : {}), locale: this.locale, ...(options.fallbackLocale ? { fallbackLocale: options.fallbackLocale } : {}), ...(options.labels ? { labels: options.labels } : {}) };
      const items = new FieldCollection(itemDefinition as Blueprint<any>, this.values[name] as any[], rowOptions, (values, structure) => {
        if (equal(this.values[name], values)) this.publish();
        else this.writeValues({ [name]: values }, structure ? undefined : name);
      });
      this.collections.set(name, items);
      this.values[name] = copy(items.values);
    }
    this.publish();
    if (initializeValidation && this.mode === 'immediate') { this.schedule(this.names); this.scheduleForm(); }
  }
  private assertActive(): void { if (this.disposed) throw new Error('Form has been disposed'); }
  private assertField(name: FieldName<V>): void {
    if (!Object.hasOwn(this.definition.fields, name)) throw new TypeError(`Unknown field: ${name}`);
  }
  private invalidate(names: Iterable<FieldName<V>> = this.names, includeForm = true): void {
    this.revision++;
    for (const name of names) this.cancelField(name);
    if (includeForm) this.cancelForm();
  }
  private cancelForm(): void {
    if (this.formTimer !== undefined) clearTimeout(this.formTimer);
    this.formTimer = undefined; const job = this.formJob; this.formJob = undefined; job?.abort();
  }
  private scheduleForm(): void {
    if (!this.options.validateForm) return;
    this.cancelForm(); const delay = this.options.validation?.debounce ?? 0;
    if (!delay) { void this.validateForm(); return; }
    this.formTimer = setTimeout(() => { this.formTimer = undefined; void this.validateForm(); }, delay); this.publish();
  }
  private cancelField(name: FieldName<V>): void {
    const timer = this.scheduled.get(name);
    if (timer !== undefined) clearTimeout(timer);
    this.scheduled.delete(name);
    const job = this.jobs.get(name); this.jobs.delete(name); job?.abort();
    this.pending.delete(name);
  }
  private get mode(): string {
    return this.options.validation?.mode ?? (this.options.validateOn === 'change' ? 'onChange' : this.options.validateOn === 'blur' ? 'onBlur' : 'manual');
  }
  private schedule(names: Iterable<FieldName<V>>): void {
    const targets = [...names]; if (!targets.length) return;
    const delay = this.options.validation?.debounce ?? 0;
    if (!delay) { void this.validateFields(targets, false); return; }
    for (const name of targets) {
      this.cancelField(name);
      this.scheduled.set(name, setTimeout(() => { this.scheduled.delete(name); void this.validate(name); }, delay));
    }
    this.publish();
  }
  /** Immutable dependency indexes; wildcard custom validators are listed separately. */
  get dependencies() { return this.definition.graph.diagnostics; }
  array<K extends CollectionName<V>>(name: K): FieldCollection<CollectionBlueprint<V, K>> {
    this.assertActive(); const items = this.collections.get(name);
    if (!items) throw new TypeError(`Field ${name} is not an explicit collection`);
    return items as unknown as FieldCollection<CollectionBlueprint<V, K>>;
  }
  cancelValidation(): void { if (this.disposed) return; this.invalidate(); for (const items of this.collections.values()) items.cancelValidation(); this.publish(); }
  setLocale(locale: string): void {
    this.assertActive(); if (this.locale === locale) return; this.locale = locale;
    for (const name of this.names) if (this.details[name]) this.errors[name] = freeze(this.details[name]!.map(detail => this.translate(detail)));
    for (const items of this.collections.values()) items.setLocale(locale);
    this.publish();
  }
  private translate(detail: ValidationErrorDetail): string { return renderError(detail, this.locale, this.options.fallbackLocale ?? 'en', this.options.messages, this.options.labels); }
  private publishValidation(): void {
    if (this.publicationQueued) return; this.publicationQueued = true;
    void Promise.resolve().then(() => { this.publicationQueued = false; if (!this.disposed) this.publish(); });
  }
  private publish(): void {
    const flatValues = freeze(copy(this.values));
    const values = (this.definition.flat ? flatValues : freeze(this.definition.inflate(flatValues))) as DeepReadonly<V>;
    const projectedErrors = Object.assign(Object.create(null), this.errors) as Record<string, readonly string[]>;
    for (const [name, messages] of Object.entries(this.formFieldErrors)) projectedErrors[name] = [...(projectedErrors[name] ?? []), ...(messages as readonly string[])];
    for (const [name, items] of this.collections) if (this.behaviors.get(name)?.validate !== false && items.errors.length) projectedErrors[name] = [...(projectedErrors[name] ?? []), ...items.errors];
    const errors = freeze(projectedErrors) as Errors<V>;
    const dirty = !equal(this.values, this.initial);
    const formErrors = freeze(this.formWideDetails.map(detail => this.translate(detail)));
    const invalid = formErrors.length > 0 || Object.values(errors).some(messages => (messages as readonly string[]).length > 0);
    const touched = freeze({ ...this.touched });
    const dirtyFields = Object.fromEntries(this.names.map(name => [name, !equal(this.values[name], this.initial[name])]));
    const simple = this.definition.flat && !this.collections.size;
    const nestedErrors = simple ? projectedErrors : this.definition.inflate(projectedErrors), nestedTouched = simple ? touched : this.definition.inflate(this.touched), nestedDirty = simple ? dirtyFields : this.definition.inflate(dirtyFields);
    for (const [name, items] of this.collections) {
      const behavior = this.behaviors.get(name); items.setFlags(this.disabled || behavior?.enabled === false, this.readonlyFlag || behavior?.readonly === true);
      const path = this.definition.paths[name]!;
      writePath(nestedErrors, path, behavior?.validate === false ? items.items.map(() => ({})) : copy(items.nestedErrors)); writePath(nestedTouched, path, copy(items.nestedTouched)); writePath(nestedDirty, path, copy(items.nestedDirty));
    }
    const errorDetails = Object.assign(Object.create(null), this.details) as Partial<Record<FieldName<V>, readonly ValidationErrorDetail[]>>;
    for (const [field, messages] of Object.entries(this.formFieldErrors)) errorDetails[field as FieldName<V>] = [...(errorDetails[field as FieldName<V>] ?? []), ...(messages as readonly string[]).map(message => ({ code: 'custom', field, label: this.definition.fields[field]!.label, param: '', source: 'form' as const, message }))];
    this.snapshot = Object.freeze({ values, initialValues: this.initialSnapshot, errors,
      locale: this.locale, errorDetails: freeze(errorDetails), formErrors,
      nestedErrors: freeze(nestedErrors), nestedTouched: freeze(nestedTouched), nestedDirty: freeze(nestedDirty),
      touched, dirty, pristine: !dirty, valid: !invalid, invalid,
      validating: this.formJob !== undefined || this.pending.size > 0 || [...this.collections.values()].some(items => items.validating), pending: this.formJob !== undefined || this.formTimer !== undefined || this.pending.size > 0 || this.scheduled.size > 0 || [...this.collections.values()].some(items => items.pending), submitting: this.submitting, submitted: this.submitted,
      submitCount: this.submitCount, disabled: this.disabled, readonly: this.readonlyFlag });
    const changed: FieldName<V>[] = [];
    for (const name of this.names) {
      const behavior = this.behaviors.get(name);
      const next: FieldState<FieldValue<V, FieldName<V>>> = Object.freeze({ value: flatValues[name] as DeepReadonly<FieldValue<V, FieldName<V>>>, initialValue: this.initial[name] as DeepReadonly<FieldValue<V, FieldName<V>>>,
        errors: projectedErrors[name] ?? noErrors, touched: this.touched[name], dirty: !equal(this.values[name], this.initial[name]),
        visible: behavior?.visible ?? true, required: behavior?.required === true || this.definition.fields[name]!.rules.some(rule => rule.name === 'required'), validationEnabled: behavior?.validate ?? true,
        validating: this.pending.has(name) || this.collections.get(name)?.validating === true, pending: this.pending.has(name) || this.scheduled.has(name) || this.collections.get(name)?.pending === true, disabled: this.disabled || behavior?.enabled === false, readonly: this.readonlyFlag || behavior?.readonly === true });
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
  getFieldState<K extends FieldName<V>>(name: K): FieldState<FieldValue<V, K>> {
    this.assertField(name); return this.fieldSnapshots.get(name)! as FieldState<FieldValue<V, K>>;
  }
  field<K extends FieldName<V>>(name: K): {
    readonly name: K; readonly state: FieldState<FieldValue<V, K>>;
    readonly setValue: (value: FieldValue<V, K>) => void; readonly onBlur: () => void;
    readonly subscribe: (listener: Listener) => () => void;
  } {
    this.assertActive(); this.assertField(name);
    const cached = this.controls.get(name); if (cached) return cached as ReturnType<typeof this.field<K>>;
    const form = this;
    const control = Object.freeze({ name, get state() { return form.getFieldState(name); },
      setValue: (value: FieldValue<V, K>) => form.setValue(name, value), onBlur: () => form.setTouched(name),
      subscribe: (listener: Listener) => form.subscribeField(name, listener) });
    this.controls.set(name, control); return control;
  }
  subscribeField<K extends FieldName<V>>(name: K, listener: Listener): () => void {
    this.assertActive(); this.assertField(name);
    let listeners = this.fieldListeners.get(name);
    if (!listeners) { listeners = new Set(); this.fieldListeners.set(name, listeners); }
    listeners.add(listener);
    return () => { listeners.delete(listener); if (!listeners.size) this.fieldListeners.delete(name); };
  }
  setValue<K extends FieldName<V>>(name: K, value: FieldValue<V, K>): void {
    this.assertField(name); this.writeValues({ [name]: value });
  }
  /** One notification batch; programmatic writes remain allowed when readonly/disabled. */
  setValues(patch: ValuesPatch<V>): void { this.writeValues(patch); }
  private writeValues(patch: Readonly<Record<string, unknown>>, rowOwnedValidation?: string): void {
    this.assertActive();
    const flatPatch = this.definition.flattenPatch(patch);
    const entries = Object.entries(flatPatch) as [FieldName<V>, unknown][];
    for (const [name] of entries) this.assertField(name);
    this.definition.assertCollections(flatPatch);
    let next = copy({ ...this.values, ...flatPatch });
    if (equal(next, this.values)) return;
    next = this.behaviors.evaluate(next, this.initial, new Set(entries.map(([name]) => name)));
    const changed = (this.behaviors.configured ? this.names : entries.map(([name]) => name)).filter(name => !equal(next[name], this.values[name]));
    const affected = new Set(this.definition.graph.affected(changed)) as Set<FieldName<V>>;
    for (const name of this.behaviors.configured ? this.names : []) {
      const behavior = this.behaviors.get(name), old = this.fieldSnapshots.get(name);
      if (old && (old.required !== (behavior?.required === true || this.definition.fields[name]!.rules.some(rule => rule.name === 'required')) || old.validationEnabled !== (behavior?.validate ?? true))) affected.add(name);
    }
    const affectsForm = this.options.formDependsOn === undefined || this.options.formDependsOn.some(name => changed.includes(name as FieldName<V>));
    this.invalidate(affected, affectsForm); this.values = next;
    for (const [name, items] of this.collections) if (!equal(next[name], items.values)) {
      if (!Array.isArray(next[name])) throw new TypeError(`Collection ${name} requires an array`);
      items.synchronize(next[name] as any[]);
    }
    for (const name of affected) { delete this.errors[name]; delete this.details[name]; }
    if (affectsForm) { this.formFieldErrors = Object.create(null); this.formWideDetails = []; }
    this.publish();
    if (this.mode === 'onChange' || this.mode === 'immediate') {
      // A row write schedules its own field closure. The parent schedules only
      // other dependent fields/form constraints; structural edits validate rows.
      this.schedule([...affected].filter(name => name !== rowOwnedValidation)); if (affectsForm) this.scheduleForm();
    }
  }
  setTouched<K extends FieldName<V>>(name: K, touched = true): void {
    this.assertActive(); this.assertField(name);
    if (this.touched[name] !== touched) { this.touched[name] = touched; this.publish(); }
    if (touched && this.mode === 'onBlur') { this.schedule([name]); if (this.options.formDependsOn === undefined || this.options.formDependsOn.includes(name)) this.scheduleForm(); }
  }
  setAllTouched(touched = true): void {
    this.assertActive(); for (const name of this.names) this.touched[name] = touched;
    for (const items of this.collections.values()) items.setAllTouched(touched); this.publish();
  }
  setError<K extends FieldName<V>>(name: K, message: string | readonly string[]): void {
    this.assertActive(); this.assertField(name); this.invalidate();
    this.errors[name] = freeze(typeof message === 'string' ? [message] : [...message]);
    this.details[name] = freeze(this.errors[name]!.map(message => ({ code: 'server', field: name, label: this.definition.fields[name]!.label, param: '', source: 'server', message })));
    delete this.formFieldErrors[name]; this.publish();
  }
  clearErrors(name?: FieldName<V>): void {
    this.assertActive(); if (name !== undefined) this.assertField(name); this.invalidate();
    if (name === undefined) { this.errors = Object.create(null); this.details = Object.create(null); this.formFieldErrors = Object.create(null); this.formWideDetails = []; }
    else { delete this.errors[name]; delete this.details[name]; delete this.formFieldErrors[name]; } this.publish();
    for (const [collection, items] of this.collections) if (name === undefined || collection === name) items.clearErrors();
  }
  setDisabled(disabled: boolean): void {
    this.assertActive(); if (this.disabled === disabled) return; this.disabled = disabled; this.publish();
  }
  setReadonly(readonly: boolean): void {
    this.assertActive(); if (this.readonlyFlag === readonly) return; this.readonlyFlag = readonly; this.publish();
  }
  private message(rule: string, label: string, param = ''): string {
    return this.translate({ code: rule, field: label, label, param, source: 'field' });
  }
  /** Fresh field-scoped validation. Independent requests may run concurrently. */
  async validate(name?: FieldName<V>): Promise<ValidationResult<V>> {
    this.assertActive(); if (name !== undefined) this.assertField(name);
    return this.validateFields(name === undefined ? this.names : [name], name === undefined);
  }
  private async validateFields(names: readonly FieldName<V>[], includeForm: boolean): Promise<ValidationResult<V>> {
    const flatValues = freeze(copy(this.values));
    const values = freeze(this.definition.inflate(flatValues));
    // Install all owners before notifying observers.
    const owners = names.map(field => {
      this.cancelField(field); const controller = new AbortController();
      this.jobs.set(field, controller); this.pending.add(field); return { field, controller };
    });
    this.publish();
    const formValidation = includeForm ? this.validateForm() : Promise.resolve(true);
    const results = await Promise.all(owners.map(async ({ field, controller }) => {
      const config = this.definition.fields[field]!;
      const context = { values, field, signal: controller.signal };
      const messages: string[] = [];
      const details: ValidationErrorDetail[] = [];
      const add = (code: string, param = '', message?: string) => {
        const detail: ValidationErrorDetail = { code, field, label: config.label, param, source: 'field', ...(message === undefined ? {} : { message }) };
        details.push(detail); messages.push(this.translate(detail));
      };
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      let onAbort!: () => void;
      const cancelled = new Promise<void>(resolve => {
        onAbort = () => { if (timeout !== undefined) clearTimeout(timeout); resolve(); }; controller.signal.addEventListener('abort', onAbort, { once: true });
        if (controller.signal.aborted) resolve();
      });
      const work = async () => {
        if (this.behaviors.get(field)?.validate === false) return;
        const items = this.collections.get(field); if (items) await items.validate(controller.signal);
        if (this.behaviors.get(field)?.required && !config.rules.some(rule => rule.name === 'required') && !checkRule({ name: 'required' }, flatValues[field], context)) add('required');
        for (const rule of config.rules) if (!checkRule(rule, flatValues[field], context)) add(rule.name, rule.param);
        // Skip custom/remote validators when basic constraints fail.
        if (!messages.length) for (const validator of config.validators) {
          if (controller.signal.aborted) break;
          try {
            const result = await validator(flatValues[field], context);
            if (controller.signal.aborted) break;
            if (result === false) add('custom');
            else if (typeof result === 'string') add('custom', '', result);
          } catch {
            if (!controller.signal.aborted) add('exception');
          }
        }
      };
      if (this.options.validation?.timeout !== undefined) {
        timeout = setTimeout(() => { timedOut = true; controller.abort(); }, this.options.validation.timeout);
      }
      await Promise.race([work(), cancelled]);
      if (timeout !== undefined) clearTimeout(timeout);
      controller.signal.removeEventListener('abort', onAbort);
      const owns = !this.disposed && this.jobs.get(field) === controller;
      if (!owns || (controller.signal.aborted && !timedOut)) return false;
      if (timedOut) { messages.length = 0; details.length = 0; add('timeout'); }
      this.jobs.delete(field); this.pending.delete(field);
      if (messages.length) { this.details[field] = freeze(details); this.errors[field] = freeze(details.map(detail => this.translate(detail))); }
      else { delete this.errors[field]; delete this.details[field]; }
      this.publishValidation();
      return true;
    }));
    if (!(await formValidation) || results.some(result => !result)) return { valid: false, errors: this.snapshot.errors, stale: true };
    return { valid: this.snapshot.valid, errors: this.snapshot.errors, stale: false };
  }
  private async validateForm(): Promise<boolean> {
    if (!this.options.validateForm) return true;
    this.cancelForm(); const controller = new AbortController(); this.formJob = controller;
    const values = freeze(this.definition.inflate(this.values)); this.publish();
    let onAbort!: () => void; let timeout: ReturnType<typeof setTimeout> | undefined; let timedOut = false;
    const cancelled = new Promise<undefined>(resolve => { onAbort = () => { if (timeout !== undefined) clearTimeout(timeout); resolve(undefined); }; controller.signal.addEventListener('abort', onAbort, { once: true }); });
    let failed = false;
    const work: Promise<FormValidationErrors | undefined> = Promise.resolve().then(() => controller.signal.aborted ? undefined : this.options.validateForm!(values, { signal: controller.signal })).catch(() => { failed = true; return {}; });
    if (this.options.validation?.timeout !== undefined) timeout = setTimeout(() => { timedOut = true; controller.abort(); }, this.options.validation.timeout);
    const result = await Promise.race([work, cancelled]);
    if (timeout !== undefined) clearTimeout(timeout); controller.signal.removeEventListener('abort', onAbort);
    if (this.disposed || this.formJob !== controller || (controller.signal.aborted && !timedOut)) return false;
    this.formJob = undefined; this.formFieldErrors = Object.create(null); this.formWideDetails = [];
    if (timedOut) this.formWideDetails = [{ code: 'timeout', field: '$form', label: 'Form', param: '', source: 'form' }];
    else if (failed) this.formWideDetails = [{ code: 'exception', field: '$form', label: 'Form', param: '', source: 'form' }];
    else for (const [name, value] of Object.entries(result ?? {})) {
      if (value === undefined) continue;
      const messages = typeof value === 'string' ? [value] : [...value];
      if (name === '$form' && !this.names.includes(name as FieldName<V>)) this.formWideDetails = freeze(messages.map(message => ({ code: 'custom', field: '$form', label: 'Form', param: '', source: 'form', message })));
      else if (this.names.includes(name as FieldName<V>)) this.formFieldErrors[name as FieldName<V>] = freeze(messages);
      else { this.formWideDetails = [{ code: 'exception', field: '$form', label: 'Form', param: '', source: 'form', message: `Form validator returned unknown field: ${name}` }]; }
    }
    this.publish(); return true;
  }
  /** Executes immediately. Use handleSubmit() to obtain an event callback. */
  async submit<R>(handler: SubmitHandler<V, R>): Promise<SubmitResult<V, R>> {
    this.assertActive();
    if (this.submitting) return { status: 'busy' };
    if (this.disabled) return { status: 'cancelled' };
    const controller = new AbortController(); this.submitController = controller;
    this.submitting = true; this.submitted = false; this.submitCount++;
    for (const name of this.names) this.touched[name] = true;
    for (const items of this.collections.values()) items.setAllTouched(true);
    this.publish();
    const revision = this.revision;
    try {
      const validation = await this.validate();
      if (controller.signal.aborted) return { status: 'cancelled' };
      if (validation.stale || revision !== this.revision) return { status: 'stale' };
      if (!validation.valid) return { status: 'invalid', errors: validation.errors };
      const data = await handler(this.definition.inflate(this.values) as V, { signal: controller.signal });
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
    this.values = this.behaviors.evaluate(copy(this.initial), this.initial, undefined, true); this.errors = Object.create(null); this.details = Object.create(null); this.formFieldErrors = Object.create(null); this.formWideDetails = []; this.submitted = false; this.submitCount = 0;
    for (const items of this.collections.values()) items.reset();
    for (const name of this.names) this.touched[name] = false;
    this.publish();
  }
  /** Idempotent; aborts work, clears subscriptions, and rejects future mutations. */
  dispose(): void {
    if (this.disposed) return;
    this.submitController?.abort(); this.invalidate(); this.submitting = false;
    for (const items of this.collections.values()) items.dispose();
    this.listeners.clear(); this.fieldListeners.clear(); this.disposed = true; this.publish();
  }
}

export function createValixa<const S extends BlueprintInput>(input: S | Blueprint<S>, options: FormOptions<InferValues<S>> = {}): ValixaForm<InferValues<S>> {
  const definition = input instanceof Blueprint ? input : blueprint(input);
  return new ValixaForm(definition as Blueprint<BlueprintInput>, options);
}
