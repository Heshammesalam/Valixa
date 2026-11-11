import type { Blueprint, BlueprintInput, CollectionBlueprint, CollectionName, FieldName, FieldState, FieldValue, FormDescription, InferValues, ValixaForm, ValueInput } from 'valixa';

export type Widget = 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'switch' | 'autocomplete' | 'date' | 'custom';
export interface AutoCodec<T, View = any> { readonly view: string; readonly encode: (value: View) => T; readonly decode: (value: T) => View }
export function defineAutoCodec<T, View>(codec: AutoCodec<T, View>): AutoCodec<T, View> { return Object.freeze({ ...codec }); }
export interface AutoOption<T> { readonly label: string; readonly value: T }
type Item<T> = NonNullable<T> extends readonly (infer I)[] ? I : NonNullable<T>;
type Equality<T> = Item<T> extends object ? { readonly compare: (a: Item<T>, b: Item<T>) => boolean } : { readonly compare?: (a: Item<T>, b: Item<T>) => boolean };
interface FieldPresentation<T> {
  readonly label: string; readonly description?: string; readonly disabled?: boolean; readonly readonly?: boolean;
  readonly errorPlacement?: 'inline' | 'summary' | 'none'; readonly className?: string;
  readonly presentationWhen?: (state: FieldState<T>) => boolean;
}
type Choices<T> = { readonly component: 'select' | 'autocomplete'; readonly options: readonly AutoOption<Item<T>>[]; readonly emptyValue: T } & Equality<T> & (NonNullable<T> extends readonly unknown[] ? { readonly multiple: true } : { readonly multiple?: false });
export type AutoField<T> = FieldPresentation<T> & (
  | (string extends T ? [T] extends [string | null | undefined] ? { readonly component: 'text' | 'email' | 'password' | 'textarea' } : never : never)
  | (number extends T ? [T] extends [number | null | undefined] ? { readonly component: 'number'; readonly emptyValue: T } : never : never)
  | (boolean extends T ? [T] extends [boolean | null | undefined] ? { readonly component: 'checkbox' | 'switch' } : never : never)
  | Choices<T>
  | (NonNullable<T> extends readonly unknown[] ? never : { readonly component: 'radio'; readonly options: readonly AutoOption<Item<T>>[] } & Equality<T>)
  | { readonly component: 'date'; readonly codec: AutoCodec<T> | string }
  | { readonly component: 'custom'; readonly renderer: string }
);
export type LayoutNode<V> = FieldName<V> | { readonly group: string; readonly label: string; readonly description?: string; readonly columns?: number; readonly children: readonly LayoutNode<V>[] } | { readonly collection: CollectionName<V> };
export interface AutoConfig<V> {
  readonly fields: { readonly [K in FieldName<V>]?: AutoField<FieldValue<V, K>> };
  readonly collections?: { readonly [K in CollectionName<V>]?: { readonly label: string; readonly ui: AutoUI<InferValues<CollectionBlueprint<V, K>>>; readonly createItem: () => ValueInput<InferValues<CollectionBlueprint<V, K>>>; readonly addLabel?: string; readonly removeLabel?: string; readonly movable?: boolean } };
  readonly layout?: readonly LayoutNode<V>[];
  readonly submitLabel?: string; readonly resetLabel?: string; readonly summary?: boolean;
}
/** Erased only at renderer boundaries; authoring uses AutoField<T> and typed config keys. */
export interface RuntimeField {
  readonly component: Widget; readonly label: string; readonly description?: string; readonly disabled?: boolean; readonly readonly?: boolean;
  readonly errorPlacement?: 'inline' | 'summary' | 'none'; readonly className?: string; readonly presentationWhen?: (state: FieldState<any>) => boolean;
  readonly emptyValue?: unknown; readonly options?: readonly AutoOption<any>[]; readonly multiple?: boolean; readonly compare?: (a: any, b: any) => boolean;
  readonly codec?: AutoCodec<any> | string; readonly renderer?: string;
}
export type PlanNode =
  | { readonly kind: 'field'; readonly name: string; readonly config: RuntimeField }
  | { readonly kind: 'group'; readonly id: string; readonly label: string; readonly description?: string; readonly columns: number; readonly children: readonly PlanNode[] }
  | { readonly kind: 'collection'; readonly name: string; readonly label: string; readonly ui: AutoUI<any>; readonly createItem: () => any; readonly addLabel: string; readonly removeLabel: string; readonly movable: boolean };
export interface AutoUI<V> {
  readonly nodes: readonly PlanNode[]; readonly description: FormDescription; readonly submitLabel: string; readonly resetLabel: string; readonly summary: boolean;
  readonly __values?: (values: V) => V;
}
export interface AutoCapabilities { readonly name: string; readonly widgets: readonly Widget[]; readonly custom?: readonly string[]; readonly dateView?: string; readonly codecs?: Readonly<Record<string, AutoCodec<any>>>; readonly validateField?: (field: RuntimeField, name: string) => void }

const widgets: readonly string[] = ['text', 'email', 'password', 'number', 'textarea', 'select', 'checkbox', 'radio', 'switch', 'autocomplete', 'date', 'custom'];
function configuration<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(configuration)) as T;
  if (value && typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError('Auto Form metadata/options must be plain data or explicit codec functions');
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, configuration(item)]))) as T;
  }
  return value;
}
function signature(description: FormDescription): string {
  return JSON.stringify([Object.keys(description.fields), Object.entries(description.collections).map(([name, item]) => [name, signature(item)])]);
}
export function defineAutoForm<const S extends BlueprintInput>(schema: Blueprint<S>, input: AutoConfig<InferValues<S>>): AutoUI<InferValues<S>> {
  const config = configuration(input), description = schema.description;
  const fields = config.fields as Readonly<Record<string, RuntimeField | undefined>>;
  const collections = config.collections as Readonly<Record<string, any>> | undefined;
  for (const [name, field] of Object.entries(fields)) {
    if (!Object.hasOwn(description.fields, name)) throw new TypeError(`Auto Form references unknown field: ${name}`);
    if (!field || !widgets.includes(field.component)) throw new TypeError(`Unknown Auto Form component for ${name}; register a custom renderer explicitly`);
    if (typeof field.label !== 'string' || !field.label.trim()) throw new TypeError(`Auto Form field ${name} requires an explicit label`);
    if (field.component === 'number' && !Object.hasOwn(field, 'emptyValue')) throw new TypeError(`Number field ${name} requires an explicit emptyValue`);
    if (['select', 'autocomplete', 'radio'].includes(field.component)) {
      if (!Array.isArray(field.options)) throw new TypeError(`Choice field ${name} requires options`);
      if (field.component !== 'radio' && !Object.hasOwn(field, 'emptyValue')) throw new TypeError(`Choice field ${name} requires an explicit emptyValue`);
      if (field.options.some(option => option.value !== null && typeof option.value === 'object') && !field.compare) throw new TypeError(`Object choices for ${name} require compare(a, b)`);
      if (field.options.some(option => typeof option.label !== 'string')) throw new TypeError(`Choice labels for ${name} must be strings`);
    }
    if (field.component === 'date' && !field.codec) throw new TypeError(`Date field ${name} requires an explicit codec`);
    if (field.component === 'custom' && !field.renderer) throw new TypeError(`Custom field ${name} requires a renderer key`);
  }
  for (const [name, item] of Object.entries(collections ?? {})) {
    if (!Object.hasOwn(description.collections, name)) throw new TypeError(`Auto Form collection ${name} is not declared by collection(...)`);
    if (fields[name]) throw new TypeError(`Render collection ${name} as rows or as a field, not both`);
    if (!item || typeof item.label !== 'string' || typeof item.createItem !== 'function' || !item.ui) throw new TypeError(`Collection ${name} requires label, ui and createItem`);
    if (signature(item.ui.description) !== signature(description.collections[name]!)) throw new TypeError(`Collection ${name} UI does not match its row schema`);
  }
  const used = new Set<string>(), groups = new Set<string>();
  const visit = (node: LayoutNode<any>): PlanNode => {
    if (typeof node === 'string') {
      if (!fields[node]) throw new TypeError(`Layout field ${node} has no UI metadata`);
      if (used.has(node)) throw new TypeError(`Duplicate layout field: ${node}`); used.add(node);
      return Object.freeze({ kind: 'field', name: node, config: fields[node]! });
    }
    if ('collection' in node) {
      const item = collections?.[node.collection]; if (!item) throw new TypeError(`Layout collection ${node.collection} has no UI metadata`);
      if (used.has(node.collection)) throw new TypeError(`Duplicate layout collection: ${node.collection}`); used.add(node.collection);
      return Object.freeze({ kind: 'collection', name: node.collection, label: item.label, ui: item.ui, createItem: item.createItem, addLabel: item.addLabel ?? 'Add row', removeLabel: item.removeLabel ?? 'Remove row', movable: item.movable ?? true });
    }
    if (!node.group || !node.label || groups.has(node.group)) throw new TypeError(`Group requires a unique id and explicit label: ${node.group}`);
    groups.add(node.group); const columns = node.columns ?? 1;
    if (!Number.isInteger(columns) || columns < 1 || columns > 12) throw new TypeError(`Group ${node.group} columns must be between 1 and 12`);
    return Object.freeze({ kind: 'group', id: node.group, label: node.label, ...(node.description === undefined ? {} : { description: node.description }), columns, children: Object.freeze(node.children.map(visit)) });
  };
  const layout = config.layout ?? [...Object.keys(fields), ...Object.keys(collections ?? {}).map(collection => ({ collection }))];
  const nodes = Object.freeze((layout as readonly LayoutNode<any>[]).map(visit));
  for (const name of [...Object.keys(fields), ...Object.keys(collections ?? {})]) if (!used.has(name)) throw new TypeError(`Configured field/collection ${name} is missing from layout`);
  return Object.freeze({ nodes, description, submitLabel: config.submitLabel ?? 'Submit', resetLabel: config.resetLabel ?? 'Reset', summary: config.summary ?? true });
}
export function resolveAutoCodec(field: RuntimeField, capabilities: AutoCapabilities): AutoCodec<any> {
  const codec = typeof field.codec === 'string' ? capabilities.codecs?.[field.codec] : field.codec;
  if (!codec || typeof codec.encode !== 'function' || typeof codec.decode !== 'function') throw new TypeError(`${capabilities.name}: register explicit codec ${String(field.codec)} for ${field.label}`);
  if (codec.view !== capabilities.dateView) throw new TypeError(`${capabilities.name}: date field ${field.label} requires a '${capabilities.dateView}' view codec; got '${codec.view}'`);
  return codec;
}
export function createRenderingPlan<V extends Record<string, unknown>>(form: ValixaForm<V>, ui: AutoUI<V>, capabilities: AutoCapabilities): readonly PlanNode[] {
  if (signature(form.describe()) !== signature(ui.description)) throw new TypeError('Auto Form UI and form schema paths/collections do not match');
  const validate = (nodes: readonly PlanNode[]) => { for (const node of nodes) {
    if (node.kind === 'group') validate(node.children);
    else if (node.kind === 'collection') validate(node.ui.nodes);
    else {
      if (!capabilities.widgets.includes(node.config.component)) throw new TypeError(`${capabilities.name} does not support '${node.config.component}' for ${node.name}; register a custom renderer`);
      if (node.config.component === 'custom' && !capabilities.custom?.includes(node.config.renderer!)) throw new TypeError(`${capabilities.name}: missing custom renderer '${node.config.renderer}' for ${node.name}`);
      if (node.config.component === 'date') resolveAutoCodec(node.config, capabilities);
      capabilities.validateField?.(node.config, node.name);
    }
  } };
  validate(ui.nodes); return ui.nodes;
}
export function selectedOptions(field: RuntimeField, value: unknown): readonly number[] {
  const values = field.multiple ? Array.isArray(value) ? value : [] : value == null ? [] : [value];
  return (field.options ?? []).flatMap((option, index) => values.some(item => (field.compare ?? Object.is)(option.value, item)) ? [index] : []);
}
export function choiceValue(field: RuntimeField, indexes: readonly number[]): unknown {
  const options = field.options ?? [];
  if (indexes.some(index => !Number.isInteger(index) || index < 0 || index >= options.length)) throw new TypeError(`Invalid choice index for ${field.label}`);
  return field.multiple ? indexes.map(index => options[index]!.value) : indexes.length ? options[indexes[0]!]!.value : field.emptyValue;
}
