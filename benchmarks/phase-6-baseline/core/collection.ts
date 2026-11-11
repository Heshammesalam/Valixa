import { ValixaForm } from './form.js';
import type { Blueprint } from './blueprint.js';
import { share } from './data.js';
import type { BlueprintInput, DeepReadonly, FormOptions, FormState, InferValues, ValueInput } from './types.js';

export interface CollectionRow<V extends Record<string, unknown>> {
  readonly key: string;
  /** Stable store; bind framework controls to this store and use key for UI reconciliation. */
  readonly form: ValixaForm<V>;
}
export interface CollectionSnapshot<V extends Record<string, unknown>> {
  readonly items: readonly CollectionRow<V>[];
  readonly values: DeepReadonly<readonly V[]>;
}

/** A row owns its validation graph, subscriptions and lifetime independently of its index. */
export class FieldCollection<S extends BlueprintInput> {
  private rows: CollectionRow<InferValues<S>>[] = [];
  private nextKey = 0;
  private disposed = false;
  private changing = false;
  private listeners = new Set<() => void>();
  private offs = new Map<string, () => void>();
  private snapshot!: CollectionSnapshot<InferValues<S>>;
  private locale: string;
  private disabled = false;
  private readonlyFlag = false;
  private readonly flagsDirty = new Set<ValixaForm<InferValues<S>>>();
  private states: readonly FormState<InferValues<S>>[] = [];
  private derived = { errors: Object.freeze([]) as readonly string[], nestedErrors: Object.freeze([]) as readonly unknown[], nestedTouched: Object.freeze([]) as readonly unknown[], nestedDirty: Object.freeze([]) as readonly unknown[], pending: false, validating: false };
  constructor(private readonly definition: Blueprint<S>, private readonly initial: readonly ValueInput<InferValues<S>>[], private readonly options: FormOptions, private readonly change: (values: readonly InferValues<S>[], structure: boolean) => void) {
    this.locale = options.locale ?? 'en';
    this.changing = true;
    this.rows = initial.map(item => this.create(item)); this.changing = false; this.publish(false, false);
  }
  private active(): void { if (this.disposed) throw new Error('Collection has been disposed'); }
  private index(index: number, end = false): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.rows.length + (end ? 1 : 0)) throw new RangeError(`Collection index out of range: ${index}`);
  }
  private create(item: ValueInput<InferValues<S>>): CollectionRow<InferValues<S>> {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError('Collection items must be objects matching the item schema');
    const fields = this.definition.flattenPatch(item as Readonly<Record<string, unknown>>);
    // Row initial values are item values, while rules/dependencies come from the reusable item schema.
    const form = new ValixaForm<InferValues<S>>(this.definition as Blueprint<BlueprintInput>, { ...this.options, locale: this.locale, disabled: this.disabled, readonly: this.readonlyFlag },
      this.definition.inflate({ ...Object.fromEntries(Object.entries(this.definition.fields).map(([name, field]) => [name, field.initial])), ...fields }), false);
    const row = Object.freeze({ key: `row-${++this.nextKey}`, form });
    this.offs.set(row.key, form.subscribe(() => {
      if (form.state.disabled !== this.disabled || form.state.readonly !== this.readonlyFlag) this.flagsDirty.add(form);
      if (!this.changing && !this.disposed) this.publish(false);
    }));
    return row;
  }
  private removeRow(row: CollectionRow<InferValues<S>>): void { this.offs.get(row.key)?.(); this.offs.delete(row.key); this.flagsDirty.delete(row.form); row.form.dispose(); }
  private publish(structure: boolean, notifyParent = true): void {
    const states = this.rows.map(row => row.form.state);
    const values = this.rows.map(row => row.form.state.values);
    const old = this.snapshot;
    const sameValues = old && old.values.length === values.length && values.every((value, index) => value === old.values[index]);
    this.snapshot = Object.freeze({ items: structure || !old ? Object.freeze([...this.rows]) : old.items, values: (sameValues ? old.values : Object.freeze(values)) as DeepReadonly<readonly InferValues<S>[]> });
    const errorsChanged = structure || states.length !== this.states.length || states.some((state, index) => state.errors !== this.states[index]?.errors);
    this.derived = {
      errors: errorsChanged ? share(this.derived.errors, states.flatMap((state, index) => Object.values(state.errors).flatMap(messages => (messages as readonly string[]).map(message => `[${index}] ${message}`)))) : this.derived.errors,
      nestedErrors: share(this.derived.nestedErrors, states.map(state => state.nestedErrors)),
      nestedTouched: share(this.derived.nestedTouched, states.map(state => state.nestedTouched)),
      nestedDirty: share(this.derived.nestedDirty, states.map(state => state.nestedDirty)),
      pending: states.some(state => state.pending), validating: states.some(state => state.validating)
    };
    this.states = states;
    if (notifyParent) this.change(this.snapshot.values as readonly InferValues<S>[], structure);
    for (const listener of [...this.listeners]) listener();
  }
  getSnapshot = (): CollectionSnapshot<InferValues<S>> => this.snapshot;
  get items(): readonly CollectionRow<InferValues<S>>[] { return this.snapshot.items; }
  get values(): DeepReadonly<readonly InferValues<S>[]> { return this.snapshot.values; }
  get errors(): readonly string[] { return this.derived.errors; }
  get nestedErrors(): readonly unknown[] { return this.derived.nestedErrors; }
  get nestedTouched(): readonly unknown[] { return this.derived.nestedTouched; }
  get nestedDirty(): readonly unknown[] { return this.derived.nestedDirty; }
  get pending(): boolean { return this.derived.pending; }
  get validating(): boolean { return this.derived.validating; }
  subscribe = (listener: () => void): (() => void) => { this.active(); this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  append(item: ValueInput<InferValues<S>>): void { this.insert(this.rows.length, item); }
  prepend(item: ValueInput<InferValues<S>>): void { this.insert(0, item); }
  insert(index: number, item: ValueInput<InferValues<S>>): void { this.active(); this.index(index, true); const row = this.create(item); this.rows.splice(index, 0, row); this.publish(true); }
  remove(index: number): void { this.active(); this.index(index); this.removeRow(this.rows.splice(index, 1)[0]!); this.publish(true); }
  move(from: number, to: number): void { this.active(); this.index(from); this.index(to); if (from === to) return; this.rows.splice(to, 0, this.rows.splice(from, 1)[0]!); this.publish(true); }
  swap(a: number, b: number): void { this.active(); this.index(a); this.index(b); if (a === b) return; [this.rows[a], this.rows[b]] = [this.rows[b]!, this.rows[a]!]; this.publish(true); }
  replace(items: readonly ValueInput<InferValues<S>>[]): void { this.replaceRows(items, true); }
  /** @internal Parent transaction synchronization. */
  synchronize(items: readonly ValueInput<InferValues<S>>[]): void { this.replaceRows(items, false); }
  private replaceRows(items: readonly ValueInput<InferValues<S>>[], notifyParent: boolean): void {
    this.active(); const created: CollectionRow<InferValues<S>>[] = [];
    try { for (const item of items) created.push(this.create(item)); }
    catch (error) { for (const row of created) this.removeRow(row); throw error; }
    for (const row of this.rows) this.removeRow(row); this.rows = created; this.publish(true, notifyParent);
  }
  clear(): void { this.replace([]); }
  reset(): void { this.replace(this.initial); }
  async validate(signal: AbortSignal): Promise<void> {
    const rows = [...this.rows];
    const abort = () => { for (const row of rows) row.form.cancelValidation(); };
    signal.addEventListener('abort', abort, { once: true });
    try { if (!signal.aborted) await Promise.all(rows.map(row => row.form.validate())); }
    finally { signal.removeEventListener('abort', abort); }
  }
  setFlags(disabled: boolean, readonly: boolean): void {
    if (this.disposed) return;
    const changed = disabled !== this.disabled || readonly !== this.readonlyFlag;
    if (!changed && !this.flagsDirty.size) return;
    this.disabled = disabled; this.readonlyFlag = readonly;
    this.changing = true;
    try { for (const form of changed ? this.rows.map(row => row.form) : this.flagsDirty) { form.setDisabled(disabled); form.setReadonly(readonly); } }
    finally { this.changing = false; this.flagsDirty.clear(); }
  }
  setLocale(locale: string): void { this.locale = locale; for (const row of this.rows) row.form.setLocale(locale); }
  cancelValidation(): void { for (const row of this.rows) row.form.cancelValidation(); }
  setAllTouched(touched: boolean): void {
    this.changing = true;
    try { for (const row of this.rows) row.form.setAllTouched(touched); } finally { this.changing = false; }
    this.publish(false);
  }
  clearErrors(): void {
    this.changing = true;
    try { for (const row of this.rows) row.form.clearErrors(); } finally { this.changing = false; }
    this.publish(false);
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.listeners.clear(); for (const row of this.rows) this.removeRow(row); this.publish(false, false); }
}
