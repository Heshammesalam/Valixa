import { afterEach, describe, expect, it, vi } from 'vitest';
import { blueprint, collection, createValixa, nested, parsePath, registerLocale } from '../packages/core/src/index.js';

afterEach(() => vi.useRealTimers());
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };

describe('dependency graph vertical slice', () => {
  it('infers same, traverses transitive dependents, retains unrelated errors and snapshots', async () => {
    const form = createValixa({ password: ['one'], confirm: ['two', 'same:password'], final: ['three', 'same:confirm'], other: ['', 'required'] });
    await form.validate(); const other = form.getFieldState('other'); const listener = vi.fn();
    form.subscribeField('other', listener);
    form.setValue('password', 'two');
    expect(form.state.errors).toEqual({ other: ['other is required.'] });
    expect(form.dependencies.dependencies.final).toEqual(['confirm']);
    expect(form.getFieldState('other')).toBe(other); expect(listener).not.toHaveBeenCalled();
  });
  it('unions explicit/inferred reads and keeps unknown custom dependencies conservative', async () => {
    const form = createValixa({ a: [0], explicit: { initial: 1, dependsOn: ['a'], validate: () => false }, independent: { initial: 1, dependsOn: [], validate: () => false }, unknown: { initial: 1, validate: () => false } });
    await form.validate(); form.setValue('a', 2);
    expect(Object.keys(form.state.errors)).toEqual(['independent']);
    expect(form.dependencies.unknown).toEqual(['unknown']);
    expect(Object.isFrozen(form.dependencies.dependencies)).toBe(true);
  });
  it('rejects unknown dependencies and reports deterministic actionable cycles', () => {
    expect(() => blueprint({ a: { initial: '', dependsOn: ['missing'] } })).toThrow('unknown field missing');
    expect(() => blueprint({ a: { initial: '', dependsOn: ['b'] }, b: { initial: '', dependsOn: ['a'] } })).toThrow('a -> b -> a');
    expect(() => blueprint({ a: { initial: '', dependsOn: ['a'] } })).toThrow('a -> a');
    expect(() => blueprint({ a: ['', 'same:b'], b: ['', 'same:a'], c: { initial: '', dependsOn: ['b'], rules: 'same:a' } })).not.toThrow();
    expect(() => blueprint({ a: ['', 'same:c'], b: ['', 'same:a'], c: { initial: '', dependsOn: ['b'] } })).toThrow('c -> b -> a -> c');
  });
  it('preserves legacy same cycles with one bounded traversal and frozen-value comparison', async () => {
    vi.useFakeTimers(); const form = createValixa({ a: ['one', 'same:b'], b: ['two', 'same:a'] }, { validation: { mode: 'onChange', debounce: 1 } });
    expect(form.dependencies.cycles).toEqual([['a', 'b', 'a']]);
    await form.validate(); expect(form.state.invalid).toBe(true);
    form.setValue('a', 'two'); await vi.runAllTimersAsync(); expect(form.state.valid).toBe(true); expect(form.state.pending).toBe(false);
    expect(vi.getTimerCount()).toBe(0); form.dispose();
  });
  it('schedules only changed and dependent validators and updates dependent subscriptions', async () => {
    vi.useFakeTimers(); const other = vi.fn(() => true);
    const form = createValixa({ a: ['one'], b: ['two', 'same:a'], c: { initial: '', validate: other, dependsOn: [] } }, { validation: { mode: 'onChange', debounce: 20 } });
    const listener = vi.fn(); form.subscribeField('b', listener);
    form.setValue('a', 'changed');
    expect(form.getFieldState('b')).toMatchObject({ pending: true, validating: false });
    await vi.advanceTimersByTimeAsync(20);
    expect(form.getFieldState('b')).toMatchObject({ errors: ['b must match a.'], pending: false });
    expect(listener).toHaveBeenCalled(); expect(other).not.toHaveBeenCalled();
  });
});

describe('field scheduler', () => {
  it('debounces per field, cancels obsolete requests, bypasses delay for fresh submit', async () => {
    vi.useFakeTimers(); const validate = vi.fn(() => true);
    const form = createValixa({ name: { initial: '', validate, dependsOn: [] } }, { validation: { mode: 'onChange', debounce: 300 } });
    form.setValue('name', 'a'); await vi.advanceTimersByTimeAsync(200); form.setValue('name', 'ab');
    await vi.advanceTimersByTimeAsync(299); expect(validate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(validate).toHaveBeenCalledTimes(1);
    form.setValue('name', 'abc'); expect((await form.submit(values => values.name))).toEqual({ status: 'success', data: 'abc' });
    await vi.runAllTimersAsync(); expect(validate).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0);
  });
  it('preserves independent running jobs and settles cancellation even if validators ignore signals', async () => {
    const a = deferred<boolean>(), b = deferred<boolean>(); let signal!: AbortSignal;
    const form = createValixa({ a: { initial: '', dependsOn: [], validate: (_, ctx) => { signal = ctx.signal; return a.promise; } }, b: { initial: '', dependsOn: [], validate: () => b.promise } });
    const first = form.validate('a'), second = form.validate('b');
    form.setValue('a', 'next'); expect(signal.aborted).toBe(true); expect((await first).stale).toBe(true);
    expect(form.getFieldState('b').validating).toBe(true);
    b.resolve(false); expect((await second).stale).toBe(false); expect(form.state.errors.b).toHaveLength(1);
    a.resolve(false); await Promise.resolve(); expect(form.state.errors.a).toBeUndefined();
  });
  it('keeps manual default and implements blur and initial immediate policies', async () => {
    vi.useFakeTimers(); const validate = vi.fn(() => false);
    const manual = createValixa({ a: { initial: '', validate } }); manual.setValue('a', 'x'); manual.setTouched('a');
    expect(validate).not.toHaveBeenCalled();
    const blur = createValixa({ a: ['', 'required'] }, { validation: { mode: 'onBlur', debounce: 5 } });
    blur.setTouched('a'); await vi.advanceTimersByTimeAsync(5); expect(blur.state.invalid).toBe(true);
    const immediate = createValixa({ a: ['', 'required'] }, { validation: { mode: 'immediate' } });
    await vi.runAllTimersAsync(); expect(immediate.state.invalid).toBe(true);
  });
  it.each(['reset', 'dispose'] as const)('%s cancels timers and running work', async action => {
    vi.useFakeTimers(); const validate = vi.fn(() => new Promise<boolean>(() => {}));
    const form = createValixa({ a: { initial: '', validate } }, { validation: { mode: 'onChange', debounce: 5 } });
    form.setValue('a', 'x'); form[action](); await vi.runAllTimersAsync(); expect(validate).not.toHaveBeenCalled();
    expect(form.state.pending).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['reset', 'dispose'] as const)('%s synchronously removes running timeout timers', async action => {
    vi.useFakeTimers();
    const form = createValixa({ a: { initial: '', validate: () => new Promise(() => {}) } }, { validateForm: () => new Promise(() => {}), validation: { timeout: 1000 } });
    const run = form.validate(); expect(vi.getTimerCount()).toBe(2); form[action](); expect(vi.getTimerCount()).toBe(0);
    expect((await run).stale).toBe(true);
  });
  it('timeouts abort the signal and produce a deterministic error without late commits', async () => {
    vi.useFakeTimers(); const remote = deferred<boolean>(); let signal!: AbortSignal;
    const form = createValixa({ a: { initial: '', validate: (_, ctx) => { signal = ctx.signal; return remote.promise; } } }, { validation: { timeout: 50 } });
    const run = form.validate(); await vi.advanceTimersByTimeAsync(50);
    expect(signal.aborted).toBe(true); expect(await run).toMatchObject({ stale: false, valid: false });
    expect(form.state.errors.a).toEqual(['a validation timed out.']); remote.resolve(true); await Promise.resolve();
    expect(form.state.errors.a).toHaveLength(1); expect(vi.getTimerCount()).toBe(0);
  });
});

describe('conditional behavior', () => {
  it('projects visibility, disabled, readonly and required without discarding submitted values', async () => {
    const evaluate = vi.fn(({ values }: { values: Readonly<Record<string, unknown>> }) => Boolean(values.country));
    const form = createValixa({ country: [''], city: ['Cairo'], unrelated: [0] }, { behaviors: { city: {
      dependsOn: ['country'], visibleWhen: evaluate, enabledWhen: evaluate, readonlyWhen: ({ values }) => values.country === 'locked', requiredWhen: evaluate
    } } });
    expect(form.getFieldState('city')).toMatchObject({ visible: false, disabled: true, required: false });
    const calls = evaluate.mock.calls.length; form.setValue('unrelated', 1); expect(evaluate).toHaveBeenCalledTimes(calls);
    expect(await form.submit(values => values.city)).toEqual({ status: 'success', data: 'Cairo' });
    form.setValue('country', 'locked'); expect(form.getFieldState('city')).toMatchObject({ visible: true, disabled: false, readonly: true, required: true });
    form.setValue('city', ''); await form.validate(); expect(form.state.errors.city).toEqual(['city is required.']);
    form.reset(); expect(form.getFieldState('city')).toMatchObject({ value: 'Cairo', visible: false, readonly: false });
  });
  it('resets only on rising transitions, gates validation and invalidates server errors when affected', async () => {
    const form = createValixa({ clear: [false], active: [true], city: ['initial', 'required'] }, { behaviors: { city: {
      dependsOn: ['clear', 'active'], resetWhen: ({ values }) => Boolean(values.clear), validateWhen: ({ values }) => Boolean(values.active)
    } } });
    form.setValue('city', 'edited'); form.setValue('clear', true); expect(form.state.values.city).toBe('initial');
    form.setValue('city', 'retained'); expect(form.state.values.city).toBe('retained');
    form.setValue('city', ''); form.setError('city', 'server'); form.setValue('active', false);
    expect(form.state.errors.city).toBeUndefined(); await form.validate(); expect(form.state.valid).toBe(true);
    form.setValue('active', true); await form.validate(); expect(form.state.errors.city).toHaveLength(1);
  });
  it('rejects bad behavior references before creating state', () => {
    expect(() => createValixa({ a: [''] }, { behaviors: { missing: {} } })).toThrow('unknown field');
    expect(() => createValixa({ a: [''] }, { behaviors: { a: { dependsOn: ['missing'] } } })).toThrow('unknown field');
  });
});

describe('explicit nested schemas', () => {
  it('updates typed nested values and projections immutably, while atomic values stay atomic', async () => {
    const form = createValixa({ user: nested({ name: ['', 'required'], age: [0] }), profile: { initial: { city: 'Cairo' as string } }, tags: [['one']] });
    const old = form.state; const age = form.getFieldState('user.age');
    form.setValue('user.name', 'Ahmed'); form.setTouched('user.name');
    expect(form.state.values.user.name).toBe('Ahmed'); expect(old.values.user.name).toBe('');
    expect(form.getFieldState('user.age')).toBe(age); expect(form.state.nestedTouched).toEqual({ user: { name: true, age: false }, profile: false, tags: false });
    form.setValues({ user: { name: '', age: 25 } }); await form.validate();
    expect(form.state.nestedErrors).toEqual({ user: { name: ['user.name is required.'] } });
    expect((await form.submit(values => values.user.age)).status).toBe('invalid');
    form.setValue('profile', { city: 'Giza' }); expect(form.state.values.profile.city).toBe('Giza');
    expect(() => form.setValue('profile.city' as never, 'x' as never)).toThrow('Unknown field');
    if (false) {
      // @ts-expect-error wrong nested value
      form.setValue('user.age', 'wrong');
      // @ts-expect-error unknown nested path
      form.getFieldState('user.missing');
    }
  });
  it('supports escaped segments and legacy literal dots, rejects ambiguity and unsafe paths', () => {
    const form = createValixa({ user: nested({ 'first.name': [''], 'a\\b': [0] }), 'literal.dot': ['old'] });
    form.setValue('user.first\\.name', 'Ada'); form.setValue('user.a\\\\b', 2); form.setValue('literal.dot', 'new');
    expect(form.state.values.user['first.name']).toBe('Ada'); expect(form.state.values['literal.dot']).toBe('new');
    expect(parsePath('a.b\\.c')).toEqual(['a', 'b.c']);
    for (const path of ['a.__proto__.x', 'a.constructor.x', 'a..b', 'a\\q', 'a\\']) expect(() => parsePath(path)).toThrow();
    expect(() => createValixa({ user: nested({ name: [''] }), 'user.name': [''] })).toThrow('Ambiguous');
    const polluted = JSON.parse('{"user":{"__proto__":{"polluted":true}}}');
    expect(() => form.setValues(polluted)).toThrow(); expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('dynamic collections', () => {
  it('avoids duplicate remote requests for automatic row writes with no debounce', async () => {
    const validate = vi.fn(async () => true);
    const form = createValixa({ rows: collection({ city: { initial: '', validate, dependsOn: [] } }, [{ city: 'Cairo' }]) }, { validation: { mode: 'onChange' } });
    form.array('rows').items[0]!.form.setValue('city', 'Giza');
    for (let turn = 0; form.state.pending && turn < 100; turn++) await Promise.resolve();
    expect(form.state.pending).toBe(false); expect(validate).toHaveBeenCalledTimes(1); form.dispose();
  });
  it('does not restart immediate-mode row validation after reset or duplicate initial requests', async () => {
    vi.useFakeTimers(); const validate = vi.fn(() => true);
    const form = createValixa({ rows: collection({ city: { initial: '', dependsOn: [], validate } }, [{ city: 'Cairo' }]) }, { validation: { mode: 'immediate', debounce: 10 } });
    await vi.runAllTimersAsync(); expect(validate).toHaveBeenCalledTimes(1);
    form.reset(); expect(form.state.pending).toBe(false); expect(vi.getTimerCount()).toBe(0);
    await vi.runAllTimersAsync(); expect(validate).toHaveBeenCalledTimes(1);
    form.array('rows').append({ city: 'Giza' }); await vi.runAllTimersAsync(); expect(validate).toHaveBeenCalledTimes(3); form.dispose();
  });
  it('gates collection validation and parent error projection without erasing row-owned errors', async () => {
    const form = createValixa({ active: [true], rows: collection({ city: ['', 'required'] }, [{ city: '' }]) }, { behaviors: { rows: { dependsOn: ['active'], validateWhen: ({ values }) => Boolean(values.active) } } });
    await form.validate(); expect(form.state.invalid).toBe(true); form.setValue('active', false); await form.validate();
    expect(form.state.valid).toBe(true); expect(form.state.nestedErrors.rows).toEqual([{}]); expect(form.array('rows').items[0]!.form.state.invalid).toBe(true);
    form.setValue('active', true); await form.validate(); expect(form.state.invalid).toBe(true); form.dispose();
  });
  it('rejects invalid collection replacements without changing values or row identities', () => {
    const form = createValixa({ rows: collection({ city: [''] }, [{ city: 'Cairo' }]) }); const before = form.state, row = form.array('rows').items[0];
    expect(() => form.setValues({ rows: [null] } as never)).toThrow('items must be objects');
    expect(form.state).toBe(before); expect(form.array('rows').items[0]).toBe(row);
    expect(() => form.setValues({ rows: [{ missing: '' }] } as never)).toThrow('Unknown field'); expect(form.state).toBe(before);
    form.dispose();
  });
  it('supports nested item schemas, parent replacement, inherited flags and errors clearing', async () => {
    const form = createValixa({ rows: collection({ user: nested({ name: ['', 'required'] }) }) });
    const rows = form.array('rows'); rows.append({ user: { name: '' } });
    const row = rows.items[0]!; row.form.setValue('user.name', 'Ada');
    expect(form.state.values.rows[0]!.user.name).toBe('Ada');
    form.setReadonly(true); expect(row.form.getFieldState('user.name').readonly).toBe(true);
    form.setValues({ rows: [{ user: { name: '' } }] }); expect(() => row.form.setValue('user.name', '')).toThrow('disposed');
    await form.validate(); expect(form.state.invalid).toBe(true); form.clearErrors(); expect(form.state.valid).toBe(true);
    form.setLocale('ar'); rows.append({ user: { name: '' } }); await rows.items[1]!.form.validate();
    expect(rows.items[1]!.form.state.locale).toBe('ar'); expect(rows.items[1]!.form.state.errors['user.name']).toEqual(['user.name مطلوب.']);
    form.dispose();
  });
  it('makes parent validation stale on removal and cancels every removed row timer', async () => {
    vi.useFakeTimers(); const remote = deferred<boolean>(); let signal!: AbortSignal;
    const form = createValixa({ rows: collection({ name: { initial: '', validate: (_, context) => { signal = context.signal; return remote.promise; } } }) }, { validation: { mode: 'onChange', debounce: 50 } });
    const rows = form.array('rows'); rows.append({ name: 'first' }); const run = form.validate();
    rows.remove(0); expect(signal.aborted).toBe(true); expect((await run).stale).toBe(true);
    form.reset(); await vi.runAllTimersAsync(); expect(vi.getTimerCount()).toBe(0); expect(form.state.pending).toBe(false);
    remote.resolve(false); form.dispose();
  });
  it('preserves row lifetime, errors and touched state through all movement operations', async () => {
    const form = createValixa({ addresses: collection({ city: ['', 'required'], street: [''] }, [{ city: 'Cairo', street: 'one' }]) });
    const items = form.array('addresses'); const first = items.items[0]!; const old = form.state;
    items.append({ city: '', street: 'two' }); const second = items.items[1]!;
    second.form.setTouched('city'); await second.form.validate();
    items.move(1, 0); expect(items.items[0]).toBe(second); expect(items.items[1]).toBe(first);
    expect(items.items[0]!.form.getFieldState('city')).toMatchObject({ touched: true, errors: ['city is required.'] });
    expect(form.state.nestedErrors).toEqual({ addresses: [{ city: ['city is required.'] }, {}] });
    items.swap(0, 1); items.prepend({ city: 'Giza', street: 'three' }); items.insert(1, { city: 'Alex', street: 'four' });
    expect(form.state.values.addresses.map(item => item.city)).toEqual(['Giza', 'Alex', 'Cairo', '']);
    expect(old.values.addresses).toEqual([{ city: 'Cairo', street: 'one' }]);
    expect((await form.submit(values => values.addresses.length)).status).toBe('invalid');
    items.remove(3); expect(await form.submit(values => values.addresses.length)).toEqual({ status: 'success', data: 3 });
    items.replace([{ city: 'Luxor', street: '' }]); expect(() => first.form.setValue('city', 'late')).toThrow('disposed');
    items.clear(); expect(form.state.values.addresses).toEqual([]); form.reset();
    expect(form.state.values.addresses).toEqual([{ city: 'Cairo', street: 'one' }]); expect(items.items[0]!.key).not.toBe(first.key);
    expect(() => items.move(4, 0)).toThrow(RangeError);
    if (false) {
      // @ts-expect-error row value types are preserved
      items.append({ city: 3, street: '' });
      // @ts-expect-error only explicitly declared collections
      form.array('missing');
    }
  });
  it('cancels removed async validators, keeps row dependencies and updates parent subscribers', async () => {
    const remote = deferred<boolean>(); let signal!: AbortSignal;
    const form = createValixa({ rows: collection({ a: [''], b: ['', 'same:a'], remote: { initial: '', validate: (_, context) => { signal = context.signal; return remote.promise; } } }) });
    const items = form.array('rows'); const listener = vi.fn(); form.subscribeField('rows', listener);
    items.append({ a: 'one', b: 'two', remote: '' }); const row = items.items[0]!;
    const run = row.form.validate(); items.remove(0); expect(signal.aborted).toBe(true); expect((await run).stale).toBe(true);
    remote.resolve(false); await Promise.resolve(); expect(form.state.errors).toEqual({}); expect(listener).toHaveBeenCalled();
    expect(row.form.dependencies.dependencies.b).toEqual(['a']); form.dispose(); expect(() => items.append({ a: '', b: '', remote: '' })).toThrow('disposed');
  });
});

describe('form-level validation and localization', () => {
  it('keeps prototype-shadowing field names safe in form errors and localized label catalogs', async () => {
    const form = createValixa({ toString: [''] }, { validateForm: () => ({ toString: 'Form error' }), labels: { en: {} } });
    await form.validate(); expect(form.state.errorDetails.toString?.[0]).toMatchObject({ source: 'form', message: 'Form error' });
    const required = createValixa({ toString: ['', 'required'] }, { labels: { en: {} } });
    await required.validate(); expect(required.state.errors.toString).toEqual(['toString is required.']);
  });
  it('merges field before form errors and supports form-wide failures and fresh server retry', async () => {
    const form = createValixa({ start: [5], end: [1, 'minValue:10'] }, { validateForm: values => values.start > values.end ? { end: 'End must follow start', $form: 'Date range is invalid' } : {} });
    await form.validate(); expect(form.state.errors.end).toEqual(['end must be at least 10.', 'End must follow start']);
    expect(form.state.formErrors).toEqual(['Date range is invalid']);
    form.setError('end', 'server'); expect(form.state.errors.end).toEqual(['server']);
    await form.validate(); expect(form.state.errors.end).toHaveLength(2);
    form.setValue('end', 20); expect(await form.submit(values => values.end)).toEqual({ status: 'success', data: 20 });
  });
  it('cancels form validator races, respects explicit dependencies and cleans up timeout work', async () => {
    vi.useFakeTimers(); const remote = deferred<Record<string, string>>(); let signal!: AbortSignal;
    const validateForm = vi.fn((_: unknown, context: { signal: AbortSignal }) => { signal = context.signal; return remote.promise; });
    const form = createValixa({ a: [0], b: [0] }, { validateForm, formDependsOn: ['a'], validation: { timeout: 50 } });
    const run = form.validate(); await Promise.resolve(); form.setValue('b', 1); expect(signal.aborted).toBe(false);
    form.setValue('a', 1); expect(signal.aborted).toBe(true); expect((await run).stale).toBe(true);
    remote.resolve({ a: 'late' }); await Promise.resolve(); expect(form.state.errors).toEqual({});
    const timeout = createValixa({ a: [0] }, { validateForm: () => new Promise(() => {}), validation: { timeout: 20 } });
    const timed = timeout.validate(); await vi.advanceTimersByTimeAsync(20); expect((await timed).stale).toBe(false);
    expect(timeout.state.formErrors).toEqual(['Form validation timed out.']); expect(vi.getTimerCount()).toBe(0);
  });
  it('debounces one form request and submits a complete fresh validation', async () => {
    vi.useFakeTimers(); const validateForm = vi.fn(() => ({}));
    const form = createValixa({ a: [0], b: [0] }, { validateForm, validation: { mode: 'onChange', debounce: 10 } });
    form.setValues({ a: 1, b: 2 }); await vi.advanceTimersByTimeAsync(10); expect(validateForm).toHaveBeenCalledTimes(1);
    form.setValue('a', 3); await form.submit(() => true); await vi.runAllTimersAsync(); expect(validateForm).toHaveBeenCalledTimes(2);
  });
  it('switches structured rule messages without revalidating and preserves literal custom/server messages', async () => {
    const validate = vi.fn(() => 'Custom literal');
    const form = createValixa({ name: ['', 'required | min:3'], custom: { initial: '', validate }, server: [''] }, { labels: { ar: { name: 'الاسم' } } });
    await form.validate(); form.setError('server', 'Server literal');
    const old = form.state; const listener = vi.fn(); form.subscribeField('name', listener); form.setLocale('ar');
    expect(form.state.errors.name).toEqual(['الاسم مطلوب.']); expect(old.errors.name).toEqual(['name is required.']);
    expect(form.state.errors.custom).toEqual(['Custom literal']); expect(form.state.errors.server).toEqual(['Server literal']);
    expect(validate).toHaveBeenCalledTimes(1); expect(listener).toHaveBeenCalled();
    expect(form.state.errorDetails.name?.[0]).toMatchObject({ code: 'required', source: 'field', field: 'name' });
    registerLocale('test', { messages: { required: '{label}: mandatory' }, labels: { name: 'Display name' } });
    form.setLocale('test'); expect(form.state.errors.name).toEqual(['Display name: mandatory']);
    form.setLocale('missing'); expect(form.state.errors.name).toEqual(['name is required.']);
  });
  it('localizes parameterized rules and custom templates with a fallback locale', async () => {
    const form = createValixa({ name: ['x', 'min:3'] }, { locale: 'missing', fallbackLocale: 'ar', labels: { ar: { name: 'الاسم' } } });
    await form.validate(); expect(form.state.errors.name).toEqual(['يجب ألا يقل طول الاسم عن 3.']);
    const custom = createValixa({ name: ['', 'required'] }, { locale: 'ar', messages: { required: 'Please fill {label}' } });
    await custom.validate(); expect(custom.state.errors.name).toEqual(['Please fill name']);
  });
});
