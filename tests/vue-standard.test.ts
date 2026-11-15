// @vitest-environment jsdom
import { createSSRApp, defineComponent, h, nextTick } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { expect, it, vi } from 'vitest';
import * as z from 'zod';
import { blueprint } from 'valixa';
import { standardFormValidator } from 'valixa/standard';
import { useValixa, useValixaAdapter, useValixaState, nativeText } from 'valixa-vue';

it('standard-schema Vue forms render per request and hydrate with stable native bindings', async () => {
  const forms: { dispose(): void }[] = [];
  const make = (email: string) => defineComponent({ setup() {
    const definition = blueprint({ email: [email] });
    const form = useValixa(definition, { validateForm: standardFormValidator(z.object({ email: z.email('Invalid email') }), definition), validation: { mode: 'onChange' } });
    forms.push(form); const state = useValixaState(form), input = useValixaAdapter(form, 'email', nativeText);
    return () => h('form', [h('label', { for: input.value.id }, 'Email'), h('input', { ...input.value }), h('output', state.value.errors.email?.[0] ?? '')]);
  } });
  const first = await renderToString(createSSRApp(make('first@example.com')));
  const second = await renderToString(createSSRApp(make('second@example.com')));
  expect(first).toContain('first@example.com'); expect(second).not.toContain('first@example.com');
  const host = document.createElement('div'); host.innerHTML = first; document.body.append(host);
  const warn = vi.spyOn(console, 'warn'); const error = vi.spyOn(console, 'error');
  const app = createSSRApp(make('first@example.com'));
  try {
    app.mount(host); const input = host.querySelector('input')!;
    expect(host.querySelector('label')!.htmlFor).toBe(input.id);
    input.value = 'bad'; input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(host.querySelector('output')!.textContent).toBe('Invalid email'));
    await nextTick(); expect(warn).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
  } finally { app.unmount(); host.remove(); forms.forEach(form => form.dispose()); warn.mockRestore(); error.mockRestore(); }
});
