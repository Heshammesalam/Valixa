import { Blueprint, blueprint } from './blueprint.js';
import { configuration, copy, equal, freeze, sameRecord, share } from './data.js';
import { BehaviorEngine } from './behaviors.js';
import type { BehaviorState } from './behaviors.js';
import { FieldCollection } from './collection.js';
import { writePath } from './paths.js';
import { renderError } from './locales.js';
import type { ValidationErrorDetail } from './locales.js';
import type { EventObservationOptions, LifecycleEventType, LifecycleObserver } from './events.js';
import { checkRule } from './rules.js';
import type {
  BlueprintInput, DeepReadonly, Errors, FieldName, FieldState, FormOptions, FormState,
  CollectionBlueprint, CollectionName, FieldValue, FormValidationErrors, InferValues, SubmitHandler, SubmitResult, ValidationResult, ValuesPatch
} from './types.js';

type Listener = () => void;
const noErrors: readonly string[] = Object.freeze([]);
/** Cancellation token; native AbortController allocation is lazy until a consumer needs a signal. */
class FieldJob {
  aborted = false;
  private controller: AbortController | undefined;
  onCancel: (() => void) | undefined;
  get signal(): AbortSignal {
    if (!this.controller) { this.controller = new AbortController(); if (this.aborted) this.controller.abort(); }
    return this.controller.signal;
  }
  abort(): void { if (this.aborted) return; this.aborted = true; this.controller?.abort(); this.onCancel?.(); }
}

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
  private jobs = new Map<FieldName<V>, FieldJob>();
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
  private publishedFlat: Readonly<Record<string, unknown>> | undefined;
  private publishedPending = new Set<FieldName<V>>();
  private publishedScheduled = new Set<FieldName<V>>();
  private publishedBehaviors = new Map<string, BehaviorState>();
  private publishedCollections = new Map<string, { pending: boolean; validating: boolean }>();
  private dirtyFields: Readonly<Record<string, boolean>> = Object.freeze({});
  private readonly dirtyNames = new Set<string>();
  private readonly dirtyCandidates = new Set<string>();
  private touchedVersion = 0;
  private publishedTouchedVersion = -1;
  private eventObservers: Set<{ readonly listener: LifecycleObserver; readonly types: ReadonlySet<LifecycleEventType> | undefined }> | undefined;
  private eventSequence = 0;
  private eventRequestSequence = 0;
  private eventRequests: WeakMap<object, number> | undefined;

  constructor(private readonly definition: Blueprint<BlueprintInput>, options: FormOptions = {}, initialValues?: Record<string, unknown>, initializeValidation = true) {
    this.options = configuration(options);
    this.locale = options.locale ?? 'en';
    const { debounce = 0, timeout } = options.validation ?? {};
    if (!Number.isFinite(debounce) || debounce < 0) throw new TypeError('validation.debounce must be a finite nonnegative number');
    if (timeout !== undefined && (!Number.isFinite(timeout) || timeout <= 0)) throw new TypeError('validation.timeout must be a finite positive number');
    this.names = Object.keys(definition.fields) as FieldName<V>[];
    this.dirtyFields = Object.freeze(Object.fromEntries(this.names.map(name => [name, false])));
    for (const name of this.names) this.dirtyCandidates.add(name);
    for (const name of options.formDependsOn ?? []) if (!this.names.includes(name as FieldName<V>)) throw new TypeError(`Form validator depends on unknown field ${name}`);
    this.initial = initialValues === undefined ? definition.initialValues : freeze({ ...definition.initialValues, ...copy(definition.flattenPatch(initialValues)) });
    this.initialSnapshot = this.definition.project(this.initial) as DeepReadonly<V>;
    this.definition.assertCollections(this.initial);
    this.values = Object.keys(definition.collections).length ? { ...this.initial } : this.initial;
    this.behaviors = new BehaviorEngine(this.options.behaviors ?? {}, this.names, flat => this.definition.inflate(flat));
    this.values = this.behaviors.evaluate(this.values, this.initial);
    this.touched = Object.fromEntries(this.names.map(name => [name, false])) as Record<FieldName<V>, boolean>;
    this.disabled = options.disabled ?? false;
    this.readonlyFlag = options.readonly ?? false;
    for (const [name, itemDefinition] of Object.entries(definition.collections)) {
      const rowOptions: FormOptions = { ...(options.validation ? { validation: options.validation } : {}), ...(options.validateOn ? { validateOn: options.validateOn } : {}), ...(options.messages ? { messages: options.messages } : {}), locale: this.locale, ...(options.fallbackLocale ? { fallbackLocale: options.fallbackLocale } : {}), ...(options.labels ? { labels: options.labels } : {}) };
      const items = new FieldCollection(itemDefinition as Blueprint<any>, this.values[name] as any[], rowOptions, (values, structure) => {
        if (this.values[name] === values || equal(this.values[name], values)) this.publish();
        else this.writeValues({ [name]: values }, structure ? undefined : name, true);
      });
      this.collections.set(name, items);
      this.values[name] = items.values;
    }
    this.values = freeze(this.values);
    this.publish();
    if (initializeValidation && this.mode === 'immediate') { this.schedule(this.names); this.scheduleForm(); }
  }
  private assertActive(): void { if (this.disposed) throw new Error('Form has been disposed'); }
  private assertField(name: FieldName<V>): void {
    if (!Object.hasOwn(this.definition.fields, name)) throw new TypeError(`Unknown field: ${name}`);
  }
  private invalidate(names: Iterable<FieldName<V>> = this.names, includeForm = true, reason = 'invalidated'): void {
    this.revision++;
    for (const name of names) this.cancelField(name, reason);
    if (includeForm) this.cancelForm(reason);
  }
  private cancelForm(reason = 'superseded'): void {
    if (this.formTimer !== undefined) { clearTimeout(this.formTimer); this.emitEvent('validation.cancelled', undefined, undefined, `scheduled:${reason}`); }
    this.formTimer = undefined; const job = this.formJob; this.formJob = undefined;
    if (job && !job.signal.aborted) { job.abort(); this.emitEvent('validation.cancelled', undefined, job, reason); }
  }
  private scheduleForm(): void {
    if (!this.options.validateForm) return;
    this.cancelForm(); const delay = this.options.validation?.debounce ?? 0;
    if (!delay) { void this.validateForm(); return; }
    this.formTimer = setTimeout(() => { this.formTimer = undefined; void this.validateForm(); }, delay); this.emitEvent('validation.scheduled', undefined, undefined, 'debounce'); this.publish();
  }
  private cancelField(name: FieldName<V>, reason = 'superseded'): void {
    const timer = this.scheduled.get(name);
    if (timer !== undefined) { clearTimeout(timer); this.emitEvent('validation.cancelled', name, undefined, `scheduled:${reason}`); }
    this.scheduled.delete(name);
    const job = this.jobs.get(name); this.jobs.delete(name);
    if (job && !job.aborted) { job.abort(); this.emitEvent('validation.cancelled', name, job, reason); }
    this.pending.delete(name);
  }
  private get mode(): string {
    return this.options.validation?.mode ?? (this.options.validateOn === 'change' ? 'onChange' : this.options.validateOn === 'blur' ? 'onBlur' : 'manual');
  }
  private schedule(names: Iterable<FieldName<V>>): void {
    const targets = [...names]; if (!targets.length) return;
    const delay = this.options.validation?.debounce ?? 0;
    if (!delay) { if (this.eventObservers) for (const name of targets) this.emitEvent('validation.scheduled', name, undefined, 'immediate'); void this.validateFields(targets, false); return; }
    for (const name of targets) {
      this.cancelField(name);
      this.scheduled.set(name, setTimeout(() => { this.scheduled.delete(name); void this.validate(name); }, delay));
      this.emitEvent('validation.scheduled', name, undefined, 'debounce');
    }
    this.publish();
  }
  /** Immutable dependency indexes; wildcard custom validators are listed separately. */
  get dependencies() { return this.definition.graph.diagnostics; }
  describe() { return this.definition.description; }
  getBehaviorStates(): Readonly<Record<string, BehaviorState>> { return Object.freeze(Object.fromEntries(Object.keys(this.options.behaviors ?? {}).map(name => [name, this.behaviors.get(name)!]))); }
  /** Opt-in value-free real lifecycle events. Observer errors never affect the form. */
  observeEvents(listener: LifecycleObserver, options: EventObservationOptions = {}): () => void {
    this.assertActive(); const observer = { listener, types: options.types ? new Set(options.types) : undefined };
    (this.eventObservers ??= new Set()).add(observer); this.updateCollectionObservers();
    return () => { this.eventObservers?.delete(observer); if (!this.eventObservers?.size) { this.eventObservers = undefined; this.eventRequests = undefined; } this.updateCollectionObservers(); };
  }
  private updateCollectionObservers(): void {
    let interested = false;
    for (const observer of this.eventObservers ?? []) if (!observer.types || [...observer.types].some(type => type.startsWith('collection.'))) { interested = true; break; }
    for (const [name, items] of this.collections) items.setEventObserver(interested ? (type, index, to, key, reason) => this.emitEvent(type, name, undefined, reason, index, to, key) : undefined);
  }
  private emitEvent(type: LifecycleEventType, field?: string, owner?: object, reason?: string, index?: number, to?: number, key?: string): void {
    if (!this.eventObservers?.size) return;
    let interested = false; for (const observer of this.eventObservers) if (!observer.types || observer.types.has(type)) { interested = true; break; }
    if (!interested) return;
    let request: number | undefined;
    if (owner) { const requests = this.eventRequests ??= new WeakMap(); request = requests.get(owner); if (request === undefined) { request = ++this.eventRequestSequence; requests.set(owner, request); } }
    const event = Object.freeze({ sequence: ++this.eventSequence, type, ...(field === undefined ? {} : { field }), ...(request === undefined ? {} : { request }), ...(reason === undefined ? {} : { reason }), ...(index === undefined ? {} : { index }), ...(to === undefined ? {} : { to }), ...(key === undefined ? {} : { key }) });
    for (const observer of [...this.eventObservers]) if (!observer.types || observer.types.has(type)) { try { observer.listener(event); } catch { /* Diagnostic observers must not change engine outcomes. */ } }
  }
  array<K extends CollectionName<V>>(name: K): FieldCollection<CollectionBlueprint<V, K>> {
    this.assertActive(); const items = this.collections.get(name);
    if (!items) throw new TypeError(`Field ${name} is not an explicit collection`);
    return items as unknown as FieldCollection<CollectionBlueprint<V, K>>;
  }
  cancelValidation(): void { if (this.disposed) return; this.invalidate(); for (const items of this.collections.values()) items.cancelValidation(); this.publish(); }
  setLocale(locale: string): void {
    this.assertActive(); if (this.locale === locale) return; this.locale = locale;
    for (const name of this.names) if (this.details[name]) {
      const messages = this.details[name]!.map(detail => this.translate(detail));
      if (!equal(this.errors[name], messages)) {
        if (Object.isFrozen(this.errors)) this.errors = Object.assign(Object.create(null), this.errors);
        this.errors[name] = freeze(messages);
      }
    }
    for (const items of this.collections.values()) items.setLocale(locale);
    this.publish(); this.emitEvent('locale.changed');
  }
  private translate(detail: ValidationErrorDetail): string { return renderError(detail, this.locale, this.options.fallbackLocale ?? 'en', this.options.messages, this.options.labels); }
  private writableErrors(): void {
    if (Object.isFrozen(this.errors)) this.errors = Object.assign(Object.create(null), this.errors);
    if (Object.isFrozen(this.details)) this.details = Object.assign(Object.create(null), this.details);
  }
  private removeError(name: FieldName<V>): void {
    if (!Object.hasOwn(this.errors, name) && !Object.hasOwn(this.details, name)) return;
    this.writableErrors(); delete this.errors[name]; delete this.details[name];
  }
  private publishValidation(): void {
    if (this.publicationQueued) return; this.publicationQueued = true;
    void Promise.resolve().then(() => { this.publicationQueued = false; if (!this.disposed) this.publish(); });
  }
  private publish(): void {
    const previous = this.snapshot;
    const valuesChanged = this.values !== this.publishedFlat;
    const values = (valuesChanged ? this.definition.project(this.values, previous?.values as Readonly<Record<string, unknown>>) : previous.values) as DeepReadonly<V>;
    const combined = Object.keys(this.formFieldErrors).length > 0 || this.collections.size > 0;
    const projectedErrors = (combined ? Object.assign(Object.create(null), this.errors) : this.errors) as Record<string, readonly string[]>;
    for (const [name, messages] of Object.entries(this.formFieldErrors)) projectedErrors[name] = [...(projectedErrors[name] ?? []), ...(messages as readonly string[])];
    if (valuesChanged) {
      const dirtyPatch: Record<string, boolean> = Object.create(null);
      for (const name of this.dirtyCandidates) {
        const dirty = !equal(this.values[name], this.initial[name]);
        if (dirty) this.dirtyNames.add(name); else this.dirtyNames.delete(name);
        if (dirty !== this.dirtyFields[name]) dirtyPatch[name] = dirty;
      }
      if (Object.keys(dirtyPatch).length) this.dirtyFields = Object.freeze({ ...this.dirtyFields, ...dirtyPatch });
    }
    this.dirtyCandidates.clear();
    const simple = this.definition.flat && !this.collections.size;
    const nestedErrorFlat: Record<string, unknown> = simple ? projectedErrors : Object.assign(Object.create(null), projectedErrors);
    const nestedTouchFlat: Record<string, unknown> = simple ? this.touched : { ...this.touched };
    const nestedDirtyFlat: Record<string, unknown> = simple ? this.dirtyFields : { ...this.dirtyFields };
    const collections = new Map<string, { pending: boolean; validating: boolean }>();
    for (const [name, items] of this.collections) {
      const behavior = this.behaviors.get(name);
      items.setFlags(this.disabled || behavior?.enabled === false, this.readonlyFlag || behavior?.readonly === true);
      if (behavior?.validate !== false && items.errors.length) projectedErrors[name] = [...(projectedErrors[name] ?? []), ...items.errors];
      nestedErrorFlat[name] = behavior?.validate === false ? items.items.map(() => ({})) : items.nestedErrors;
      nestedTouchFlat[name] = items.nestedTouched; nestedDirtyFlat[name] = items.nestedDirty;
      collections.set(name, { pending: items.pending, validating: items.validating });
    }
    const errors = (combined ? share(previous?.errors as Readonly<Record<string, readonly string[]>> | undefined, projectedErrors)
      : sameRecord(previous?.errors as Readonly<Record<string, unknown>> | undefined, this.errors) ? previous.errors : Object.freeze(this.errors)) as Errors<V>;
    if (!combined) this.errors = errors as Partial<Record<FieldName<V>, readonly string[]>>;
    const touched = this.publishedTouchedVersion === this.touchedVersion ? previous.touched : share(previous?.touched, this.touched);
    const dirty = this.dirtyNames.size > 0;
    const formErrors = share(previous?.formErrors, this.formWideDetails.map(detail => this.translate(detail)));
    const invalid = formErrors.length > 0 || Object.values(errors).some(messages => (messages as readonly string[]).length > 0);
    const nestedErrors = simple ? errors : this.definition.project(nestedErrorFlat, previous?.nestedErrors);
    const nestedTouched = simple ? touched : this.definition.project(nestedTouchFlat, previous?.nestedTouched);
    const nestedDirty = simple ? this.dirtyFields : this.definition.project(nestedDirtyFlat, previous?.nestedDirty);
    const formDetails = Object.keys(this.formFieldErrors).length > 0;
    const detailMap = (formDetails ? Object.assign(Object.create(null), this.details) : this.details) as Partial<Record<FieldName<V>, readonly ValidationErrorDetail[]>>;
    for (const [field, messages] of Object.entries(this.formFieldErrors)) detailMap[field as FieldName<V>] = [...(detailMap[field as FieldName<V>] ?? []), ...(messages as readonly string[]).map(message => ({ code: 'custom', field, label: this.definition.fields[field]!.label, param: '', source: 'form' as const, message }))];
    const next = Object.freeze({ values, initialValues: this.initialSnapshot, errors,
      locale: this.locale, errorDetails: formDetails ? share(previous?.errorDetails, detailMap) : sameRecord(previous?.errorDetails as Readonly<Record<string, unknown>> | undefined, detailMap) ? previous.errorDetails : Object.freeze(detailMap), formErrors,
      nestedErrors, nestedTouched, nestedDirty,
      touched, dirty, pristine: !dirty, valid: !invalid, invalid,
      validating: this.formJob !== undefined || this.pending.size > 0 || [...collections.values()].some(items => items.validating), pending: this.formJob !== undefined || this.formTimer !== undefined || this.pending.size > 0 || this.scheduled.size > 0 || [...collections.values()].some(items => items.pending), submitting: this.submitting, submitted: this.submitted,
      submitCount: this.submitCount, disabled: this.disabled, readonly: this.readonlyFlag });
    const statusChanged = this.pending.size !== this.publishedPending.size || [...this.pending].some(name => !this.publishedPending.has(name)) || this.scheduled.size !== this.publishedScheduled.size || [...this.scheduled.keys()].some(name => !this.publishedScheduled.has(name));
    this.publishedFlat = this.values;
    this.publishedTouchedVersion = this.touchedVersion;
    this.publishedPending = new Set(this.pending); this.publishedScheduled = new Set(this.scheduled.keys()); this.publishedCollections = collections;
    this.publishedBehaviors = new Map(Object.keys(this.options.behaviors ?? {}).map(name => [name, this.behaviors.get(name)!]));
    this.snapshot = sameRecord(previous as unknown as Record<string, unknown>, next) ? previous : next;
    const changed: FieldName<V>[] = [];
    for (const name of this.fieldListeners.keys()) {
      const old = this.fieldSnapshots.get(name)!;
      const field = this.projectField(name, old);
      if (field !== old) { this.fieldSnapshots.set(name, field); changed.push(name); }
    }
    if (this.snapshot !== previous || statusChanged || changed.length) for (const listener of [...this.listeners]) listener();
    for (const name of changed) for (const listener of [...(this.fieldListeners.get(name) ?? [])]) listener();
  }
  private projectField(name: FieldName<V>, old?: FieldState<FieldValue<V, FieldName<V>>>): FieldState<FieldValue<V, FieldName<V>>> {
    const behavior = this.publishedBehaviors.get(name), collection = this.publishedCollections.get(name);
    const value = this.publishedFlat![name] as DeepReadonly<FieldValue<V, FieldName<V>>>, errors = this.snapshot.errors[name] ?? noErrors;
    const touched = this.snapshot.touched[name], dirty = this.dirtyFields[name] ?? false, visible = behavior?.visible ?? true;
    const required = behavior?.required === true || this.definition.fields[name]!.rules.some(rule => rule.name === 'required'), validationEnabled = behavior?.validate ?? true;
    const validating = this.publishedPending.has(name) || collection?.validating === true, pending = this.publishedPending.has(name) || this.publishedScheduled.has(name) || collection?.pending === true;
    const disabled = this.snapshot.disabled || behavior?.enabled === false, readonly = this.snapshot.readonly || behavior?.readonly === true;
    if (old && Object.is(old.value, value) && old.errors === errors && old.touched === touched && old.dirty === dirty && old.visible === visible && old.required === required && old.validationEnabled === validationEnabled && old.validating === validating && old.pending === pending && old.disabled === disabled && old.readonly === readonly) return old;
    return Object.freeze({ value, initialValue: this.initial[name] as DeepReadonly<FieldValue<V, FieldName<V>>>, errors, touched, dirty, visible, required, validationEnabled, validating, pending, disabled, readonly });
  }
  /** Stable until the next state transition; suitable for external-store subscriptions. */
  getSnapshot = (): FormState<V> => this.snapshot;
  get state(): FormState<V> { return this.snapshot; }
  /** Subscribe to all transitions. No immediate callback; read getSnapshot() first. */
  subscribe = (listener: Listener): (() => void) => {
    this.assertActive(); this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  };
  getFieldState<K extends FieldName<V>>(name: K): FieldState<FieldValue<V, K>> {
    this.assertField(name);
    const old = this.fieldSnapshots.get(name), field = this.projectField(name, old);
    if (old !== field) this.fieldSnapshots.set(name, field);
    return field as FieldState<FieldValue<V, K>>;
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
    this.assertActive(); this.assertField(name); this.getFieldState(name);
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
  private writeValues(patch: Readonly<Record<string, unknown>>, rowOwnedValidation?: string, ownedCollection = false): void {
    this.assertActive();
    const flatPatch = this.definition.flattenPatch(patch);
    const entries = Object.entries(flatPatch) as [FieldName<V>, unknown][];
    for (const [name] of entries) this.assertField(name);
    if (!ownedCollection) this.definition.assertCollections(flatPatch);
    const ownedPatch = Object.fromEntries(entries.filter(([name, value]) => !equal(this.values[name], value)).map(([name, value]) => [name, ownedCollection ? value : freeze(copy(value))]));
    if (!Object.keys(ownedPatch).length) return;
    let next = { ...this.values, ...ownedPatch };
    next = this.behaviors.evaluate(next, this.initial, new Set(entries.map(([name]) => name)));
    const changed = (this.behaviors.configured ? this.names : entries.map(([name]) => name)).filter(name => !equal(next[name], this.values[name]));
    for (const name of changed) this.dirtyCandidates.add(name);
    const affected = new Set(this.definition.graph.affected(changed)) as Set<FieldName<V>>;
    for (const name of Object.keys(this.options.behaviors ?? {}) as FieldName<V>[]) {
      const behavior = this.behaviors.get(name), old = this.fieldSnapshots.get(name) ?? this.projectField(name);
      if (old && (old.required !== (behavior?.required === true || this.definition.fields[name]!.rules.some(rule => rule.name === 'required')) || old.validationEnabled !== (behavior?.validate ?? true))) affected.add(name);
    }
    const affectsForm = this.options.formDependsOn === undefined || this.options.formDependsOn.some(name => changed.includes(name as FieldName<V>));
    const previousBehaviors = this.publishedBehaviors;
    this.invalidate(affected, affectsForm, 'value-change'); this.values = freeze(next);
    for (const [name, items] of this.collections) if (!equal(next[name], items.values)) {
      if (!Array.isArray(next[name])) throw new TypeError(`Collection ${name} requires an array`);
      items.synchronize(next[name] as any[]);
    }
    for (const name of affected) this.removeError(name);
    if (affectsForm) { this.formFieldErrors = Object.create(null); this.formWideDetails = []; }
    this.publish();
    if (this.eventObservers) {
      for (const name of changed) this.emitEvent('field.changed', name);
      for (const [name, state] of this.publishedBehaviors) if (!sameRecord(previousBehaviors.get(name) as unknown as Record<string, unknown>, state as unknown as Record<string, unknown>)) this.emitEvent('behavior.changed', name);
    }
    if (this.mode === 'onChange' || this.mode === 'immediate') {
      // A row write schedules its own field closure. The parent schedules only
      // other dependent fields/form constraints; structural edits validate rows.
      this.schedule([...affected].filter(name => name !== rowOwnedValidation)); if (affectsForm) this.scheduleForm();
    }
  }
  setTouched<K extends FieldName<V>>(name: K, touched = true): void {
    this.assertActive(); this.assertField(name);
    if (this.touched[name] !== touched) { this.touched[name] = touched; this.touchedVersion++; this.publish(); this.emitEvent('field.touched', name, undefined, touched ? 'touched' : 'untouched'); }
    if (touched && this.mode === 'onBlur') { this.schedule([name]); if (this.options.formDependsOn === undefined || this.options.formDependsOn.includes(name)) this.scheduleForm(); }
  }
  setAllTouched(touched = true): void {
    this.assertActive(); for (const name of this.names) this.touched[name] = touched; this.touchedVersion++;
    for (const items of this.collections.values()) items.setAllTouched(touched); this.publish(); this.emitEvent('form.touched');
  }
  setError<K extends FieldName<V>>(name: K, message: string | readonly string[]): void {
    this.assertActive(); this.assertField(name); this.invalidate();
    this.writableErrors();
    this.errors[name] = freeze(typeof message === 'string' ? [message] : [...message]);
    this.details[name] = freeze(this.errors[name]!.map(message => ({ code: 'server', field: name, label: this.definition.fields[name]!.label, param: '', source: 'server', message })));
    delete this.formFieldErrors[name]; this.publish(); this.emitEvent('errors.set', name);
  }
  clearErrors(name?: FieldName<V>): void {
    this.assertActive(); if (name !== undefined) this.assertField(name); this.invalidate();
    if (name === undefined) { this.errors = Object.create(null); this.details = Object.create(null); this.formFieldErrors = Object.create(null); this.formWideDetails = []; }
    else { this.removeError(name); delete this.formFieldErrors[name]; } this.publish();
    for (const [collection, items] of this.collections) if (name === undefined || collection === name) items.clearErrors();
    this.emitEvent('errors.cleared', name);
  }
  setDisabled(disabled: boolean): void {
    this.assertActive(); if (this.disabled === disabled) return; this.disabled = disabled; this.publish(); this.emitEvent('flags.changed', undefined, undefined, 'disabled');
  }
  setReadonly(readonly: boolean): void {
    this.assertActive(); if (this.readonlyFlag === readonly) return; this.readonlyFlag = readonly; this.publish(); this.emitEvent('flags.changed', undefined, undefined, 'readonly');
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
    const flatValues = this.values, values = this.snapshot.values;
    const owners = names.map(field => {
      this.cancelField(field); const job = new FieldJob(); this.jobs.set(field, job); this.pending.add(field); return { field, job };
    });
    if (this.eventObservers) for (const { field, job } of owners) this.emitEvent('validation.started', field, job);
    this.publish();
    const formValidation = includeForm ? this.validateForm() : Promise.resolve(true);
    const results = await Promise.all(owners.map(({ field, job }) => this.validateField(field, job, flatValues, values)));
    if (!(await formValidation) || results.some(result => !result)) return { valid: false, errors: this.snapshot.errors, stale: true };
    return { valid: this.snapshot.valid, errors: this.snapshot.errors, stale: false };
  }
  private async validateField(field: FieldName<V>, job: FieldJob, flatValues: Readonly<Record<string, unknown>>, values: DeepReadonly<V>): Promise<boolean> {
    if (job.aborted) return false;
    const config = this.definition.fields[field]!;
    const context = { values, field, get signal() { return job.signal; } };
    let details: ValidationErrorDetail[] | undefined;
    const add = (code: string, param = '', message?: string) => {
      const previous = this.details[field]?.[details?.length ?? 0];
      const detail = previous?.code === code && previous.param === param && previous.message === message && previous.source === 'field' ? previous
        : Object.freeze({ code, field, label: config.label, param, source: 'field' as const, ...(message === undefined ? {} : { message }) });
      (details ??= []).push(detail);
    };
    const enabled = this.behaviors.get(field)?.validate !== false;
    if (enabled) {
      if (this.behaviors.get(field)?.required && !config.rules.some(rule => rule.name === 'required') && !checkRule({ name: 'required' }, flatValues[field], context)) add('required');
      for (const rule of config.rules) if (!checkRule(rule, flatValues[field], context)) add(rule.name, rule.param);
    }
    const items = enabled ? this.collections.get(field) : undefined;
    let timedOut = false;
    if (enabled && (items || (!details?.length && config.validators.length))) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const cancelled = new Promise<void>(resolve => { job.onCancel = () => { if (timeout !== undefined) clearTimeout(timeout); resolve(); }; if (job.aborted) resolve(); });
      const work = async () => {
        if (items) await items.validate(job.signal);
        if (!details?.length) for (const validator of config.validators) {
          if (job.aborted) break;
          try {
            const result = await validator(flatValues[field], context);
            if (job.aborted) break;
            if (result === false) add('custom'); else if (typeof result === 'string') add('custom', '', result);
          } catch { if (!job.aborted) add('exception'); }
        }
      };
      if (this.options.validation?.timeout !== undefined) timeout = setTimeout(() => { timedOut = true; job.abort(); }, this.options.validation.timeout);
      await Promise.race([work(), cancelled]);
      if (timeout !== undefined) clearTimeout(timeout); job.onCancel = undefined;
    } else await Promise.resolve(); // Retain the observable running -> result transition for synchronous rules.
    if (this.disposed || this.jobs.get(field) !== job || (job.aborted && !timedOut)) return false;
    if (timedOut) { details = undefined; add('timeout'); }
    this.jobs.delete(field); this.pending.delete(field);
    if (details?.length) {
      const next = share<readonly ValidationErrorDetail[]>(this.details[field], details);
      if (next !== this.details[field]) { this.writableErrors(); this.details[field] = next; this.errors[field] = freeze(next.map(detail => this.translate(detail))); }
    } else this.removeError(field);
    this.publishValidation();
    // Avoid computing diagnostic failure classifications on the unobserved hot path.
    if (this.eventObservers?.size) {
      if (details?.length) this.emitEvent('validation.failed', field, job, timedOut ? 'timeout' : details.some(detail => detail.code === 'exception') ? 'exception' : 'invalid');
      this.emitEvent('validation.completed', field, job, details?.length ? 'invalid' : 'valid');
    }
    return true;
  }
  private async validateForm(): Promise<boolean> {
    if (!this.options.validateForm) return true;
    this.cancelForm(); const controller = new AbortController(); this.formJob = controller;
    this.emitEvent('validation.started', undefined, controller, 'form');
    const values = this.snapshot.values; this.publish();
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
    this.publish();
    const invalid = this.formWideDetails.length > 0 || Object.keys(this.formFieldErrors).length > 0;
    if (invalid) this.emitEvent('validation.failed', undefined, controller, timedOut ? 'timeout' : failed ? 'exception' : 'invalid');
    this.emitEvent('validation.completed', undefined, controller, invalid ? 'invalid' : 'valid'); return true;
  }
  /** Executes immediately. Use handleSubmit() to obtain an event callback. */
  async submit<R>(handler: SubmitHandler<V, R>): Promise<SubmitResult<V, R>> {
    this.assertActive();
    if (this.submitting) return { status: 'busy' };
    if (this.disabled) return { status: 'cancelled' };
    const controller = new AbortController(); this.submitController = controller;
    let outcome = 'exception';
    this.submitting = true; this.submitted = false; this.submitCount++;
    for (const name of this.names) this.touched[name] = true; this.touchedVersion++;
    for (const items of this.collections.values()) items.setAllTouched(true);
    this.publish();
    this.emitEvent('submit.started', undefined, controller);
    const revision = this.revision;
    try {
      const validation = await this.validate();
      if (controller.signal.aborted) { outcome = 'cancelled'; return { status: 'cancelled' }; }
      if (validation.stale || revision !== this.revision) { outcome = 'stale'; return { status: 'stale' }; }
      if (!validation.valid) { outcome = 'invalid'; return { status: 'invalid', errors: validation.errors }; }
      const data = await handler(this.definition.inflate(this.values) as V, { signal: controller.signal });
      if (controller.signal.aborted) { outcome = 'cancelled'; return { status: 'cancelled' }; }
      this.submitted = true;
      outcome = 'success';
      return { status: 'success', data };
    } catch (error) {
      if (controller.signal.aborted) { outcome = 'cancelled'; return { status: 'cancelled' }; }
      throw error;
    } finally {
      this.submitting = false; this.submitController = undefined;
      if (!this.disposed) this.publish();
      if (outcome !== 'cancelled') this.emitEvent(outcome === 'success' ? 'submit.succeeded' : 'submit.failed', undefined, controller, outcome);
    }
  }
  handleSubmit<R>(handler: SubmitHandler<V, R>): (event?: { preventDefault(): void }) => Promise<SubmitResult<V, R>> {
    return event => { event?.preventDefault(); return this.submit(handler); };
  }
  private abortSubmission(reason: string): void {
    const controller = this.submitController;
    if (controller && !controller.signal.aborted) { controller.abort(); this.emitEvent('submit.cancelled', undefined, controller, reason); }
  }
  cancelSubmit(): void { this.assertActive(); this.abortSubmission('explicit'); this.invalidate(this.names, true, 'submit-cancel'); this.publish(); }
  reset(): void {
    this.assertActive(); this.abortSubmission('reset'); this.invalidate(this.names, true, 'reset');
    this.values = freeze(this.behaviors.evaluate({ ...this.initial }, this.initial, undefined, true)); this.errors = Object.create(null); this.details = Object.create(null); this.formFieldErrors = Object.create(null); this.formWideDetails = []; this.submitted = false; this.submitCount = 0;
    for (const name of this.names) this.dirtyCandidates.add(name);
    for (const items of this.collections.values()) items.reset();
    for (const name of this.names) this.touched[name] = false; this.touchedVersion++;
    this.publish();
    this.emitEvent('form.reset');
  }
  /** Idempotent; aborts work, clears subscriptions, and rejects future mutations. */
  dispose(): void {
    if (this.disposed) return;
    this.abortSubmission('dispose'); this.invalidate(this.names, true, 'dispose'); this.submitting = false;
    for (const items of this.collections.values()) items.dispose();
    this.listeners.clear(); this.fieldListeners.clear(); this.controls.clear(); this.fieldSnapshots.clear(); this.disposed = true; this.publish();
    this.emitEvent('form.disposed'); this.eventObservers?.clear(); this.eventObservers = undefined; this.eventRequests = undefined;
  }
}

export function createValixa<const S extends BlueprintInput>(input: S | Blueprint<S>, options: FormOptions<InferValues<S>> = {}): ValixaForm<InferValues<S>> {
  const definition = input instanceof Blueprint ? input : blueprint(input);
  return new ValixaForm(definition as Blueprint<BlueprintInput>, options);
}
