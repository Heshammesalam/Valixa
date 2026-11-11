import type { FieldValue } from 'valixa';
import { computed, onScopeDispose, shallowReadonly, shallowRef, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useValixaField } from 'valixa-vue';
import type { DeepReadonly, FieldName, ValixaForm } from 'valixa';
import type { FieldOptions, VuetifyCommonProps } from './index.js';

export interface FileMetadata { readonly name: string; readonly size: number; readonly type: string; readonly lastModified: number }
export interface FileCodec<T> { readonly encode: (files: readonly File[]) => T }
/** Bytes stay in the adapter; this encoder stores ordinary metadata only. */
export const fileMetadata: FileCodec<FileMetadata[]> = Object.freeze({ encode: (files: readonly File[]) => files.map(file => ({
  name: file.name, size: file.size, type: file.type, lastModified: file.lastModified
})) });
export interface FileField {
  readonly props: ComputedRef<VuetifyCommonProps & { multiple: boolean; modelValue: File | File[] | null; 'onUpdate:modelValue': (value: unknown) => void }>;
  readonly files: Readonly<Ref<readonly File[]>>;
  /** Explicitly forget local bytes, e.g. after an application-owned upload. */
  readonly clearLocal: () => void;
}
function equalData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equalData((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
export function useVuetifyFileField<V extends Record<string, unknown>, K extends FieldName<V>>(
  form: ValixaForm<V>, name: K, codec: FileCodec<FieldValue<V, K>>, options: FieldOptions & { multiple: boolean }
): FileField {
  const field = useValixaField(form, name);
  const files = shallowRef<readonly File[]>(Object.freeze([]));
  let writing = false;
  const clearLocal = () => { files.value = Object.freeze([]); };
  watch(field.state, (next, previous) => {
    if (!writing && !equalData(next.value, previous.value)) clearLocal();
  }, { flush: 'sync' });
  onScopeDispose(clearLocal);
  const update = (payload: unknown) => {
    if (field.state.value.disabled || field.state.value.readonly) return;
    const selected: unknown[] = payload == null ? [] : Array.isArray(payload) ? payload : [payload];
    if (selected.some(value => typeof File === 'undefined' || !(value instanceof File))) throw new TypeError('VFileInput must emit File, File[], or null');
    const incoming = Object.freeze((options.multiple ? selected : selected.slice(0, 1)) as File[]);
    const encoded = codec.encode(incoming);
    writing = true;
    try { field.setValue(encoded); files.value = incoming; } finally { writing = false; }
  };
  const props = computed(() => {
    const state = field.state.value;
    return { id: field.id, name: field.name, modelValue: options.multiple ? [...files.value] : files.value[0] ?? null,
      multiple: options.multiple, 'onUpdate:modelValue': update, onBlur: field.onBlur,
      errorMessages: [...state.errors], error: state.errors.length > 0, disabled: state.disabled, readonly: state.readonly,
      required: options.required ?? false, 'aria-required': options.required ?? false, 'aria-invalid': state.errors.length > 0,
      rules: [] as never[], validateOn: 'submit' as const, ...(options.label === undefined ? {} : { label: options.label }) };
  });
  return Object.freeze({ props, files: shallowReadonly(files), clearLocal });
}
