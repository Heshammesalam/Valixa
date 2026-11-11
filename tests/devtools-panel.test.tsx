// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { act, render, cleanup, fireEvent } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { createSSRApp, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { renderToString as renderVue } from '@vue/server-renderer';
import { createValixa } from 'valixa';
import { attachValixaDevtools } from 'valixa-devtools';
import { mountValixaDevtools } from 'valixa-devtools/panel';
import { ValixaDevtools } from 'valixa-react/devtools';
import { ValixaDevtools as VueTools } from 'valixa-vue/devtools';

it('shared panel switches forms, filters, inspects graphs and controls bounded history without exposing secrets', async () => {
  const first = createValixa({ password: ['secret'], confirm: ['', 'same:password'] }), second = createValixa({ name: ['Ada'] });
  const a = attachValixaDevtools(first, { name: 'First' }), b = attachValixaDevtools(second, { name: 'Second' });
  const host = document.createElement('div'), panel = mountValixaDevtools(host, [a, b]);
  first.setValue('password', 'private-password'); await Promise.resolve();
  expect(host.textContent).not.toContain('private-password'); expect(host.querySelector('svg line')).not.toBeNull();
  const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  button('Pause recording').click(); const count = a.getSnapshot().events.length; first.setValue('password', 'next'); await Promise.resolve(); expect(a.getSnapshot().events).toHaveLength(count);
  button('Resume recording').click(); first.setValue('password', 'third'); await Promise.resolve(); expect(a.getSnapshot().events.length).toBeGreaterThan(count);
  const search = host.querySelector<HTMLInputElement>('input')!; search.value = 'not-an-event'; search.dispatchEvent(new Event('input')); expect(host.querySelectorAll('ol li')).toHaveLength(0);
  search.value = ''; search.dispatchEvent(new Event('input')); button('Clear timeline').click(); expect(host.querySelectorAll('ol li')).toHaveLength(0);
  const select = host.querySelector<HTMLSelectElement>('select[aria-label="Inspect form"]')!; select.value = '1'; select.dispatchEvent(new Event('change'));
  const fields = host.querySelector<HTMLSelectElement>('select[aria-label="Inspect field"]')!; fields.value = JSON.stringify(['$', 'name']); fields.dispatchEvent(new Event('change')); expect(host.querySelector('pre[aria-label="Selected field state"]')?.textContent).toContain('[redacted]');
  button('Detach selected form').click(); expect(b.getSnapshot().status).toBe('detached');
  panel.destroy(); expect(host.childElementCount).toBe(0); expect(a.getSnapshot().status).toBe('attached'); a.detach(); first.dispose(); second.dispose();
});

it('thin React and Vue bindings are SSR safe and release panel subscriptions without owning the form', async () => {
  const form = createValixa({ name: ['Ada'] }), inspection = attachValixaDevtools(form);
  const original = inspection.subscribe, subscribe = vi.spyOn(inspection, 'subscribe'), release = vi.fn();
  subscribe.mockImplementation(listener => { const off = original!(listener); return () => { release(); off(); }; });
  expect(renderToString(<ValixaDevtools inspections={[inspection]} />)).toContain('div');
  expect(await renderVue(createSSRApp({ render: () => h(VueTools, { inspections: [inspection] }) }))).toContain('div'); expect(subscribe).not.toHaveBeenCalled();
  const react = render(<ValixaDevtools inspections={[inspection]} />); await act(async () => form.setValue('name', 'Grace'));
  const search = react.container.querySelector<HTMLInputElement>('input')!; fireEvent.input(search, { target: { value: 'field.changed' } });
  react.rerender(<ValixaDevtools inspections={[inspection]} />); expect(react.container.querySelector('input')).toBe(search); expect(search.value).toBe('field.changed');
  react.unmount(); expect(release).toHaveBeenCalledTimes(2);
  const vue = mount(VueTools, { props: { inspections: [inspection] } }); await nextTick(); vue.unmount(); expect(release).toHaveBeenCalledTimes(3);
  expect(inspection.getSnapshot().status).toBe('attached'); inspection.detach(); form.dispose(); cleanup();
});
