import { blueprint, Blueprint } from './blueprint.js';
import { copy } from './data.js';
import type { BlueprintInput, FormOptions, InferValues, Validator, ValueInput } from './types.js';

/** Structural Standard Schema v1 contract. No schema vendor is bundled. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
    readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>;
  };
}
export interface StandardIssue {
  readonly message: string;
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined;
}
export type StandardResult<T> = { readonly value: T; readonly issues?: undefined } | { readonly issues: readonly StandardIssue[] };
export type StandardInput<S extends StandardSchemaV1> = NonNullable<S['~standard']['types']>['input'];
export type StandardOutput<S extends StandardSchemaV1> = NonNullable<S['~standard']['types']>['output'];

function assertSchema(schema: StandardSchemaV1): void {
  if (schema?.['~standard']?.version !== 1 || typeof schema['~standard'].validate !== 'function') throw new TypeError('Expected a Standard Schema v1 validator');
}
function aborted(): Error { const error = new Error('Schema validation aborted'); error.name = 'AbortError'; return error; }
async function run<S extends StandardSchemaV1>(schema: S, value: unknown, signal?: AbortSignal): Promise<StandardResult<StandardOutput<S>>> {
  if (signal?.aborted) throw aborted();
  // Providers may cast/mutate input. Never expose a form snapshot or caller-owned data.
  const input = copy(value);
  let off = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    const abort = () => reject(aborted());
    signal?.addEventListener('abort', abort, { once: true });
    off = () => signal?.removeEventListener('abort', abort);
  });
  try {
    const work = Promise.resolve().then(() => {
      if (signal?.aborted) throw aborted();
      return schema['~standard'].validate(input);
    });
    const result = await Promise.race([work, cancelled]);
    if (signal?.aborted) throw aborted();
    if (!result || typeof result !== 'object' || (result.issues !== undefined && (!Array.isArray(result.issues) || result.issues.length === 0)) || (result.issues === undefined && !Object.hasOwn(result, 'value'))) throw new TypeError('Invalid Standard Schema result');
    if (result.issues?.some(issue => !issue || typeof issue.message !== 'string')) throw new TypeError('Invalid Standard Schema issue');
    return result as StandardResult<StandardOutput<S>>;
  } finally { off(); }
}

/** Field validation preserves the input value; schema transformations are not stored. */
export function standardValidator<S extends StandardSchemaV1>(schema: S): Validator<StandardInput<S>> {
  assertSchema(schema);
  return async (value, { signal }) => {
    const result = await run(schema, value, signal);
    return result.issues?.[0]?.message ?? true;
  };
}

/** Map provider paths through the actual blueprint, including literal dotted keys.
 * Issues inside a collection are aggregated on its collection field. Row forms
 * can use their own adapter for individual row-field messages.
 */
export function standardFormValidator<S extends StandardSchemaV1, const B extends BlueprintInput>(
  schema: S,
  input: (B | Blueprint<B>) & (ValueInput<InferValues<NoInfer<B>>> extends StandardInput<NoInfer<S>> ? unknown : never)
): NonNullable<FormOptions<InferValues<B>>['validateForm']> {
  assertSchema(schema);
  const definition = input instanceof Blueprint ? input : blueprint(input);
  const fields = Object.entries(definition.description.fields);
  if (fields.some(([name]) => name === '$form')) throw new TypeError('Standard form validation reserves the $form field name');
  return async (values, { signal }) => {
    const result = await run(schema, values, signal);
    const errors: Record<string, string[]> = Object.create(null);
    for (const issue of result.issues ?? []) {
      const path = issue.path?.map(segment => typeof segment === 'object' && segment !== null ? segment.key : segment);
      const exact = path && fields.find(([, field]) => field.path.length === path.length && field.path.every((key, i) => key === path[i]));
      const collection = !exact && path ? fields.find(([name, field]) => Object.hasOwn(definition.collections, name) && field.path.every((key, i) => key === path[i])) : undefined;
      const name = (exact || collection)?.[0] ?? '$form';
      (errors[name] ??= []).push(issue.message);
    }
    return errors;
  };
}

export class StandardSchemaError extends Error {
  readonly issues: readonly StandardIssue[];
  constructor(issues: readonly StandardIssue[]) {
    super('Schema validation failed'); this.name = 'StandardSchemaError';
    this.issues = Object.freeze(issues.map(issue => Object.freeze({ message: issue.message, ...(issue.path ? { path: Object.freeze(issue.path.map(part => typeof part === 'object' && part !== null ? Object.freeze({ key: part.key }) : part)) } : {}) })));
  }
}
/** Explicit typed output parsing for submit/API boundaries, not a form-state mutation. */
export async function parseStandard<S extends StandardSchemaV1>(schema: S, value: StandardInput<S>, options: { readonly signal?: AbortSignal } = {}): Promise<StandardOutput<S>> {
  assertSchema(schema);
  const result = await run(schema, value, options.signal);
  if (result.issues) throw new StandardSchemaError(result.issues);
  return result.value;
}
