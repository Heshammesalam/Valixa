import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { blueprint, collection, createValixa, nested } from '@valixa/core';
import type { FormDescription } from '@valixa/core';
import { choiceValue, createRenderingPlan, defineAutoCodec, defineAutoForm, selectedOptions } from '@valixa/auto';

const capabilities = { name: 'test', widgets: ['text', 'number', 'select', 'date', 'custom'] as const, dateView: 'string', custom: ['counter'] };
describe('headless Auto Form contracts', () => {
  it('normalizes explicit groups and fields without reading field snapshots or guessing labels/widgets', () => {
    const schema = blueprint({ user: nested({ name: ['', 'required'] }), age: [18] }); const form = createValixa(schema);
    const read = vi.spyOn(form, 'getFieldState');
    const ui = defineAutoForm(schema, { fields: { 'user.name': { component: 'text', label: 'Full name' }, age: { component: 'number', label: 'Age', emptyValue: 0 } }, layout: [{ group: 'person', label: 'Person', children: ['user.name', 'age'] }] });
    const plan = createRenderingPlan(form, ui, capabilities); expect(plan[0]).toMatchObject({ kind: 'group', label: 'Person', columns: 1 });
    expect(read).not.toHaveBeenCalled(); expect(Object.isFrozen(plan)).toBe(true); expect(form.describe()).toBe(form.describe());
    expect(JSON.stringify(form.describe())).not.toContain('initial');
  });
  it('rejects missing labels, unsupported capabilities, duplicate layouts and schema mismatch', () => {
    const schema = blueprint({ name: [''] });
    expect(() => defineAutoForm(schema, { fields: { name: { component: 'text' } } } as never)).toThrow('explicit label');
    expect(() => defineAutoForm(schema, { fields: { bad: { component: 'text', label: 'Bad' } } } as never)).toThrow('unknown field');
    const ui = defineAutoForm(schema, { fields: { name: { component: 'text', label: 'Name' } } });
    expect(() => createRenderingPlan(createValixa(schema), ui, { name: 'empty', widgets: [] })).toThrow('does not support');
    expect(() => defineAutoForm(schema, { fields: { name: { component: 'text', label: 'Name' } }, layout: ['name', 'name'] })).toThrow('Duplicate');
    expect(() => createRenderingPlan(createValixa({ other: [''] }) as never, ui, capabilities)).toThrow('do not match');
  });
  it('requires explicit numeric policies, date codecs and registered custom renderers', () => {
    const schema = blueprint({ age: [0], day: { initial: null as string | null }, name: [''] });
    expect(() => defineAutoForm(schema, { fields: { age: { component: 'number', label: 'Age' } } } as never)).toThrow('emptyValue');
    const codec = defineAutoCodec<string | null, string>({ view: 'string', encode: value => value || null, decode: value => value ?? '' });
    const ui = defineAutoForm(schema, { fields: { day: { component: 'date', label: 'Day', codec }, name: { component: 'custom', renderer: 'missing', label: 'Name' } } });
    expect(() => createRenderingPlan(createValixa(schema), ui, capabilities)).toThrow('missing custom renderer');
    const dates = defineAutoForm(schema, { fields: { day: { component: 'date', label: 'Day', codec } } });
    expect(() => createRenderingPlan(createValixa(schema), dates, { ...capabilities, dateView: 'date' })).toThrow("requires a 'date'");
  });
  it('normalizes collection row namespaces and checks compatible row UI', () => {
    const row = blueprint({ city: ['', 'required'] }); const schema = blueprint({ rows: collection({ city: ['', 'required'] }) });
    const rowUI = defineAutoForm(row, { fields: { city: { component: 'text', label: 'City' } } });
    const ui = defineAutoForm(schema, { fields: {}, collections: { rows: { label: 'Addresses', ui: rowUI, createItem: () => ({ city: '' }) } } });
    expect(createRenderingPlan(createValixa(schema), ui, capabilities)[0]).toMatchObject({ kind: 'collection', name: 'rows', label: 'Addresses' });
    expect(() => defineAutoForm(schema, { fields: {}, collections: { rows: { label: 'Rows', ui: defineAutoForm(blueprint({ other: [''] }), { fields: {} }), createItem: () => ({ city: '' }) } } } as never)).toThrow('row schema');
  });
  it('uses explicit equality/index views for cloned object choices without unsafe domain conversion', () => {
    const field = { component: 'select' as const, label: 'City', options: [{ label: 'Cairo', value: { id: 1 } }], emptyValue: null, compare: (a: { id: number }, b: { id: number } | null) => b?.id === a.id };
    expect(selectedOptions(field, { id: 1 })).toEqual([0]); expect(choiceValue(field, [0])).toEqual({ id: 1 }); expect(choiceValue(field, [])).toBeNull();
    expect(() => choiceValue(field, [2])).toThrow('Invalid choice index');
  });
  it('preserves typed names, nested paths and widget value compatibility', () => {
    const schema = blueprint({ name: [''], age: [0], user: nested({ email: [''] }) });
    const ui = defineAutoForm(schema, { fields: { name: { component: 'text', label: 'Name' }, age: { component: 'number', label: 'Age', emptyValue: 0 }, 'user.email': { component: 'email', label: 'Email' } } });
    expectTypeOf(ui.description).toEqualTypeOf<FormDescription>();
    if (false) {
      // @ts-expect-error unknown field name
      defineAutoForm(schema, { fields: { missing: { component: 'text', label: 'No' } } });
      // @ts-expect-error text cannot write into number field
      defineAutoForm(schema, { fields: { age: { component: 'text', label: 'Age' } } });
      // @ts-expect-error explicit numeric empty policy preserves field type
      defineAutoForm(schema, { fields: { age: { component: 'number', label: 'Age', emptyValue: null } } });
    }
  });
});
