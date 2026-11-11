// @vitest-environment jsdom
import { defineComponent, effectScope, h, isProxy, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createValixa } from '@valixa/core';
import { createValixaKey, injectValixa, nativeText, provideValixa, useValixa, useValixaAdapter, useValixaField, useValixaState } from '@valixa/vue';

describe('Vue core integration', () => {
  it('requires a scope before owning resources', () => {
    expect(() => useValixa({ name: [''] })).toThrow('active Vue effect scope');
    expect(() => useValixaState(createValixa({ name: [''] }))).toThrow('active Vue effect scope');
  });
  it('owns raw state, shares subscriptions in a scope, and disposes without proxying snapshots', () => {
    const scope = effectScope();
    const form = scope.run(() => useValixa({ name: ['', 'required'] }))!;
    const subscribe = vi.spyOn(form, 'subscribeField');
    scope.run(() => {
      const first = useValixaField(form, 'name'), second = useValixaField(form, 'name');
      expect(first.state).toBe(second.state); expect(subscribe).toHaveBeenCalledOnce();
      form.setValue('name', 'Ada'); expect(first.state.value.value).toBe('Ada');
      expect(isProxy(form)).toBe(false); expect(isProxy(first.state.value)).toBe(false);
      expect(first.state.value.dirty).toBe(true);
      const all = useValixaState(form); expect(all).toBe(useValixaState(form));
    });
    scope.stop(); expect(() => form.setValue('name', 'after')).toThrow('disposed');
  });
  it('renders native bindings, errors, touched, submission and reset', async () => {
    let form!: ReturnType<typeof createValixa<{ name: readonly [string] }>>;
    const App = defineComponent({ setup() {
      form = useValixa({ name: ['', 'required'] }, { validateOn: 'blur' });
      const input = useValixaAdapter(form, 'name', nativeText), state = useValixaState(form);
      return () => h('div', [h('input', { ...input.value, 'aria-label': 'Name' }), h('span', state.value.errors.name?.[0]), h('output', String(state.value.submitting))]);
    } });
    const wrapper = mount(App); await wrapper.get('input').trigger('blur'); await nextTick(); await nextTick();
    expect(wrapper.text()).toContain('name is required.'); expect(form.state.touched.name).toBe(true);
    await wrapper.get('input').setValue('Ada'); expect(form.state.values.name).toBe('Ada');
    await form.submit(async data => data.name); await nextTick(); expect(form.state.submitted).toBe(true);
    form.reset(); await nextTick(); expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
    wrapper.unmount(); expect(() => form.reset()).toThrow('disposed');
  });
  it('isolates component field updates and unsubscribes external forms', async () => {
    const form = createValixa({ email: [''], password: [''] }); const renders = { email: 0, password: 0 };
    function Field(name: 'email' | 'password') { return defineComponent({ setup() {
      const field = useValixaField(form, name);
      return () => { renders[name]++; return h('input', { value: field.state.value.value }); };
    } }); }
    const wrapper = mount(defineComponent({ render: () => h('div', [h(Field('email')), h(Field('password'))]) }));
    const password = renders.password; form.setValue('email', 'a'); await nextTick();
    expect(renders.password).toBe(password); expect(renders.email).toBeGreaterThan(1);
    wrapper.unmount(); expect(() => form.setValue('email', 'alive')).not.toThrow();
  });
  it('provides typed keys without owning externally created forms', async () => {
    const key = createValixaKey<{ name: string }>(); const form = createValixa({ name: ['Ada'] });
    const Child = defineComponent({ setup() { const field = useValixaField(injectValixa(key), 'name'); return () => h('span', field.state.value.value); } });
    const wrapper = mount(defineComponent({ setup() { provideValixa(key, form); return () => h(Child); } }));
    expect(wrapper.text()).toBe('Ada'); form.setValue('name', 'Grace'); await nextTick(); expect(wrapper.text()).toBe('Grace');
    wrapper.unmount(); form.setValue('name', 'still alive');
  });
});
