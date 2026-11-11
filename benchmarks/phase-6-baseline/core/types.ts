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
  /** Omit for conservative custom-validator invalidation; [] declares independence. */
  readonly dependsOn?: readonly string[];
}
export type FieldInput = readonly [unknown, RuleInput?] | FieldDefinition<any>;
export declare const nestedValues: unique symbol;
export interface NestedSchema<S extends BlueprintInput = BlueprintInput> { readonly kind: 'valixa.nested'; readonly schema: S }
export declare const collectionValues: unique symbol;
export interface CollectionSchema<S extends BlueprintInput = BlueprintInput> { readonly kind: 'valixa.collection'; readonly schema: S; readonly initial: readonly ValueInput<InferValues<S>>[] }
export type BlueprintInput = { readonly [key: string]: FieldInput | NestedSchema | CollectionSchema };
type Widen<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : T;
export type InferValues<S extends BlueprintInput> = {
  -readonly [K in keyof S]: S[K] extends NestedSchema<infer N> ? InferValues<N> & { readonly [nestedValues]: true } : S[K] extends CollectionSchema<infer N> ? InferValues<N>[] & { readonly [collectionValues]: N } : Widen<S[K] extends readonly [infer T, ...unknown[]] ? T : S[K] extends FieldDefinition<infer T> ? T : never>;
};
type Escape<S extends string> = S extends `${infer A}\\${infer B}` ? `${Escape<A>}\\\\${Escape<B>}` : S extends `${infer A}.${infer B}` ? `${Escape<A>}\\.${Escape<B>}` : S;
type NestedNames<V, D extends unknown[] = []> = D['length'] extends 8 ? never : {
  [K in Extract<keyof V, string>]: V[K] extends { readonly [nestedValues]: true } ? `${Escape<K>}.${NestedNames<V[K], [...D, 0]>}` : Escape<K>
}[Extract<keyof V, string>];
export type FieldName<V> = string extends keyof V ? string : { [K in Extract<keyof V, string>]: V[K] extends { readonly [nestedValues]: true } ? `${Escape<K>}.${NestedNames<V[K]>}` : K }[Extract<keyof V, string>];
type Split<S extends string, Part extends string = '', Parts extends string[] = []> = S extends `\\${infer C}${infer Rest}` ? Split<Rest, `${Part}${C}`, Parts> : S extends `.${infer Rest}` ? Split<Rest, '', [...Parts, Part]> : S extends `${infer C}${infer Rest}` ? Split<Rest, `${Part}${C}`, Parts> : [...Parts, Part];
type At<V, P extends readonly string[]> = P extends [infer K extends string, ...infer R extends string[]] ? K extends keyof V ? R extends [] ? V[K] : At<V[K], R> : never : never;
export type FieldValue<V, K extends string> = K extends keyof V ? V[K] : At<V, Split<K>>;
export type ValueInput<T> = T extends readonly (infer Item)[] ? ValueInput<Item>[] : T extends object ? { -readonly [K in Extract<keyof T, string>]: ValueInput<T[K]> } : T;
export type ValuesPatch<V> = { [K in Extract<keyof V, string>]?: V[K] extends { readonly [nestedValues]: true } ? ValuesPatch<V[K]> : V[K] extends { readonly [collectionValues]: BlueprintInput } ? ValueInput<V[K]> : V[K] };
export type CollectionName<V> = { [K in FieldName<V>]: FieldValue<V, K> extends { readonly [collectionValues]: BlueprintInput } ? K : never }[FieldName<V>];
export type CollectionBlueprint<V, K extends string> = FieldValue<V, K> extends { readonly [collectionValues]: infer S extends BlueprintInput } ? S : never;
export type Errors<V> = Readonly<Partial<Record<FieldName<V>, readonly string[]>>>;
export type DeepReadonly<T> = T extends { readonly [collectionValues]: BlueprintInput } & readonly (infer Item)[] ? readonly DeepReadonly<Item>[] : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export interface FormState<V> {
  readonly locale: string;
  readonly errorDetails: Readonly<Partial<Record<FieldName<V>, readonly import('./locales.js').ValidationErrorDetail[]>>>;
  readonly formErrors: readonly string[];
  readonly values: DeepReadonly<V>;
  readonly initialValues: DeepReadonly<V>;
  readonly errors: Errors<V>;
  /** Nested projections for explicit nested schemas; legacy names remain literal keys. */
  readonly nestedErrors: DeepReadonly<Record<string, unknown>>;
  readonly nestedTouched: DeepReadonly<Record<string, unknown>>;
  readonly nestedDirty: DeepReadonly<Record<string, unknown>>;
  readonly touched: Readonly<Record<FieldName<V>, boolean>>;
  readonly dirty: boolean;
  readonly pristine: boolean;
  /** No known errors; use validate() to establish validity. */
  readonly valid: boolean;
  readonly invalid: boolean;
  readonly validating: boolean;
  /** Includes debounced automatic validation and running requests. */
  readonly pending: boolean;
  readonly submitting: boolean;
  readonly submitted: boolean;
  readonly submitCount: number;
  readonly disabled: boolean;
  readonly readonly: boolean;
}
export interface FieldState<T> {
  readonly visible: boolean;
  readonly required: boolean;
  readonly validationEnabled: boolean;
  readonly value: DeepReadonly<T>;
  readonly initialValue: DeepReadonly<T>;
  readonly errors: readonly string[];
  readonly touched: boolean;
  readonly dirty: boolean;
  readonly validating: boolean;
  readonly pending: boolean;
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
export interface FormValidationContext { readonly signal: AbortSignal }
export type FormValidationErrors = Readonly<Record<string, string | readonly string[] | undefined>>;
export interface FormOptions<V = any> {
  readonly validateForm?: (values: DeepReadonly<V>, context: FormValidationContext) => FormValidationErrors | Promise<FormValidationErrors>;
  readonly formDependsOn?: readonly string[];
  readonly locale?: string;
  readonly fallbackLocale?: string;
  readonly labels?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly behaviors?: Readonly<Record<string, FieldBehavior>>;
  readonly validation?: {
    readonly mode?: 'manual' | 'immediate' | 'onChange' | 'onBlur' | 'onSubmit';
    /** Automatic validation delay, independently owned by each field. */
    readonly debounce?: number;
    /** Running field timeout in milliseconds. Omit for no timeout. */
    readonly timeout?: number;
  };
  readonly validateOn?: 'change' | 'blur' | 'submit';
  readonly disabled?: boolean;
  readonly readonly?: boolean;
  /** Override message templates; {label} and {param} are interpolated. */
  readonly messages?: Readonly<Record<string, string>>;
}
export interface BehaviorContext { readonly values: Readonly<Record<string, unknown>> }
export interface FieldBehavior {
  readonly dependsOn?: readonly string[];
  readonly visibleWhen?: (context: BehaviorContext) => boolean;
  readonly enabledWhen?: (context: BehaviorContext) => boolean;
  readonly requiredWhen?: (context: BehaviorContext) => boolean;
  readonly readonlyWhen?: (context: BehaviorContext) => boolean;
  readonly resetWhen?: (context: BehaviorContext) => boolean;
  readonly validateWhen?: (context: BehaviorContext) => boolean;
}
