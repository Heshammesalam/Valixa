'use client';
import { Autocomplete, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Radio, RadioGroup, Select, Switch, TextField } from '@mui/material';
import type { ComponentType } from 'react';
import { choiceValue, selectedOptions } from '@valixa/auto';
import type { AutoCodec } from '@valixa/auto';
import type { AutoRenderProps, ReactAutoAdapter } from '@valixa/react/auto';

function MuiWidget({ field, config, codec }: AutoRenderProps) {
  const inline = config.errorPlacement !== 'summary' && config.errorPlacement !== 'none';
  const error = inline ? field.error : undefined;
  const described = [config.description ? `${field.id}-description` : '', error ? field.errorId : ''].filter(Boolean).join(' ') || undefined;
  const common = { id: field.id, name: field.name, disabled: field.state.disabled, onBlur: field.onBlur };
  const aria = { 'aria-invalid': field.state.errors.length > 0, 'aria-describedby': described, 'aria-required': field.state.required };
  const readOnly = field.state.readonly;
  let control;
  if (['text', 'email', 'password', 'textarea', 'number', 'date'].includes(config.component)) {
    const number = config.component === 'number', date = config.component === 'date';
    const value = date ? codec!.decode(field.state.value) : field.state.value ?? '';
    control = <TextField {...common} label={config.label} required={field.state.required} type={number ? 'number' : date ? 'date' : config.component === 'textarea' ? 'text' : config.component}
      multiline={config.component === 'textarea'} value={value} error={Boolean(field.error)}
      onChange={event => { const raw = event.target.value; field.setValue(date ? codec!.encode(raw) : number ? raw.trim() === '' || !Number.isFinite(Number(raw)) ? config.emptyValue : Number(raw) : raw); }}
      slotProps={{ htmlInput: aria, input: { readOnly }, ...(date ? { inputLabel: { shrink: true } } : {}) }} />;
  } else if (config.component === 'checkbox' || config.component === 'switch') {
    const props = { ...common, checked: Boolean(field.state.value), onChange: (_event: unknown, checked: boolean) => field.setValue(checked), slotProps: { input: { ...aria, readOnly } } };
    control = <FormControlLabel label={config.label} control={config.component === 'checkbox' ? <Checkbox {...props} /> : <Switch {...props} />} />;
  } else if (config.component === 'select') {
    const indexes = selectedOptions(config, field.state.value).map(String);
    control = <FormControl disabled={field.state.disabled} error={Boolean(field.error)}><InputLabel id={`${field.id}-label`}>{config.label}</InputLabel>
      <Select {...common} label={config.label} labelId={`${field.id}-label`} multiple={Boolean(config.multiple)} value={config.multiple ? indexes : indexes[0] ?? ''} readOnly={readOnly} inputProps={aria}
        onChange={event => { const selected = event.target.value; const indexes = Array.isArray(selected) ? selected : selected === '' ? [] : typeof selected === 'string' && config.multiple ? selected.split(',') : [selected]; field.setValue(choiceValue(config, indexes.map(Number))); }}>
        {(config.options ?? []).map((option, index) => <MenuItem key={index} value={String(index)}>{option.label}</MenuItem>)}
      </Select></FormControl>;
  } else if (config.component === 'radio') {
    control = <FormControl disabled={field.state.disabled}><span id={`${field.id}-label`}>{config.label}</span><RadioGroup {...common} name={field.id} aria-labelledby={`${field.id}-label`} {...aria} value={String(selectedOptions(config, field.state.value)[0] ?? '')}
      onChange={(_event, value) => field.setValue(choiceValue(config, [Number(value)]))}>
      {(config.options ?? []).map((option, index) => <FormControlLabel key={index} value={String(index)} label={option.label} control={<Radio disabled={field.state.disabled || readOnly} />} />)}
    </RadioGroup></FormControl>;
  } else if (config.component === 'autocomplete') {
    const options = (config.options ?? []).map((option, index) => ({ label: option.label, index }));
    const selected = selectedOptions(config, field.state.value).map(index => options[index]!);
    control = <Autocomplete id={field.id} options={options} multiple={Boolean(config.multiple)} value={config.multiple ? selected : selected[0] ?? null} disabled={field.state.disabled} readOnly={readOnly} onBlur={field.onBlur}
      isOptionEqualToValue={(a, b) => a.index === b.index} getOptionLabel={option => option.label}
      onChange={(_event, value) => field.setValue(choiceValue(config, (Array.isArray(value) ? value : value ? [value] : []).map(option => option.index)))}
      renderInput={params => <TextField {...params} label={config.label} required={field.state.required} error={Boolean(field.error)} slotProps={{ htmlInput: { ...params.inputProps, ...aria } }} />} />;
  } else throw new TypeError(`MUI Auto Form cannot render ${config.component}`);
  return <>{control}{config.description && <small id={`${field.id}-description`}>{config.description}</small>}{error && <span id={field.errorId} role="alert">{error}</span>}</>;
}
export function createMuiAutoAdapter(options: { readonly custom?: Readonly<Record<string, ComponentType<AutoRenderProps<any>>>>; readonly codecs?: Readonly<Record<string, AutoCodec<any>>> } = {}): ReactAutoAdapter {
  return Object.freeze({ name: 'MUI', widgets: ['text', 'email', 'password', 'number', 'textarea', 'select', 'checkbox', 'radio', 'switch', 'autocomplete', 'date', 'custom'] as const,
    dateView: 'string', custom: Object.freeze(Object.keys(options.custom ?? {})), ...(options.codecs ? { codecs: options.codecs } : {}),
    renderField: (props: AutoRenderProps) => { if (props.config.component === 'custom') { const Custom = options.custom?.[props.config.renderer!]; if (!Custom) throw new TypeError(`Missing MUI custom renderer ${props.config.renderer}`); return <Custom {...props} />; } return <MuiWidget {...props} />; }
  });
}
export const muiAdapter = createMuiAutoAdapter();
