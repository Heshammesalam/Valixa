import { describe, expect, it, vi } from 'vitest';
import { blueprint, collection, createValixa, nested } from '../packages/core/src/index.js';

describe('structural sharing contracts', () => {
  it('retains reserved-looking atomic data keys without changing object prototypes', () => {
    const form = createValixa({ user: nested({ payload: { initial: {} as Record<string, unknown> } }) });
    const input = JSON.parse('{"__proto__":{"polluted":true},"constructor":"plain data"}');
    form.setValue('user.payload', input); const payload = form.state.values.user.payload;
    expect(Object.getPrototypeOf(payload)).toBe(Object.prototype); expect(Object.hasOwn(payload, '__proto__')).toBe(true);
    expect(payload.constructor).toBe('plain data'); expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    input.__proto__.polluted = false; expect((payload.__proto__ as { polluted: boolean }).polluted).toBe(true);
  });
  it('preserves Object.is semantics for NaN and signed zero in lazy field projections', () => {
    const form = createValixa({ value: { initial: NaN as number } }); const nan = form.getFieldState('value');
    expect(form.getFieldState('value')).toBe(nan); form.setValue('value', -0); expect(Object.is(form.getFieldState('value').value, -0)).toBe(true);
    const negative = form.getFieldState('value'); form.setValue('value', 0);
    expect(form.getFieldState('value')).not.toBe(negative); expect(Object.is(form.getFieldState('value').value, 0)).toBe(true);
  });
  it('shares blueprint defaults safely across independent form instances', () => {
    const definition = blueprint({ profile: { initial: { tags: ['one'] as string[] } } });
    const first = createValixa(definition), second = createValixa(definition);
    expect(first.state.initialValues.profile).toBe(second.state.initialValues.profile);
    first.setValue('profile', { tags: ['two'] }); expect(second.state.values.profile.tags).toEqual(['one']);
    first.reset(); expect(first.state.values.profile).toBe(first.state.initialValues.profile);
  });
  it('shares collection row values during validation and moves while retaining row state', async () => {
    const form = createValixa({ rows: collection({ value: ['', 'required'] }, [{ value: 'one' }, { value: 'two' }]) });
    const rows = form.array('rows'), initial = form.state, items = rows.items;
    await rows.items[0]!.form.validate();
    expect(form.state.values).toBe(initial.values); expect(rows.items).toBe(items); expect(rows.values).toBe(initial.values.rows);
    rows.items[0]!.form.setTouched('value'); const first = rows.items[0]!; rows.move(0, 1);
    expect(form.state.values.rows[1]).toBe(initial.values.rows[0]); expect(form.state.values.rows[0]).toBe(initial.values.rows[1]);
    expect(first.form.getFieldState('value').touched).toBe(true); expect(initial.values.rows.map(row => row.value)).toEqual(['one', 'two']);
    form.dispose(); expect(rows.pending).toBe(false);
  });
  it('inherits parent flags for appended rows without losing row-local ownership', () => {
    const form = createValixa({ rows: collection({ value: [''] }) }); const rows = form.array('rows');
    form.setDisabled(true); form.setReadonly(true); rows.append({ value: 'one' });
    expect(rows.items[0]!.form.getFieldState('value')).toMatchObject({ disabled: true, readonly: true });
    form.setDisabled(false); form.setReadonly(false); expect(rows.items[0]!.form.getFieldState('value')).toMatchObject({ disabled: false, readonly: false });
    rows.items[0]!.form.setDisabled(true); expect(rows.items[0]!.form.state.disabled).toBe(false);
    form.dispose();
  });
  it('shares untouched atomic data and nested branches while preserving old snapshots', () => {
    const form = createValixa({ user: nested({ first: ['Ada'], address: nested({ city: ['Cairo'] }) }), other: nested({ name: ['Grace'] }), profile: { initial: { tags: ['one'] as string[] } } });
    const before = form.state; const address = form.getFieldState('user.address.city');
    form.setValue('user.first', 'Ahmed'); const after = form.state;
    expect(after.values).not.toBe(before.values); expect(after.values.user).not.toBe(before.values.user);
    expect(after.values.user.address).toBe(before.values.user.address); expect(after.values.other).toBe(before.values.other);
    expect(after.values.profile).toBe(before.values.profile); expect(form.getFieldState('user.address.city')).toBe(address);
    expect(before.values.user.first).toBe('Ada'); expect(() => (after.values.profile.tags as string[]).push('bad')).toThrow();
  });
  it('copies untrusted shallow-frozen writes before sharing internal immutable branches', () => {
    const form = createValixa({ profile: { initial: { tags: [] as string[] } }, name: [''] });
    const external = Object.freeze({ tags: ['one'] }); form.setValue('profile', external); const before = form.state;
    external.tags.push('outside'); expect(form.state.values.profile.tags).toEqual(['one']); expect(Object.isFrozen(external.tags)).toBe(false);
    form.setValue('name', 'Ada'); expect(form.state.values.profile).toBe(before.values.profile);
    const sparse: string[] = new Array(3); sparse[2] = 'end'; form.setValue('profile', { tags: sparse });
    expect(form.state.values.profile.tags.length).toBe(3); expect(0 in form.state.values.profile.tags).toBe(false);
  });
  it('reuses values, touched, dirty and unrelated errors during validation and locale transitions', async () => {
    const form = createValixa({ user: nested({ name: ['', 'required'] }), other: ['', 'required'] });
    const initial = form.state; const run = form.validate();
    expect(form.state.values).toBe(initial.values); expect(form.state.touched).toBe(initial.touched); expect(form.state.nestedDirty).toBe(initial.nestedDirty);
    await run; const invalid = form.state; await form.validate();
    expect(form.state.errors).toBe(invalid.errors); expect(form.state.errorDetails).toBe(invalid.errorDetails);
    form.setValue('user.name', 'Ada'); expect(form.state.errors.other).toBe(invalid.errors.other);
    const oldValues = form.state.values; form.setLocale('ar'); expect(form.state.values).toBe(oldValues);
  });
  it('keeps lazy reads and subscriptions stable with deterministic notification counts', () => {
    const form = createValixa({ a: [''], b: [''] }), all = vi.fn(), a = vi.fn(), b = vi.fn();
    form.subscribe(all); form.subscribeField('a', a); form.subscribeField('b', b);
    const untouched = form.getFieldState('b'); form.setValue('a', 'one');
    expect(all).toHaveBeenCalledTimes(1); expect(a).toHaveBeenCalledTimes(1); expect(b).not.toHaveBeenCalled();
    expect(form.getFieldState('b')).toBe(untouched); const snapshot = form.state;
    form.setValue('a', 'one'); form.setTouched('b', false); form.clearErrors(); form.cancelValidation();
    expect(form.state).toBe(snapshot); expect(all).toHaveBeenCalledTimes(1);
  });
  it('preserves independent request pending transitions and immutable captured values', async () => {
    let resolve!: (value: boolean) => void; let captured: unknown;
    const form = createValixa({ a: { initial: '', dependsOn: [], validate: (_, ctx) => { captured = ctx.values; return new Promise<boolean>(done => { resolve = done; }); } }, b: [''] });
    const run = form.validate('a'); const field = form.getFieldState('a'), before = form.state;
    form.setValue('b', 'new'); expect(form.getFieldState('a')).toBe(field); expect((captured as { b: string }).b).toBe('');
    expect(before.values.b).toBe(''); resolve(true); await run; expect(form.getFieldState('a').pending).toBe(false);
  });
  it('keeps conditional validation invalidation correct without eager field reads', async () => {
    const form = createValixa({ active: [false], name: [''] }, { behaviors: { name: { dependsOn: ['active'], requiredWhen: ({ values }) => Boolean(values.active) } }, validation: { mode: 'onChange' } });
    form.setValue('active', true); await form.validate(); expect(form.state.errors.name).toEqual(['name is required.']);
  });
  it('retains final snapshots and releases observers on disposal', () => {
    const form = createValixa({ value: { initial: { nested: ['one'] as string[] } } }); const field = form.field('value'), before = form.state;
    const listener = vi.fn(); field.subscribe(listener); form.dispose();
    expect(form.state.values).toBe(before.values); expect(form.state.pending).toBe(false); expect(listener).not.toHaveBeenCalled();
    expect(() => field.setValue({ nested: ['other'] })).toThrow('disposed');
  });
});
