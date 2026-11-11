'use client';
import type { FieldValue } from '@valixa/core';

import { useValixaField } from '@valixa/react';
import type { FieldName, ValixaForm } from '@valixa/core';
import type { DatePickerProps } from '@mui/x-date-pickers/DatePicker';
import type { PickerValidDate } from '@mui/x-date-pickers/models';

/** Explicit boundary: never store a date-library instance in the plain-data core. */
export interface DateCodec<T> {
  readonly decode: (value: T) => PickerValidDate | null;
  /** Preserve invalid edits as an explicit plain-data sentinel validated by the blueprint. */
  readonly encode: (date: PickerValidDate | null, context: Parameters<NonNullable<DatePickerProps['onChange']>>[1]) => T;
}
export function useMuiDateField<V extends Record<string, unknown>, K extends FieldName<V>>(
  form: ValixaForm<V>, name: K, codec: DateCodec<FieldValue<V, K>>
): Pick<DatePickerProps, 'value' | 'onChange' | 'disabled' | 'readOnly' | 'slotProps'> {
  const field = useValixaField(form, name);
  return {
    value: codec.decode(field.state.value as FieldValue<V, K>), disabled: field.state.disabled, readOnly: field.state.readonly,
    onChange: (value, context) => { field.setValue(codec.encode(value, context)); },
    slotProps: { textField: { id: field.id, name, onBlur: field.onBlur,
      // MUI X 8's accessible PickersTextField owns its section/group ARIA and helper ID.
      ...(field.error ? { error: true, helperText: field.error } : {}) } }
  };
}
