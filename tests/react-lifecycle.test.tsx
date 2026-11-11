// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createValixa } from 'valixa';
import type { ValixaForm } from 'valixa';
import { connectValixa, defineAdapter, nativeText, useValixa, useValixaAdapter, useValixaContext, useValixaField, useValixaState, ValixaProvider } from 'valixa-react';

afterEach(cleanup);
describe('ownership, adapters and request lifecycle', () => {
  it('unsubscribes fields, cancels owned async work and leaves external stores alive', async () => {
    let owned!: ValixaForm<{ name: string }>;
    const { unmount } = renderHook(() => {
      const form = useValixa({ name: ['', ''] }); owned = form;
      return useValixaField(form, 'name');
    }, { wrapper: StrictMode });
    const unsubscribe = vi.fn(); const original = owned.subscribeField.bind(owned);
    const spy = vi.spyOn(owned, 'subscribeField').mockImplementation((name, listener) => {
      const off = original(name, listener); return () => { unsubscribe(); off(); };
    });
    const external = renderHook(() => useValixaField(owned, 'name'));
    let signal: AbortSignal | undefined;
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    let request!: ReturnType<typeof owned.submit<void>>;
    await act(async () => { request = owned.submit((_, context) => { signal = context.signal; return pending; }); });
    external.unmount(); expect(unsubscribe).toHaveBeenCalled(); spy.mockRestore();
    unmount(); await Promise.resolve(); expect(signal?.aborted).toBe(true); finish(); expect((await request).status).toBe('cancelled');
    const form = createValixa({ name: [''] });
    const read = renderHook(() => useValixaState(form)); read.unmount();
    expect(() => form.setValue('name', 'alive')).not.toThrow();
  });
  it('context carries stable form identity and does not own external forms', () => {
    const form = createValixa({ name: [''] });
    function Child() {
      const shared = useValixaContext<{ name: string }>();
      return <input aria-label="name" {...useValixaAdapter(shared, 'name', nativeText)} />;
    }
    const { unmount } = render(<ValixaProvider form={form}><Child /></ValixaProvider>);
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Ada' } });
    expect(form.state.values.name).toBe('Ada'); unmount(); form.setValue('name', 'still alive');
  });
  it('transforms custom event payloads and types connected component props', () => {
    type Props = { label: string; value: number; onValueChange: (payload: { amount: number }) => void; invalid: boolean };
    function Custom({ label, value, onValueChange, invalid }: Props) {
      return <button aria-label={label} aria-invalid={invalid} onClick={() => onValueChange({ amount: value + 1 })}>{value}</button>;
    }
    const adapter = defineAdapter<number, Omit<Props, 'label'>>(field => ({ value: field.state.value,
      onValueChange: payload => field.setValue(payload.amount), invalid: Boolean(field.error) }));
    const Connected = connectValixa(Custom, adapter);
    const form = createValixa({ count: [0], title: [''] });
    render(<Connected form={form} name="count" label="Increment" />);
    fireEvent.click(screen.getByLabelText('Increment')); expect(form.state.values.count).toBe(1);
    expectTypeOf(form.state.values.count).toEqualTypeOf<number>();
    if (false) {
      // @ts-expect-error invalid field name
      <Connected form={form} name="missing" label="No" />;
      // @ts-expect-error incompatible value type
      <Connected form={form} name="title" label="No" />;
      // @ts-expect-error missing unbound component prop
      <Connected form={form} name="count" />;
      // @ts-expect-error bound props cannot override adapter
      <Connected form={form} name="count" label="No" value={7} />;
    }
  });
  it('preserves latest async validation, loading state, request errors and reset', async () => {
    let resolveOld!: (valid: boolean) => void;
    const old = new Promise<boolean>(resolve => { resolveOld = resolve; });
    const form = createValixa({ name: { initial: 'old', validate: (value: string) => value === 'old' ? old : true } });
    const { result } = renderHook(() => ({ field: useValixaField(form, 'name'), state: useValixaState(form) }));
    let validation!: ReturnType<typeof form.validate>;
    act(() => { validation = form.validate(); }); expect(result.current.state.validating).toBe(true);
    await act(async () => { form.setValue('name', 'new'); await form.validate(); });
    await act(async () => { resolveOld(false); await validation; }); expect(result.current.field.error).toBeUndefined();
    let resolveSave!: () => void; const save = new Promise<void>(resolve => { resolveSave = resolve; });
    let submission!: ReturnType<typeof form.submit<void>>;
    await act(async () => { submission = form.submit(() => save); });
    expect(result.current.state.submitting).toBe(true); expect((await form.submit(() => {})).status).toBe('busy');
    await act(async () => { resolveSave(); await submission; }); expect(result.current.state.submitted).toBe(true);
    await act(async () => {
      await expect(form.submit(() => { form.setError('name', 'Server rejected'); throw new Error('Network'); })).rejects.toThrow('Network');
    });
    expect(result.current.field.error).toBe('Server rejected'); expect(result.current.state.submitting).toBe(false);
    act(() => form.reset()); expect(result.current.field.state.value).toBe('old'); expect(result.current.state.submitCount).toBe(0);
  });
});
