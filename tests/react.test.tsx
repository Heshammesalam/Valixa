// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import TextField from '@mui/material/TextField';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createValixa } from '@valixa/core';
import { useValixa, useValixaField, useValixaState } from '@valixa/react';
import { useMuiField } from '@valixa/mui';

afterEach(cleanup);
describe('React → core → MUI vertical slice', () => {
  it('keeps initialization stable and survives Strict Mode effect replay', async () => {
    const { result, rerender, unmount } = renderHook(({ initial }) => useValixa({ email: [initial, 'required | email'] }), {
      initialProps: { initial: '' }, wrapper: StrictMode
    });
    const form = result.current;
    act(() => form.setValue('email', 'user@example.com'));
    rerender({ initial: 'replacement@example.com' });
    expect(result.current).toBe(form); expect(form.state.values.email).toBe('user@example.com');
    await act(async () => {}); form.setValue('email', 'still-active@example.com');
    unmount(); await Promise.resolve();
    expect(() => form.setValue('email', 'after-unmount')).toThrow('disposed');
  });
  it('isolates field renders and keeps handlers stable', () => {
    const form = createValixa({ email: ['', 'email'], password: ['', 'min:8'] });
    const renders = { email: 0, password: 0 };
    function Field({ name }: { name: 'email' | 'password' }) {
      renders[name]++; const field = useValixaField(form, name);
      return <input aria-label={name} value={field.state.value} onChange={e => field.setValue(e.target.value)} />;
    }
    const { unmount } = render(<><Field name="email" /><Field name="password" /></>);
    const before = renders.password;
    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'a' } });
    expect(renders.password).toBe(before); expect(renders.email).toBeGreaterThan(1);
    const hook = renderHook(() => useValixaField(form, 'email'));
    const handler = hook.result.current.setValue;
    act(() => form.setValue('email', 'b')); expect(hook.result.current.setValue).toBe(handler);
    hook.unmount(); unmount(); form.dispose();
  });
  it('reinitializes only through an explicit keyed remount', async () => {
    let current!: ReturnType<typeof createValixa<{ email: readonly [string] }>>;
    function Editor({ initial }: { initial: string }) {
      current = useValixa({ email: [initial] }); return null;
    }
    const view = render(<StrictMode><Editor key="record-1" initial="first" /></StrictMode>);
    const first = current; act(() => first.setValue('email', 'edited'));
    view.rerender(<StrictMode><Editor key="record-1" initial="ignored" /></StrictMode>);
    expect(current).toBe(first); expect(current.state.values.email).toBe('edited');
    view.rerender(<StrictMode><Editor key="record-2" initial="second" /></StrictMode>);
    expect(current).not.toBe(first); expect(current.state.values.email).toBe('second');
    await act(async () => {}); expect(() => first.setValue('email', 'old')).toThrow('disposed');
  });
  it('guards previously captured user handlers using current readonly/disabled state', () => {
    const form = createValixa({ email: [''] });
    const hook = renderHook(() => useValixaField(form, 'email')); const write = hook.result.current.setValue;
    act(() => { form.setReadonly(true); write('blocked'); }); expect(form.state.values.email).toBe('');
    act(() => { form.setReadonly(false); form.setDisabled(true); write('blocked'); }); expect(form.state.values.email).toBe('');
    act(() => form.setValue('email', 'programmatic')); expect(form.state.values.email).toBe('programmatic');
  });
  it('renders errors, touches on blur and submits validated values', async () => {
    const save = vi.fn(async (data: { email: string }) => data.email);
    function Login() {
      const form = useValixa({ email: ['', 'required | email'] }, { validateOn: 'blur' });
      const email = useMuiField(form, 'email'); const state = useValixaState(form);
      return <form onSubmit={event => { void form.handleSubmit(save)(event); }}>
        <TextField label="Email" {...email.textField()} />
        <button disabled={state.submitting}>Save</button>
        <output>{String(email.state.touched)}</output>
      </form>;
    }
    render(<StrictMode><Login /></StrictMode>);
    fireEvent.blur(screen.getByLabelText('Email'));
    await screen.findByText('email is required.'); expect(screen.getByText('true')).toBeTruthy();
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0]?.[0]).toEqual({ email: 'user@example.com' });
  });
});
