// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { blueprint, collection, createValixa, nested } from 'valixa';
import { defineAutoCodec, defineAutoForm } from 'valixa-auto';
import { ValixaAutoForm, defineReactAutoRenderer } from 'valixa-react/auto';
import { createMuiAutoAdapter, muiAdapter } from 'valixa-mui/auto';

afterEach(cleanup);
it('React/MUI Auto Form validates typed fields, awaits submission, presents errors and resets', async () => {
  const schema = blueprint({ name: ['', 'required'], email: ['', 'required | email'], age: [18, 'minValue:18'], agree: [false, 'required'] });
  const form = createValixa(schema); const ui = defineAutoForm(schema, { fields: { name: { component: 'text', label: 'Full name', description: 'Public display name' }, email: { component: 'email', label: 'Email address' }, age: { component: 'number', label: 'Age', emptyValue: 0 }, agree: { component: 'checkbox', label: 'I agree' } }, submitLabel: 'Save user' });
  let finish!: () => void; const save = vi.fn(async (values: typeof schema.__values) => { await new Promise<void>(resolve => { finish = resolve; }); return values.name; });
  render(<ValixaAutoForm form={form} ui={ui} adapter={muiAdapter} onSubmit={save} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save user' })); await screen.findByRole('alert', { name: 'Form errors' }); expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Full name' }), { target: { value: 'Ada' } }); fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'ada@example.com' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Age' }), { target: { value: '20' } }); fireEvent.click(screen.getByRole('checkbox', { name: 'I agree' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save user' })); await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(form.state.submitting).toBe(true); expect(save.mock.calls[0]?.[0]).toEqual({ name: 'Ada', email: 'ada@example.com', age: 20, agree: true });
  await act(async () => finish()); expect(form.state.submitted).toBe(true); fireEvent.click(screen.getByRole('button', { name: 'Reset' })); expect(form.state.values.name).toBe('');
});
it('React Auto Form keeps unrelated custom fields isolated and supports conditional state/slots', () => {
  const counts: Record<string, number> = {};
  const Custom = defineReactAutoRenderer<string>(({ field, config }) => { counts[field.name] = (counts[field.name] ?? 0) + 1; return <input aria-label={config.label} value={field.state.value} onChange={event => field.setValue(event.target.value)} />; });
  const schema = blueprint({ first: [''], second: [''], country: [''] });
  const form = createValixa(schema, { behaviors: { second: { dependsOn: ['country'], visibleWhen: ({ values }) => Boolean(values.country), requiredWhen: ({ values }) => Boolean(values.country) } } });
  const ui = defineAutoForm(schema, { fields: { first: { component: 'custom', renderer: 'text', label: 'First' }, second: { component: 'custom', renderer: 'text', label: 'Second' } }, summary: false });
  render(<ValixaAutoForm form={form} ui={ui} adapter={createMuiAutoAdapter({ custom: { text: Custom } })} onSubmit={() => {}} renderField={context => <section>{context.renderDefault()}</section>} />);
  expect(screen.queryByLabelText('Second')).toBeNull(); act(() => form.setValue('country', 'EG')); const count = counts.second;
  fireEvent.change(screen.getByLabelText('First'), { target: { value: 'one' } }); expect(counts.second).toBe(count); expect(form.getFieldState('second').required).toBe(true);
});
it('React Auto Form renders nested groups and keyed rows and rejects unsupported widgets', async () => {
  const row = blueprint({ city: ['', 'required'] }); const schema = blueprint({ user: nested({ name: [''] }), rows: collection({ city: ['', 'required'] }) }); const form = createValixa(schema);
  const ui = defineAutoForm(schema, { fields: { 'user.name': { component: 'text', label: 'Name' } }, collections: { rows: { label: 'Addresses', ui: defineAutoForm(row, { fields: { city: { component: 'text', label: 'City' } } }), createItem: () => ({ city: '' }) } }, layout: [{ group: 'person', label: 'Person', children: ['user.name'] }, { collection: 'rows' }] });
  render(<ValixaAutoForm form={form} ui={ui} adapter={muiAdapter} onSubmit={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add row' })); fireEvent.change(screen.getByRole('textbox', { name: 'City' }), { target: { value: 'Cairo' } });
  const first = document.querySelector('[data-valixa-row]'); fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move row 2 up' })); expect(document.querySelectorAll('[data-valixa-row]')[1]).toBe(first);
  const rows = screen.getByRole('group', { name: 'Addresses' }); fireEvent.click(within(rows).getAllByRole('button', { name: 'Remove row' })[0]!); expect(form.state.values.rows).toEqual([{ city: 'Cairo' }]);
});
it('React Auto Form supports explicit date codecs and import-time/server rendering', () => {
  const schema = blueprint({ day: { initial: null as string | null } }); const form = createValixa(schema);
  const ui = defineAutoForm(schema, { fields: { day: { component: 'date', label: 'Start date', codec: defineAutoCodec<string | null, string>({ view: 'string', decode: value => value ?? '', encode: value => value || null }) } } });
  const html = renderToString(<ValixaAutoForm form={form} ui={ui} adapter={muiAdapter} onSubmit={() => {}} />); expect(html).toContain('Start date'); expect(html).toContain('type="date"');
});
