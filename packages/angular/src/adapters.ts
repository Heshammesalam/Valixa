import { InjectionToken, inject } from '@angular/core';
import type { Provider } from '@angular/core';
import type { ControlValueAccessor } from '@angular/forms';

export interface ControlStatus {
  readonly name: string; readonly id: string; readonly errorId: string;
  readonly errors: readonly string[]; readonly touched: boolean; readonly dirty: boolean;
  readonly validating: boolean; readonly disabled: boolean; readonly readonly: boolean;
  readonly required?: boolean; readonly visible?: boolean; readonly pending?: boolean;
}
export interface ValixaControlAdapter<View> {
  readonly requiresCodec?: boolean;
  /** CVAs/native inputs already update their view; controlled input/output components normally need an echo. */
  readonly preserveViewOnChange?: boolean;
  writeValue(value: View): void;
  setState(state: ControlStatus): void;
  connect(change: (value: View) => void, touched: () => void): () => void;
}
export interface ValueCodec<T, View> { readonly encode: (value: View) => T; readonly decode: (value: T) => View }
export const VALIXA_CONTROL = new InjectionToken<ValixaControlAdapter<unknown>>('Valixa explicit control adapter');
export function provideValixaControl<View>(factory: () => ValixaControlAdapter<View>): Provider {
  return { provide: VALIXA_CONTROL, useFactory: factory };
}
export function valueAccessorAdapter<View>(accessor: ControlValueAccessor, setState?: (state: ControlStatus) => void): ValixaControlAdapter<View> {
  return { preserveViewOnChange: true, writeValue: value => accessor.writeValue(value),
    setState: state => { accessor.setDisabledState?.(state.disabled || state.readonly); setState?.(state); },
    connect(change, touched) { accessor.registerOnChange(change); accessor.registerOnTouched(touched);
      return () => { accessor.registerOnChange(() => {}); accessor.registerOnTouched(() => {}); }; } };
}
export function numberCodec<T extends number | null | undefined>(emptyValue: T): ValueCodec<T | number, string> {
  return { encode: value => value.trim() === '' || !Number.isFinite(Number(value)) ? emptyValue : Number(value), decode: value => value == null ? '' : String(value) };
}
