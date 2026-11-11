// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Autocomplete, Checkbox, FormControl, FormControlLabel, FormHelperText, InputLabel, MenuItem, Radio, RadioGroup, Select, Switch, TextField } from '@mui/material';
import { createValixa } from 'valixa';
import { useMuiField } from 'valixa-mui';
import { useMuiDateField } from 'valixa-mui/x';
import type { DateCodec } from 'valixa-mui/x';
import dayjs from 'dayjs';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

afterEach(cleanup);
describe('MUI component contracts', () => {
  it('uses checked callbacks, reset, blur, readonly and disabled for Checkbox/Switch', async () => {
    const form = createValixa({ agreed: [false, 'required'], updates: [false] });
    function Controls() {
      const agreed = useMuiField(form, 'agreed'), updates = useMuiField(form, 'updates');
      return <><FormControl {...agreed.formControlProps}><FormControlLabel label="Agree" control={<Checkbox {...agreed.checkbox()} />} />
        <FormHelperText {...agreed.helperTextProps} /></FormControl>
        <FormControlLabel label="Updates" control={<Switch {...updates.switch()} />} /></>;
    }
    render(<Controls />);
    fireEvent.click(screen.getByLabelText('Agree')); fireEvent.click(screen.getByLabelText('Updates'));
    expect(form.state.values).toEqual({ agreed: true, updates: true });
    fireEvent.blur(screen.getByLabelText('Agree')); expect(form.state.touched.agreed).toBe(true);
    act(() => form.reset()); expect((screen.getByLabelText('Agree') as HTMLInputElement).checked).toBe(false);
    act(() => form.setReadonly(true)); fireEvent.click(screen.getByLabelText('Agree')); expect(form.state.values.agreed).toBe(false);
    expect((screen.getByLabelText('Agree') as HTMLInputElement).checked).toBe(false);
    act(() => form.setDisabled(true)); expect((screen.getByLabelText('Updates') as HTMLInputElement).disabled).toBe(true);
    act(() => { form.setDisabled(false); form.setReadonly(false); form.setError('agreed', 'Please agree'); });
    const input = screen.getByLabelText('Agree');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('Please agree').id);
  });
  it('maps actual Select selection and labels/error descriptions', async () => {
    const form = createValixa({ country: ['', 'required'] });
    function Control() {
      const field = useMuiField(form, 'country');
      return <FormControl {...field.formControlProps}><InputLabel {...field.inputLabelProps}>Country</InputLabel>
        <Select label="Country" {...field.select({})}><MenuItem value="EG">Egypt</MenuItem><MenuItem value="US">United States</MenuItem></Select>
        <FormHelperText {...field.helperTextProps} /></FormControl>;
    }
    render(<Control />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Country' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Egypt' }));
    expect(form.state.values.country).toBe('EG');
    act(() => form.setError('country', 'Choose another country'));
    expect(screen.getByRole('combobox').getAttribute('aria-describedby')).toBe(screen.getByText('Choose another country').id);
  });
  it('normalizes multiple Select payloads and numeric input with explicit empty policy', () => {
    const form = createValixa({ tags: { initial: [] as string[] }, amount: { initial: null as number | null } });
    const { result } = renderHook(() => ({ tags: useMuiField(form, 'tags'), amount: useMuiField(form, 'amount') }));
    act(() => result.current.tags.select({ multiple: true }).onChange?.({ target: { value: ['a', 'b'] } } as never, null));
    expect(form.state.values.tags).toEqual(['a', 'b']);
    act(() => result.current.tags.select({ multiple: true }).onChange?.({ target: { value: 'c,d' } } as never, null));
    expect(form.state.values.tags).toEqual(['c', 'd']);
    function NumberControl() { return <TextField label="Amount" {...useMuiField(form, 'amount').numberField({ emptyValue: null })} />; }
    render(<NumberControl />);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12.5' } }); expect(form.state.values.amount).toBe(12.5);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '' } }); expect(form.state.values.amount).toBeNull();
  });
  it('maps RadioGroup string values and per-radio disabled props', () => {
    const form = createValixa({ plan: ['basic'] });
    function Control() {
      const field = useMuiField(form, 'plan');
      return <RadioGroup {...field.radioGroup()}><FormControlLabel label="Basic" value="basic" control={<Radio {...field.radio()} />} />
        <FormControlLabel label="Pro" value="pro" control={<Radio {...field.radio()} />} /></RadioGroup>;
    }
    render(<Control />); fireEvent.click(screen.getByLabelText('Pro')); expect(form.state.values.plan).toBe('pro');
    act(() => form.setReadonly(true)); fireEvent.click(screen.getByLabelText('Basic')); expect(form.state.values.plan).toBe('pro');
    act(() => form.setDisabled(true)); expect((screen.getByLabelText('Basic') as HTMLInputElement).disabled).toBe(true);
  });
  it('uses Autocomplete second argument and preserves input ref, adornments and ARIA', async () => {
    const form = createValixa({ city: { initial: null as string | null } });
    function Control() {
      const field = useMuiField(form, 'city');
      return <Autocomplete options={['Cairo', 'Giza']} {...field.autocomplete({ multiple: false, label: 'City' })} />;
    }
    render(<Control />);
    await userEvent.click(screen.getByRole('combobox', { name: 'City' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Cairo' }));
    expect(form.state.values.city).toBe('Cairo');
    // jsdom does not evaluate MUI's focus/hover visibility selector; browser tests cover the real control.
    fireEvent.click(screen.getByTitle('Clear')); expect(form.state.values.city).toBeNull();
    act(() => form.setError('city', 'Select a city'));
    expect(screen.getByRole('combobox').getAttribute('aria-describedby')).toBe(screen.getByText('Select a city').id);
  });
  it('supports object/multiple Autocomplete using explicit equality after core copies values', async () => {
    const options = [{ id: 1, label: 'Cairo' }, { id: 2, label: 'Giza' }];
    const form = createValixa({ cities: { initial: [] as { id: number; label: string }[] } });
    function Control() { return <Autocomplete options={options} getOptionLabel={option => option.label}
      {...useMuiField(form, 'cities').autocomplete({ multiple: true, label: 'Cities', isOptionEqualToValue: (a, b) => a.id === b.id })} />; }
    render(<Control />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Cities' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Cairo' }));
    expect(form.state.values.cities).toEqual([options[0]]); expect(screen.getByText('Cairo')).toBeTruthy();
    act(() => form.reset()); expect(screen.queryByText('Cairo')).toBeNull();
  });
  it('maps optional DatePicker through a codec and preserves plain core data', async () => {
    const form = createValixa({ date: { initial: null as string | null, rules: 'required', validate: (value: string | null) => value !== 'invalid' || 'Invalid date' } });
    const codec: DateCodec<string | null> = { decode: value => value ? dayjs(value) : null,
      encode: (value, context) => context.validationError ? 'invalid' : value?.format('YYYY-MM-DD') ?? null };
    const hook = renderHook(() => useMuiDateField(form, 'date', codec));
    act(() => hook.result.current.onChange?.(dayjs('2026-11-08'), { validationError: null } as never));
    expect(form.state.values.date).toBe('2026-11-08');
    act(() => hook.result.current.onChange?.(dayjs('invalid'), { validationError: 'invalidDate' } as never));
    expect(form.state.values.date).toBe('invalid');
    await act(async () => { expect((await form.validate()).valid).toBe(false); });
    act(() => form.setValue('date', '2026-11-08'));
    function Control() { return <LocalizationProvider dateAdapter={AdapterDayjs}><DatePicker label="Date" {...useMuiDateField(form, 'date', codec)} /></LocalizationProvider>; }
    render(<Control />); expect(screen.getByRole('group', { name: 'Date' })).toBeTruthy();
    fireEvent.blur(screen.getAllByRole('spinbutton')[0]!); expect(form.state.touched.date).toBe(true);
    act(() => form.setError('date', 'Date rejected')); await screen.findByText('Date rejected');
    expect(screen.getByRole('group', { name: 'Date' }).getAttribute('aria-describedby')).toBe(screen.getByText('Date rejected').id);
    expect(screen.getByRole('group', { name: 'Date' }).getAttribute('aria-invalid')).toBe('true');
    hook.unmount();
  });
});
