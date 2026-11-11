import { escapePath } from 'valixa';
import type { DependencyDiagnostics, FieldState, FormDescription, LifecycleEvent, ValixaForm } from 'valixa';

export const REDACTED = '[redacted]';
export interface DevtoolsOptions {
  readonly name?: string; readonly enabled?: boolean; readonly historyLimit?: number;
  /** Exact schema paths, prefixes, rows[].field, or explicit '*'. Default reveals no values. */
  readonly visibleValues?: readonly string[]; readonly sensitive?: readonly string[]; readonly allowSensitive?: boolean;
  readonly includeMessages?: boolean; readonly maxDepth?: number; readonly maxNodes?: number; readonly maxStringLength?: number; readonly maxRows?: number;
}
export interface InspectionEvent extends LifecycleEvent { readonly ordinal: number; readonly scope: string }
export interface InspectionScope { readonly id: string; readonly path: string; readonly description: FormDescription; readonly dependencies: DependencyDiagnostics; readonly behaviors: Readonly<Record<string, unknown>> }
export interface CollectionInspection { readonly scope: string; readonly name: string; readonly total: number; readonly rows: readonly { readonly key: string; readonly index: number; readonly scope: string }[] }
export interface InspectionSnapshot {
  readonly name: string; readonly status: 'attached' | 'disabled' | 'detached' | 'disposed'; readonly recording: boolean;
  readonly values: Readonly<Record<string, unknown>>; readonly errors: Readonly<Record<string, readonly string[]>>; readonly errorCodes: Readonly<Record<string, readonly string[]>>;
  readonly formErrors: readonly string[]; readonly touched: Readonly<Record<string, unknown>>; readonly dirtyFields: Readonly<Record<string, unknown>>;
  readonly state: Readonly<Record<string, string | boolean | number>>; readonly scopes: readonly InspectionScope[]; readonly collections: readonly CollectionInspection[]; readonly events: readonly InspectionEvent[];
}
interface Source { readonly form: ValixaForm<any>; readonly path: string; readonly release: () => void }
function frozen<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const item of Object.values(value)) frozen(item); Object.freeze(value); }
  return value;
}
const sensitiveName = (path: string) => /password|passphrase|secret|token|credential|authorization|session|api.?key|private.?key|upload|card/i.test(path) || /(?:^|[.\[\]_-])(file|files|filename|pin|cvv|ssn)(?:$|[.\[\]_-])/i.test(path.replace(/([a-z0-9])([A-Z])/g, '$1_$2'));
function read(object: unknown, path: readonly string[]): unknown { let value = object; for (const segment of path) { if (!value || typeof value !== 'object' || !Object.hasOwn(value, segment)) return undefined; value = (value as Record<string, unknown>)[segment]; } return value; }
function write(object: Record<string, unknown>, path: readonly string[], value: unknown): void {
  let target = object;
  for (const [index, segment] of path.entries()) {
    if (index === path.length - 1) Object.defineProperty(target, segment, { value, enumerable: true, configurable: true, writable: true });
    else { if (!Object.hasOwn(target, segment)) Object.defineProperty(target, segment, { value: {}, enumerable: true, configurable: true, writable: true }); target = target[segment] as Record<string, unknown>; }
  }
}
function limit(value: number | undefined, fallback: number, name: string, minimum = 1): number {
  const result = value ?? fallback; if (!Number.isInteger(result) || result < minimum || result > 10000) throw new TypeError(`${name} must be an integer between ${minimum} and 10000`); return result;
}
/** Opt-in local-only inspection. This object owns no form and exposes no form mutators. */
export class ValixaInspection {
  #root: ValixaForm<any> | undefined;
  #sources = new Map<string, Source>();
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(event: InspectionEvent) => void>();
  private history: InspectionEvent[] = [];
  private ordinal = 0;
  private dirty = false;
  private queued = false;
  private recording = true;
  private status: InspectionSnapshot['status'];
  private snapshot: InspectionSnapshot;
  private readonly name: string;
  private readonly historyLimit: number;
  private readonly maxDepth: number; private readonly maxNodes: number; private readonly maxStringLength: number; private readonly maxRows: number;
  private readonly visible: ReadonlySet<string>; private readonly sensitive: ReadonlySet<string>;
  private readonly allowSensitive: boolean; private readonly includeMessages: boolean;
  constructor(form: ValixaForm<any>, options: DevtoolsOptions = {}) {
    this.name = options.name ?? 'Form'; this.historyLimit = limit(options.historyLimit, 100, 'historyLimit', 0);
    this.maxDepth = limit(options.maxDepth, 6, 'maxDepth'); this.maxNodes = limit(options.maxNodes, 1000, 'maxNodes'); this.maxStringLength = limit(options.maxStringLength, 256, 'maxStringLength'); this.maxRows = limit(options.maxRows, 1000, 'maxRows');
    this.visible = new Set(options.visibleValues ?? []); this.sensitive = new Set(options.sensitive ?? []); this.allowSensitive = options.allowSensitive ?? false; this.includeMessages = options.includeMessages ?? false;
    this.status = options.enabled === false ? 'disabled' : 'attached'; this.snapshot = this.empty();
    if (this.status === 'attached') { this.#root = form; this.syncSources(); this.dirty = true; this.flush(); }
  }
  private empty(): InspectionSnapshot { return frozen({ name: this.name, status: this.status, recording: this.status === 'attached' && this.recording, values: {}, errors: {}, errorCodes: {}, formErrors: [], touched: {}, dirtyFields: {}, state: {}, scopes: [], collections: [], events: [] }); }
  private allowed(path: string): boolean { return this.visible.has('*') || [...this.visible].some(prefix => path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[]`)); }
  private privatePath(path: string): boolean { return !this.allowSensitive && (sensitiveName(path) || [...this.sensitive].some(prefix => path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[]`))); }
  private value(value: unknown, path: string, depth: number, budget: { remaining: number }): unknown {
    if (!this.allowed(path) || this.privatePath(path)) return REDACTED;
    if (depth > this.maxDepth || --budget.remaining < 0) return '[inspection limit]';
    if (typeof value === 'string') return value.length > this.maxStringLength ? `${value.slice(0, this.maxStringLength)}…` : value;
    if (typeof value === 'bigint') return `${value}n`;
    if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
    if (!value || typeof value !== 'object') return value;
    if ('name' in value && 'size' in value && 'type' in value) return REDACTED; // File-like metadata is never read implicitly.
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      for (const item of value) { if (result.length >= this.maxRows || budget.remaining <= 0) break; result.push(this.value(item, `${path}[]`, depth + 1, budget)); }
      if (result.length < value.length) result.push('[inspection limit]');
      return frozen(result);
    }
    const result: Record<string, unknown> = {};
    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      if (budget.remaining <= 0) { Object.defineProperty(result, '[inspection limit]', { value: true, enumerable: true }); break; }
      Object.defineProperty(result, key, { value: this.value((value as Record<string, unknown>)[key], `${path}.${escapePath(key)}`, depth + 1, budget), enumerable: true });
    }
    return frozen(result);
  }
  private messages(messages: readonly string[], path: string): readonly string[] { return Object.freeze(messages.map(message => this.includeMessages && this.allowed(path) && !this.privatePath(path) ? message.slice(0, this.maxStringLength) : REDACTED)); }
  private subscribeSource(id: string, form: ValixaForm<any>, path: string): void {
    const releaseState = form.subscribe(() => { if (id === '$') this.syncSources(); this.markDirty(); });
    let releaseEvents: () => void;
    try { releaseEvents = form.observeEvents(event => {
      const entry = Object.freeze({ ...event, ordinal: ++this.ordinal, scope: id });
      if (event.type.startsWith('collection.')) this.syncSources();
      if (this.recording && this.historyLimit > 0) { this.history.push(entry); if (this.history.length > this.historyLimit) this.history.splice(0, this.history.length - this.historyLimit); }
      for (const listener of [...this.eventListeners]) { try { listener(entry); } catch { /* Diagnostics observers are isolated. */ } }
      if (event.type === 'form.disposed') {
        if (id === '$') { this.close('disposed'); return; }
        this.#sources.get(id)?.release(); this.#sources.delete(id);
      }
      this.markDirty();
    }); } catch (error) { releaseState(); throw error; }
    this.#sources.set(id, { form, path, release: () => { releaseState(); releaseEvents(); } });
  }
  private syncSources(): void {
    if (!this.#root) return;
    const seen = new Set<string>(); let remaining = this.maxRows;
    const visit = (id: string, form: ValixaForm<any>, path: string) => {
      seen.add(id); if (!this.#sources.has(id)) this.subscribeSource(id, form, path);
      for (const name of Object.keys(form.describe().collections)) {
        const rows = form.array(name).items;
        for (const row of rows) { if (remaining-- <= 0) break; visit(`${id}/${encodeURIComponent(name)}:${row.key}`, row.form, `${path}${name}[].`); }
      }
    };
    visit('$', this.#root, '');
    for (const [id, source] of this.#sources) if (!seen.has(id)) { source.release(); this.#sources.delete(id); }
  }
  private values(form: ValixaForm<any>, prefix: string, budget: { remaining: number }): Record<string, unknown> {
    const result: Record<string, unknown> = {}; const description = form.describe();
    for (const [name, field] of Object.entries(description.fields)) {
      const path = `${prefix}${name}`;
      if (description.collections[name] && (this.allowed(path) || [...this.visible].some(allowed => allowed.startsWith(`${path}[].`))) && !this.privatePath(path)) {
        write(result, field.path, form.array(name).items.slice(0, this.maxRows).map(row => this.values(row.form, `${path}[].`, budget)));
      } else write(result, field.path, this.value(read(form.state.values, field.path), path, 0, budget));
    }
    return frozen(result);
  }
  private flush(): void {
    if (!this.dirty || !this.#root || this.status !== 'attached') return;
    this.syncSources(); const state = this.#root.state;
    const scopes: InspectionScope[] = [], collections: CollectionInspection[] = [];
    for (const [id, source] of this.#sources) {
      scopes.push(Object.freeze({ id, path: source.path, description: source.form.describe(), dependencies: source.form.dependencies, behaviors: source.form.getBehaviorStates() }));
      for (const name of Object.keys(source.form.describe().collections)) { const rows = source.form.array(name).items; collections.push(frozen({ scope: id, name, total: rows.length, rows: rows.slice(0, this.maxRows).map((row, index) => ({ key: row.key, index, scope: `${id}/${encodeURIComponent(name)}:${row.key}` })) })); }
    }
    this.snapshot = frozen({ name: this.name, status: this.status, recording: this.recording,
      values: this.values(this.#root, '', { remaining: this.maxNodes }),
      errors: Object.fromEntries(Object.entries(state.errors).map(([name, messages]) => [name, this.messages(messages as readonly string[], name)])),
      errorCodes: Object.fromEntries(Object.entries(state.errorDetails).map(([name, details]) => [name, (details ?? []).map(detail => `${detail.source}:${detail.code}`)])),
      formErrors: this.messages(state.formErrors, '$form'), touched: state.nestedTouched, dirtyFields: state.nestedDirty,
      state: { dirty: state.dirty, valid: state.valid, pending: state.pending, validating: state.validating, submitting: state.submitting, submitted: state.submitted, submitCount: state.submitCount, disabled: state.disabled, readonly: state.readonly, locale: state.locale },
      scopes, collections, events: Object.freeze([...this.history]) }); this.dirty = false;
  }
  private markDirty(): void {
    if (this.status !== 'attached') return; this.dirty = true;
    if (!this.queued) { this.queued = true; void Promise.resolve().then(() => { if (!this.queued || this.status !== 'attached') return; this.queued = false; this.flush(); for (const listener of [...this.listeners]) { try { listener(); } catch { /* Diagnostic view errors do not affect the store. */ } } }); }
  }
  getSnapshot = (): InspectionSnapshot => { this.flush(); return this.snapshot; };
  toJSON(): InspectionSnapshot { return this.getSnapshot(); }
  subscribe = (listener: () => void): (() => void) => { if (this.status !== 'attached') return () => {}; this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  subscribeEvents = (listener: (event: InspectionEvent) => void): (() => void) => { if (this.status !== 'attached') return () => {}; this.eventListeners.add(listener); return () => { this.eventListeners.delete(listener); }; };
  inspectField = (name: string, scope = '$'): Readonly<FieldState<unknown>> | undefined => {
    if (this.status !== 'attached') return undefined; this.syncSources(); const source = this.#sources.get(scope);
    if (!source || !Object.hasOwn(source.form.describe().fields, name)) throw new TypeError(`Unknown inspected field ${scope}:${name}`);
    const field = source.form.getFieldState(name), path = `${source.path}${name}`, budget = { remaining: this.maxNodes };
    return frozen({ ...field, value: this.value(field.value, path, 0, budget), initialValue: this.value(field.initialValue, path, 0, budget), errors: this.messages(field.errors, path) });
  };
  pause = (): void => { if (this.status === 'attached') { this.recording = false; this.markDirty(); } };
  resume = (): void => { if (this.status === 'attached') { this.recording = true; this.markDirty(); } };
  clear = (): void => { this.history = []; this.markDirty(); };
  private close(status: 'disposed' | 'detached'): void {
    for (const source of this.#sources.values()) source.release(); this.#sources.clear(); this.#root = undefined; this.history = []; this.dirty = false; this.queued = false; this.status = status; this.snapshot = this.empty();
    for (const listener of [...this.listeners]) { try { listener(); } catch { /* View cleanup is isolated. */ } } this.listeners.clear(); this.eventListeners.clear();
  }
  detach = (): void => { this.close('detached'); };
}
export function attachValixaDevtools<V extends Record<string, unknown>>(form: ValixaForm<V>, options: DevtoolsOptions = {}): ValixaInspection { return new ValixaInspection(form as ValixaForm<any>, options); }
