'use client';
import type { FieldValue } from 'valixa';

import { useCallback } from 'react';
import TextField from '@mui/material/TextField';
import type { TextFieldProps } from '@mui/material/TextField';
import type { SelectProps } from '@mui/material/Select';
import type { CheckboxProps } from '@mui/material/Checkbox';
import type { SwitchProps } from '@mui/material/Switch';
import type { RadioGroupProps } from '@mui/material/RadioGroup';
import type { RadioProps } from '@mui/material/Radio';
import type { AutocompleteProps } from '@mui/material/Autocomplete';
import type { FieldName, ValixaForm } from 'valixa';
import { useValixaField } from 'valixa-react';

type TextValue = string | null | undefined;
type TextOptions<T> = { parse?: (raw: string) => T; type?: string; helperText?: string };
type Available<T, A, P> = [T] extends [A] ? P : never;
type OptionOf<T> = NonNullable<T> extends readonly (infer O)[] ? O : NonNullable<T>;
type Multiple<T> = NonNullable<T> extends readonly unknown[] ? true : false;
type AutoOptions<T> = {
  multiple: Multiple<T>; label: string; helperText?: string;
  isOptionEqualToValue?: (option: OptionOf<T>, value: OptionOf<T>) => boolean;
} & (OptionOf<T> extends object ? { isOptionEqualToValue: (option: OptionOf<T>, value: OptionOf<T>) => boolean } : object);
type AutoBinding<T> = Pick<AutocompleteProps<OptionOf<T>, Multiple<T>, false, false>,
  'id' | 'value' | 'onChange' | 'onBlur' | 'disabled' | 'readOnly' | 'renderInput' | 'multiple' | 'isOptionEqualToValue'>;
type SelectOptions<T> = { parse?: (value: unknown) => T } & (NonNullable<T> extends readonly unknown[] ? { multiple: true } : { multiple?: false });

/** One field subscription. The returned mapping methods are pure, ordinary functions. */
export function useMuiField<V extends Record<string, unknown>, K extends FieldName<V>>(form: ValixaForm<V>, name: K) {
  const field = useValixaField(form, name);
  const { state, error } = field;
  // Read the store at event time; stale rendered props cannot bypass readonly changes.
  const write = field.setValue;
  const onTextChange = useCallback((event: { target: { value: string } }) => write(event.target.value as FieldValue<V, K>), [write]);
  const onCheckedChange = useCallback((_event: unknown, checked: boolean) => write(checked as FieldValue<V, K>), [write]);
  const onValueChange = useCallback((_event: unknown, value: FieldValue<V, K>) => write(value), [write]);
  const onRadioChange = useCallback((_event: unknown, value: string) => write(value as FieldValue<V, K>), [write]);
  const inputA11y = { 'aria-invalid': Boolean(error), 'aria-describedby': error ? field.errorId : undefined };
  const helperTextProps = { id: field.errorId, error: Boolean(error), children: error };

  function textField(options: TextOptions<FieldValue<V, K>> = {}): Available<FieldValue<V, K>, TextValue, TextFieldProps> {
    return {
      id: field.id, name, value: state.value ?? '', disabled: state.disabled, onBlur: field.onBlur,
      onChange: options.parse ? (event: { target: { value: string } }) => write(options.parse!(event.target.value)) : onTextChange,
      type: options.type ?? 'text', error: Boolean(error), helperText: error ?? options.helperText,
      slotProps: { htmlInput: { ...inputA11y, 'aria-required': state.required, 'aria-describedby': error || options.helperText ? field.errorId : undefined }, input: { readOnly: state.readonly }, formHelperText: { id: field.errorId } }
    } as unknown as Available<FieldValue<V, K>, TextValue, TextFieldProps>;
  }

  /** Explicit empty-value policy keeps number-only fields from accidentally receiving null. */
  function numberField(options: { emptyValue: FieldValue<V, K>; helperText?: string }): Available<FieldValue<V, K>, number | null | undefined, TextFieldProps> {
    const props: TextFieldProps = {
      id: field.id, name, value: state.value ?? '', type: 'number', disabled: state.disabled,
      onBlur: field.onBlur, error: Boolean(error), helperText: error ?? options.helperText,
      onChange: event => {
        const raw = event.target.value;
        const number = Number(raw);
        write(raw.trim() === '' || !Number.isFinite(number) ? options.emptyValue : number as FieldValue<V, K>);
      },
      slotProps: { htmlInput: { ...inputA11y, 'aria-describedby': error || options.helperText ? field.errorId : undefined }, input: { readOnly: state.readonly }, formHelperText: { id: field.errorId } }
    };
    return props as Available<FieldValue<V, K>, number | null | undefined, TextFieldProps>;
  }
  function checkbox(): Available<FieldValue<V, K>, boolean | null | undefined, CheckboxProps> {
    const props: CheckboxProps = { id: field.id, name, checked: Boolean(state.value), onChange: onCheckedChange, onBlur: field.onBlur,
      disabled: state.disabled, slotProps: { input: { ...inputA11y, readOnly: state.readonly } }
    };
    return props as Available<FieldValue<V, K>, boolean | null | undefined, CheckboxProps>;
  }
  function switchField(): Available<FieldValue<V, K>, boolean | null | undefined, SwitchProps> {
    return checkbox() as Available<FieldValue<V, K>, boolean | null | undefined, SwitchProps>;
  }
  function select(options: SelectOptions<FieldValue<V, K>>): SelectProps<FieldValue<V, K>> {
    return {
      id: field.id, name, labelId: `${field.id}-label`, value: state.value ?? (options.multiple ? [] : ''),
      multiple: options.multiple ?? false, onBlur: field.onBlur, disabled: state.disabled, readOnly: state.readonly,
      error: Boolean(error), inputProps: { ...inputA11y, readOnly: state.readonly },
      onChange: event => {
        const value: unknown = (event as { target: { value: unknown } }).target.value;
        // MUI documents a comma-delimited string fallback from browser autofill.
        const normalized = options.multiple && typeof value === 'string' ? value.split(',') : value;
        write(options.parse ? options.parse(normalized) : normalized as FieldValue<V, K>);
      }
    } as SelectProps<FieldValue<V, K>>;
  }
  function radioGroup(): Available<FieldValue<V, K>, TextValue, RadioGroupProps> {
    const props: RadioGroupProps = { id: field.id, name, value: state.value ?? '', onChange: onRadioChange, onBlur: field.onBlur,
      ...inputA11y, 'aria-disabled': state.disabled, 'aria-readonly': state.readonly
    };
    return props as Available<FieldValue<V, K>, TextValue, RadioGroupProps>;
  }
  function radio(): RadioProps {
    return { disabled: state.disabled, slotProps: { input: { ...inputA11y, readOnly: state.readonly } } };
  }
  function autocomplete(options: AutoOptions<FieldValue<V, K>>): AutoBinding<FieldValue<V, K>> {
    return {
      id: field.id, value: state.value ?? (options.multiple ? [] : null), multiple: options.multiple,
      disabled: state.disabled, readOnly: state.readonly, onBlur: field.onBlur, onChange: onValueChange,
      isOptionEqualToValue: options.isOptionEqualToValue,
      renderInput: params => <TextField {...params} label={options.label} error={Boolean(error)} helperText={error ?? options.helperText}
        slotProps={{ input: { ...params.InputProps, readOnly: state.readonly },
          htmlInput: { ...params.inputProps, ...inputA11y, 'aria-describedby': error || options.helperText ? field.errorId : undefined }, formHelperText: { id: field.errorId } }} />
    } as AutoBinding<FieldValue<V, K>>;
  }
  return { ...field, textField, numberField, checkbox, switch: switchField, select, radioGroup, radio, autocomplete,
    helperTextProps, formControlProps: { error: Boolean(error), disabled: state.disabled },
    inputLabelProps: { id: `${field.id}-label`, htmlFor: field.id } };
}
