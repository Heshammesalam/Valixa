// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { createValixa, nested } from '@valixa/core';
import { useValixaState } from '@valixa/react';
import { afterEach, expect, it } from 'vitest';
import { ReactiveForm } from '../examples/react/src/ReactiveForm.js';

afterEach(cleanup);
it('React external-store snapshots reuse value branches through validation and unrelated writes', async () => {
  const form = createValixa({ user: nested({ name: ['', 'required'] }), other: [''] });
  const hook = renderHook(() => useValixaState(form)); const values = hook.result.current.values;
  await act(async () => { await form.validate(); }); expect(hook.result.current.values).toBe(values);
  act(() => form.setValue('other', 'changed')); expect(hook.result.current.values.user).toBe(values.user);
  hook.unmount(); form.dispose();
});
it('React/MUI renders conditional nested fields and keyed collection subscriptions through real controls', async () => {
  render(<ReactiveForm />);
  expect(screen.queryByRole('textbox', { name: 'City' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Country code'), { target: { value: 'EG' } });
  const city = screen.getByRole('textbox', { name: 'City' });
  await waitFor(() => expect(city.getAttribute('aria-invalid')).toBe('true'));
  fireEvent.click(screen.getByRole('button', { name: 'Switch language' }));
  expect(screen.getByText('المدينة مطلوب.')).toBeTruthy();
  fireEvent.change(city, { target: { value: 'Cairo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add address' }));
  const first = screen.getAllByTestId('address-row')[0]!;
  fireEvent.change(screen.getByLabelText('Address city'), { target: { value: 'Alex' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add address' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move first down' }));
  expect(screen.getAllByTestId('address-row')[1]).toBe(first);
  expect((screen.getAllByLabelText('Address city')[1] as HTMLInputElement).value).toBe('Alex');
  fireEvent.click(screen.getByRole('button', { name: 'Remove first' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save reactive' })); });
  expect(screen.getByLabelText('Reactive result').textContent).toContain('"city":"Alex"');
});
