import { copy, freeze, share } from './data.js';
import { parseRules } from './rules.js';
import { DependencyGraph } from './graph.js';
import { escapePath, safeSegment, writePath } from './paths.js';
import type { ParsedRule } from './rules.js';
import type { BlueprintInput, CollectionSchema, FieldDefinition, FormDescription, InferValues, NestedSchema, Validator, ValueInput } from './types.js';
const emptyRules: readonly ParsedRule[] = Object.freeze([]);
const emptyValidators: readonly Validator[] = Object.freeze([]);
const descriptions = new WeakMap<object, FormDescription>();

export interface CompiledField {
  readonly initial: unknown;
  readonly label: string;
  readonly rules: readonly ParsedRule[];
  readonly validators: readonly Validator[];
  readonly dependsOn?: readonly string[];
}
/** Immutable reusable definition. Each createValixa call owns independent state. */
export class Blueprint<S extends BlueprintInput> {
  declare readonly __values: InferValues<S>;
  readonly fields: Readonly<Record<string, CompiledField>>;
  readonly graph: DependencyGraph;
  readonly paths: Readonly<Record<string, readonly string[]>>;
  readonly collections: Readonly<Record<string, Blueprint<BlueprintInput>>>;
  readonly flat: boolean;
  /** Owned frozen defaults can be shared across independent copy-on-write form instances. */
  readonly initialValues: Readonly<Record<string, unknown>>;
  constructor(input: S) {
    const paths: Record<string, readonly string[]> = Object.create(null);
    const collections: Record<string, Blueprint<BlueprintInput>> = Object.create(null);
    const flatten = (schema: BlueprintInput, parent: string[] = []): [string, unknown][] => Object.entries(schema).flatMap(([key, field]) => {
      safeSegment(key);
      const segments = [...parent, key];
      if (!Array.isArray(field) && (field as NestedSchema).kind === 'valixa.nested' && !Object.hasOwn(field, 'initial')) return flatten((field as NestedSchema).schema, segments);
      const name = parent.length ? segments.map(escapePath).join('.') : key;
      if (Object.hasOwn(paths, name)) throw new TypeError(`Ambiguous field path: ${name}`);
      paths[name] = segments; return [[name, field]];
    });
    const entries = flatten(input).map(([name, field]) => {
      if (['__proto__', 'prototype', 'constructor'].includes(name)) throw new TypeError(`Reserved field name: ${name}`);
      const definition = (Array.isArray(field) ? { initial: field[0], rules: field[1] } : field) as FieldDefinition;
      if ((field as CollectionSchema).kind === 'valixa.collection') collections[name] = new Blueprint((field as CollectionSchema).schema);
      if (!definition || !Object.hasOwn(definition, 'initial')) throw new TypeError(`Field ${name} requires an initial value`);
      const validate = definition.validate;
      const validators = validate === undefined ? emptyValidators : typeof validate === 'function' ? [validate] : [...validate];
      if (validators.some(validator => typeof validator !== 'function')) throw new TypeError(`Invalid validator for ${name}`);
      const rules = definition.rules === undefined || definition.rules === '' ? emptyRules : parseRules(definition.rules);
      return [name, { initial: copy(definition.initial), label: definition.label ?? name, rules: rules.length ? rules : emptyRules, validators,
        ...(definition.dependsOn === undefined ? {} : { dependsOn: [...definition.dependsOn] }) }] as const;
    });
    this.fields = freeze(Object.fromEntries(entries));
    this.initialValues = Object.freeze(Object.fromEntries(entries.map(([name, field]) => [name, field.initial])));
    this.paths = freeze(paths);
    this.flat = Object.values(paths).every(path => path.length === 1);
    this.collections = Object.freeze(collections);
    for (const [name, field] of Object.entries(this.fields)) {
      for (const rule of field.rules) {
        if (rule.name === 'same' && !Object.hasOwn(this.fields, rule.param!)) throw new TypeError(`Field ${name} references unknown field ${rule.param}`);
      }
    }
    this.graph = new DependencyGraph(this.fields);
    Object.freeze(this);
  }
  get description(): FormDescription {
    let description = descriptions.get(this);
    if (!description) {
      description = freeze({ fields: Object.fromEntries(Object.entries(this.fields).map(([name, field]) => [name, { name, path: this.paths[name]!, label: field.label, rules: field.rules, customValidators: field.validators.length }])), collections: Object.fromEntries(Object.entries(this.collections).map(([name, item]) => [name, item.description])) });
      descriptions.set(this, description);
    }
    return description;
  }
  inflate(flat: Readonly<Record<string, unknown>>): Record<string, unknown> {
    if (this.flat) return copy(flat);
    const result: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(flat)) {
      const path = this.paths[name]; if (path) writePath(result, path, copy(value));
    }
    return result;
  }
  /** Internal immutable projection: leaves are already owned and deeply frozen. */
  project(flat: Readonly<Record<string, unknown>>, previous?: Readonly<Record<string, unknown>>): Record<string, unknown> {
    if (this.flat) return flat;
    const result: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(flat)) {
      const path = this.paths[name]; if (path) writePath(result, path, value);
    }
    return share(previous, result);
  }
  /** Validate collection replacements before allocating row lifetimes or mutating a form. */
  assertCollections(flat: Readonly<Record<string, unknown>>): void {
    for (const [name, definition] of Object.entries(this.collections)) {
      if (!Object.hasOwn(flat, name)) continue;
      const items = flat[name];
      if (!Array.isArray(items)) throw new TypeError(`Collection ${name} requires an array`);
      for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError(`Collection ${name} items must be objects`);
        const values = { ...Object.fromEntries(Object.entries(definition.fields).map(([field, config]) => [field, config.initial])), ...definition.flattenPatch(copy(item)) };
        definition.assertCollections(values);
      }
    }
  }
  flattenPatch(patch: Readonly<Record<string, unknown>>): Record<string, unknown> {
    const result: Record<string, unknown> = Object.create(null);
    const visit = (value: Readonly<Record<string, unknown>>, parent: string[] = []) => {
      for (const [key, item] of Object.entries(value)) {
        const segments = [...parent, key];
        const name = parent.length ? segments.map(escapePath).join('.') : key;
        if (Object.hasOwn(this.fields, name)) { result[name] = item; continue; }
        safeSegment(key);
        if (!Object.values(this.paths).some(path => segments.every((segment, index) => path[index] === segment))) throw new TypeError(`Unknown field: ${name}`);
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError(`Nested patch ${name} must be an object`);
        visit(item as Record<string, unknown>, segments);
      }
    };
    visit(patch); return result;
  }
}
export function blueprint<const S extends BlueprintInput>(input: S): Blueprint<S> { return new Blueprint(input); }
export function nested<const S extends BlueprintInput>(schema: S): NestedSchema<S> { return Object.freeze({ kind: 'valixa.nested', schema }); }
export function collection<const S extends BlueprintInput>(schema: S, initial: readonly ValueInput<InferValues<S>>[] = []): CollectionSchema<S> { return Object.freeze({ kind: 'valixa.collection', schema, initial }); }
