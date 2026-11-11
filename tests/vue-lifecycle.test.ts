// @vitest-environment jsdom
import { defineComponent, effectScope, h, nextTick, watchEffect } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createValixa } from '@valixa/core';
import { useValixa, useValixaField, useValixaState } from '@valixa/vue';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
describe('Vue ownership and async lifecycle', () => {
  it('preserves owner identity on prop changes and reinitializes through a key', async () => {
    let current!: ReturnType<typeof createValixa<{ name: readonly [string] }>>;
    const Editor = defineComponent({ props: { initial: { type: String, required: true } }, setup(props) {
      current = useValixa({ name: [props.initial] }); const field = useValixaField(current, 'name');
      return () => h('span', field.state.value.value);
    } });
    const wrapper = mount(Editor, { props: { initial: 'Ada' } }); const first = current;
    first.setValue('name', 'edited'); await wrapper.setProps({ initial: 'Grace' }); expect(current).toBe(first); expect(wrapper.text()).toBe('edited');
    wrapper.unmount(); expect(() => first.reset()).toThrow('disposed');
    const second = mount(Editor, { props: { initial: 'Grace' } }); expect(current).not.toBe(first); expect(second.text()).toBe('Grace'); second.unmount();
  });
  it('unsubscribes shared projections exactly once and stops reactive notifications', async () => {
    const form = createValixa({ name: [''] }); const off = vi.fn(); const original = form.subscribeField.bind(form);
    vi.spyOn(form, 'subscribeField').mockImplementation((name, listener) => { const unsubscribe = original(name, listener); return () => { off(); unsubscribe(); }; });
    const scope = effectScope(); const update = vi.fn();
    scope.run(() => { const field = useValixaField(form, 'name'); useValixaField(form, 'name'); watchEffect(() => update(field.state.value.value)); });
    form.setValue('name', 'one'); await nextTick(); expect(update).toHaveBeenCalledTimes(2);
    scope.stop(); scope.stop(); expect(off).toHaveBeenCalledOnce(); form.setValue('name', 'two'); await nextTick(); expect(update).toHaveBeenCalledTimes(2);
  });
  it('keeps stale async results out of reactive errors and aborts work at scope disposal', async () => {
    const pending = deferred<boolean>(); const scope = effectScope(); let signal!: AbortSignal;
    const form = scope.run(() => useValixa({ name: { initial: 'old', validate: (value: string, context) => {
      if (value === 'old') { signal = context.signal; return pending.promise; } return true;
    } } }))!;
    const state = scope.run(() => useValixaState(form))!; const first = form.validate(); expect(state.value.validating).toBe(true);
    form.setValue('name', 'new'); expect(signal.aborted).toBe(true); await form.validate(); pending.resolve(false);
    expect((await first).stale).toBe(true); expect(state.value.errors).toEqual({});
    let submitSignal!: AbortSignal; const saved = deferred<void>(); const submission = form.submit((_, context) => { submitSignal = context.signal; return saved.promise; });
    await flushPromises(); expect(state.value.submitting).toBe(true); scope.stop(); expect(submitSignal.aborted).toBe(true);
    saved.resolve(); expect((await submission).status).toBe('cancelled');
  });
  it('exposes pending state, prevents duplicate submissions, propagates failures and resets server errors', async () => {
    const scope = effectScope(); const form = scope.run(() => useValixa({ name: ['Ada', 'required'] }))!;
    const state = scope.run(() => useValixaState(form))!; const saved = deferred<string>();
    const submission = form.submit(() => saved.promise); await flushPromises(); expect(state.value.submitting).toBe(true);
    expect((await form.submit(() => 'duplicate')).status).toBe('busy'); saved.resolve('ok'); expect((await submission).status).toBe('success');
    await expect(form.submit(() => { form.setError('name', 'Server rejected'); throw new Error('422'); })).rejects.toThrow('422');
    expect(state.value.submitting).toBe(false); expect(state.value.errors.name).toEqual(['Server rejected']);
    form.reset(); expect(state.value.errors).toEqual({}); expect(state.value.submitCount).toBe(0); scope.stop();
  });
});
