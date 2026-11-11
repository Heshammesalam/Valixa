import type { FieldValue } from '@valixa/core';
import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { useValixaField } from '@valixa/vue';
import type { DeepReadonly, FieldName, ValixaForm } from '@valixa/core';
import type { VueField } from '@valixa/vue';

export interface FieldOptions { readonly label?: string; readonly required?: boolean }
export interface VuetifyCommonProps {
  id: string; name: string; errorMessages: string[]; error: boolean; disabled: boolean; readonly: boolean;
  required: boolean; 'aria-required': boolean; 'aria-invalid': boolean; rules: never[]; validateOn: 'submit';
  label?: string; onBlur: () => void;
}
export type Item<T> = NonNullable<T> extends readonly (infer E)[] ? E : NonNullable<T>;
type ReturnObject<T> = [Item<T>] extends [string | number | boolean] ? { returnObject?: false } : { returnObject: true };
type SelectionOptions<T, K extends string> = FieldOptions & { kind: K; itemTitle?: string; itemValue?: string } & ReturnObject<T> &
  ([NonNullable<T>] extends [readonly unknown[]] ? { multiple: true } : { multiple: false; clearValue: T });
export type SelectOptions<T> = SelectionOptions<T, 'select' | 'autocomplete'>;
export type VuetifyOptions<T> =
  | ([T] extends [string | null | undefined] ? string extends T ? FieldOptions & { kind: 'text' | 'textarea' } : never : never)
  | ([T] extends [boolean | null | undefined] ? boolean extends T ? FieldOptions & { kind: 'checkbox' | 'switch' } : never : never)
  | ([T] extends [number | null | undefined] ? number extends T ? FieldOptions & { kind: 'number'; emptyValue: T } : never : never)
  | (string extends Item<T> ? SelectionOptions<T, 'combobox'> : never)
  | ([T] extends [string | number | null | undefined] ? FieldOptions & { kind: 'radio' } : never)
  | SelectOptions<T>;
export interface VuetifyBinding<T, K extends string = string> extends VuetifyCommonProps {
  modelValue: K extends 'text' | 'textarea' ? string : K extends 'checkbox' | 'switch' ? boolean : K extends 'number' ? string | number : DeepReadonly<T>;
  'onUpdate:modelValue': (value: unknown) => void;
  multiple?: boolean; returnObject?: boolean; itemTitle?: string; itemValue?: string; type?: string;
}
function commonProps<T>(field: VueField<T>, options: FieldOptions): VuetifyCommonProps {
  const state = field.state.value;
  return { id: field.id, name: field.name, onBlur: field.onBlur, errorMessages: [...state.errors], error: state.errors.length > 0,
    disabled: state.disabled, readonly: state.readonly, required: options.required ?? state.required,
    'aria-required': options.required ?? state.required, 'aria-invalid': state.errors.length > 0, rules: [], validateOn: 'submit',
    ...(options.label === undefined ? {} : { label: options.label }) };
}
/** Configure once during setup. The computed binding unwraps directly in v-bind. */
export function useVuetifyField<V extends Record<string, unknown>, K extends FieldName<V>, const O extends VuetifyOptions<FieldValue<V, K>>>(
  form: ValixaForm<V>, name: K, options: O
): ComputedRef<VuetifyBinding<FieldValue<V, K>, O['kind']>> {
  const field = useValixaField(form, name);
  const update = (value: unknown) => {
    if (options.kind === 'text' || options.kind === 'textarea') {
      if (value !== null && typeof value !== 'string') throw new TypeError('Text controls emit string or null');
      field.setValue((value ?? '') as FieldValue<V, K>);
    } else if (options.kind === 'checkbox' || options.kind === 'switch') {
      if (value !== null && typeof value !== 'boolean') throw new TypeError('Checked controls emit boolean or null');
      field.setValue((value ?? false) as FieldValue<V, K>);
    } else if (options.kind === 'number') {
      if (value != null && typeof value !== 'string' && typeof value !== 'number') throw new TypeError('Numeric controls emit string, number or null');
      const number = Number(value);
      field.setValue(value == null || value === '' || !Number.isFinite(number) ? options.emptyValue : number as FieldValue<V, K>);
    } else if (options.kind === 'radio') {
      field.setValue(value as FieldValue<V, K>);
    } else if (options.kind === 'select' || options.kind === 'autocomplete' || options.kind === 'combobox') {
      if (options.multiple) {
        if (value != null && !Array.isArray(value)) throw new TypeError('Multiple selection requires an array');
        field.setValue((value ?? []) as FieldValue<V, K>);
      } else if (value == null) {
        if (!('clearValue' in options)) throw new TypeError('Single selections require an explicit clearValue');
        field.setValue(options.clearValue as FieldValue<V, K>);
      } else field.setValue(value as FieldValue<V, K>);
    }
  };
  return computed(() => {
    const value = field.state.value.value;
    let modelValue: unknown = value;
    if (options.kind === 'text' || options.kind === 'textarea') modelValue = String(value ?? '');
    else if (options.kind === 'checkbox' || options.kind === 'switch') modelValue = Boolean(value);
    else if (options.kind === 'number') modelValue = value ?? '';
    else if ((options.kind === 'select' || options.kind === 'autocomplete' || options.kind === 'combobox') && options.multiple) modelValue = value ?? [];
    return { ...commonProps(field, options), modelValue, 'onUpdate:modelValue': update,
      ...(options.kind === 'number' ? { type: 'number' } : {}),
      ...(options.kind === 'select' || options.kind === 'autocomplete' || options.kind === 'combobox' ? { multiple: options.multiple, returnObject: options.returnObject ?? false,
        ...(options.itemTitle === undefined ? {} : { itemTitle: options.itemTitle }),
        ...(options.itemValue === undefined ? {} : { itemValue: options.itemValue }) } : {}) } as VuetifyBinding<FieldValue<V, K>, O['kind']>;
  });
}

export { useVuetifyFileField, fileMetadata } from './files.js';
export type { FileCodec, FileMetadata, FileField } from './files.js';
