/** Validation returns true/undefined for success, false or a message for failure. */
export type ValidationOutcome = boolean | string | void;
export interface ValidationContext {
  readonly values: Readonly<Record<string, unknown>>;
  readonly field: string;
  readonly signal: AbortSignal;
}
export type Validator<T = unknown> = (value: T, context: ValidationContext) => ValidationOutcome | Promise<ValidationOutcome>;
export type RuleInput = string | readonly string[];
export interface FieldDefinition<T = unknown> {
  readonly initial: T;
  readonly rules?: RuleInput;
  readonly validate?: Validator<T> | readonly Validator<T>[];
  readonly label?: string;
}
export type FieldInput = readonly [unknown, RuleInput?] | FieldDefinition<any>;
export type BlueprintInput = Record<string, FieldInput>;
type Widen<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : T;
export type InferValues<S extends BlueprintInput> = {
  -readonly [K in keyof S]: Widen<S[K] extends readonly [infer T, ...unknown[]] ? T : S[K] extends FieldDefinition<infer T> ? T : never>;
};
export type FieldName<V> = Extract<keyof V, string>;
export type Errors<V> = Readonly<Partial<Record<FieldName<V>, readonly string[]>>>;
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export interface FormState<V> {
  readonly values: DeepReadonly<V>;
  readonly initialValues: DeepReadonly<V>;
  readonly errors: Errors<V>;
  readonly touched: Readonly<Record<FieldName<V>, boolean>>;
  readonly dirty: boolean;
  readonly pristine: boolean;
  /** No known errors; use validate() to establish validity. */
  readonly valid: boolean;
  readonly invalid: boolean;
  readonly validating: boolean;
  readonly submitting: boolean;
  readonly submitted: boolean;
  readonly submitCount: number;
  readonly disabled: boolean;
  readonly readonly: boolean;
}
export interface FieldState<T> {
  readonly value: DeepReadonly<T>;
  readonly initialValue: DeepReadonly<T>;
  readonly errors: readonly string[];
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly validating: boolean;
  readonly disabled: boolean;
  readonly readonly: boolean;
}
export interface ValidationResult<V> { readonly valid: boolean; readonly errors: Errors<V>; readonly stale: boolean }
export interface SubmitContext { readonly signal: AbortSignal }
export type SubmitHandler<V, R> = (values: V, context: SubmitContext) => R | Promise<R>;
export type SubmitResult<V, R> =
  | { readonly status: 'success'; readonly data: R }
  | { readonly status: 'invalid'; readonly errors: Errors<V> }
  | { readonly status: 'busy' | 'stale' | 'cancelled' };
export interface FormOptions {
  readonly validateOn?: 'change' | 'blur' | 'submit';
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  /** Override message templates; {label} and {param} are interpolated. */
  readonly messages?: Readonly<Record<string, string>>;
}
