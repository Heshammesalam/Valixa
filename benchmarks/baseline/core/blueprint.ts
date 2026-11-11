import { copy, freeze } from './data.js';
import { parseRules } from './rules.js';
import type { ParsedRule } from './rules.js';
import type { BlueprintInput, FieldDefinition, InferValues, Validator } from './types.js';

export interface CompiledField {
  readonly initial: unknown;
  readonly label: string;
  readonly rules: readonly ParsedRule[];
  readonly validators: readonly Validator[];
}
/** Immutable reusable definition. Each createValixa call owns independent state. */
export class Blueprint<S extends BlueprintInput> {
  declare readonly __values: InferValues<S>;
  readonly fields: Readonly<Record<string, CompiledField>>;
  constructor(input: S) {
    const entries = Object.entries(input).map(([name, field]) => {
      if (['__proto__', 'prototype', 'constructor'].includes(name)) throw new TypeError(`Reserved field name: ${name}`);
      const definition = (Array.isArray(field) ? { initial: field[0], rules: field[1] } : field) as FieldDefinition;
      if (!definition || !Object.hasOwn(definition, 'initial')) throw new TypeError(`Field ${name} requires an initial value`);
      const validate = definition.validate;
      const validators = validate === undefined ? [] : typeof validate === 'function' ? [validate] : [...validate];
      if (validators.some(validator => typeof validator !== 'function')) throw new TypeError(`Invalid validator for ${name}`);
      return [name, { initial: copy(definition.initial), label: definition.label ?? name, rules: parseRules(definition.rules), validators }] as const;
    });
    this.fields = freeze(Object.fromEntries(entries));
    for (const [name, field] of Object.entries(this.fields)) {
      for (const rule of field.rules) {
        if (rule.name === 'same' && !Object.hasOwn(this.fields, rule.param!)) throw new TypeError(`Field ${name} references unknown field ${rule.param}`);
      }
    }
    Object.freeze(this);
  }
}
export function blueprint<const S extends BlueprintInput>(input: S): Blueprint<S> { return new Blueprint(input); }
