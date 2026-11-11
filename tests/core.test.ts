import { describe, expect, it, vi } from 'vitest';
import { blueprint, createValixa, parseRules, RuleSyntaxError } from '../packages/core/src/index.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('rule grammar and diagnostics', () => {
  it('parses pipelines, arrays and whitespace without executing code', () => {
    expect(parseRules([' required | min : 8 ', 'email'])).toEqual([{ name: 'required' }, { name: 'min', param: '8' }, { name: 'email' }]);
    expect(parseRules()).toEqual([]);
  });
  it.each(['noSuchRule', 'min', 'min:NaN', 'min:-1', 'max:1.5', 'required:1', 'same:', '|required', 'required||email', 'min:1:2', 'min:Infinity', 'required;process.exit()'])('rejects %s', rule => {
    expect(() => parseRules(rule)).toThrow(RuleSyntaxError);
  });
  it('checks cross-field references at construction', () => {
    expect(() => createValixa({ confirm: ['', 'same:missing'] })).toThrow('unknown field');
  });
});

describe('validation', () => {
  it('runs the requested first vertical slice', async () => {
    const form = createValixa({ email: ['', 'required | email'], password: ['', 'required | min:8'] });
    form.setValue('email', 'user@example.com');
    expect(await form.validate()).toEqual({ valid: false, stale: false, errors: { password: ['password is required.'] } });
    form.setValue('password', '12345678');
    expect((await form.validate()).valid).toBe(true);
  });
  it.each([
    ['email', 'bad', false], ['email', 'x@example.com', true],
    ['url', 'https://example.com/a', true], ['url', 'javascript:alert(1)', false],
    ['url', 'http://[', false], ['url', 'https://example.com:wrong', false],
    ['min:3', 'ab', false], ['max:2', 'abc', false], ['min:2', ['a', 'b'], true],
    ['minValue:2', 1, false], ['maxValue:2', 2, true], ['minValue:2', '3', false],
    ['required', false, false], ['required', 0, true], ['required', [], false],
    ['email', '', true], ['required', ' ', true]
  ])('evaluates %s on %j', async (rule, value, valid) => {
    const form = createValixa({ field: { initial: value, rules: rule } });
    expect((await form.validate()).valid).toBe(valid);
  });
  it('supports cross-field equality and partial validation', async () => {
    const form = createValixa({ password: ['abc', 'required'], confirm: ['', 'same:password'], email: ['', 'required'] });
    form.setValue('confirm', 'wrong');
    expect((await form.validate('confirm')).errors).toEqual({ confirm: ['confirm must match password.'] });
    form.setValue('confirm', 'abc');
    expect((await form.validate('confirm')).valid).toBe(true);
    expect((await form.validate()).valid).toBe(false);
  });
  it('supports labels, templates and custom validators', async () => {
    const form = createValixa({ age: { initial: 10, label: 'Age', rules: 'minValue:18' } }, { messages: { minValue: '{label}: minimum {param}' } });
    expect((await form.validate()).errors.age).toEqual(['Age: minimum 18']);
    const custom = createValixa({ name: { initial: 'bad', validate: [(value: string) => value !== 'bad', () => 'Server rejected value'] } });
    expect((await custom.validate()).errors.name).toEqual(['name is invalid.', 'Server rejected value']);
  });
  it('converts validator exceptions into generic errors without leaking secrets', async () => {
    const form = createValixa({ token: { initial: '', validate: () => { throw new Error('secret'); } } });
    expect((await form.validate()).errors.token).toEqual(['token could not be validated.']);
  });
  it('skips remote validators when basic rules fail', async () => {
    const validate = vi.fn();
    await createValixa({ name: { initial: '', rules: 'required', validate } }).validate();
    expect(validate).not.toHaveBeenCalled();
  });
});

describe('state and subscriptions', () => {
  it('has stable immutable snapshots and correct dirty/reset semantics', async () => {
    const form = createValixa({ name: ['initial', 'required'] });
    const initial = form.getSnapshot();
    expect(form.getSnapshot()).toBe(initial);
    expect(initial).toMatchObject({ pristine: true, dirty: false, touched: { name: false }, validating: false });
    expect(() => { (initial.values as { name: string }).name = 'mutation'; }).toThrow();
    form.setValue('name', 'changed'); form.setTouched('name');
    expect(form.state).toMatchObject({ dirty: true, pristine: false, touched: { name: true } });
    expect(initial.values.name).toBe('initial');
    form.setValue('name', 'initial'); expect(form.state.dirty).toBe(false);
    form.setError('name', 'server'); expect(form.state.invalid).toBe(true);
    form.clearErrors('name'); expect(form.state.valid).toBe(true);
    form.reset(); expect(form.state).toMatchObject({ dirty: false, touched: { name: false }, submitCount: 0 });
  });
  it('notifies only changed field subscribers and batches setValues', () => {
    const form = createValixa({ a: ['', ''], b: ['', ''] });
    const all = vi.fn(), a = vi.fn(), b = vi.fn();
    form.subscribe(all); const off = form.subscribeField('a', a); form.subscribeField('b', b);
    const oldB = form.getFieldState('b');
    form.setValue('a', 'one');
    expect(all).toHaveBeenCalledTimes(1); expect(a).toHaveBeenCalledTimes(1); expect(b).not.toHaveBeenCalled();
    expect(form.getFieldState('b')).toBe(oldB);
    form.setValues({ a: 'two', b: 'one' }); expect(all).toHaveBeenCalledTimes(2);
    form.setValue('b', 'one'); expect(all).toHaveBeenCalledTimes(2);
    off(); form.setValue('a', 'three'); expect(a).toHaveBeenCalledTimes(2);
    form.dispose(); expect(() => form.setValue('a', 'four')).toThrow('disposed');
    form.dispose();
  });
  it('owns independent copies of plain nested data and arrays', () => {
    const initial = { tags: ['one'], address: { city: 'Cairo' } };
    const definition = blueprint({ profile: { initial } });
    const a = createValixa(definition), b = createValixa(definition);
    initial.tags.push('external');
    a.setValue('profile', { tags: ['two'], address: { city: 'Giza' } });
    expect(b.state.values.profile.tags).toEqual(['one']);
    a.reset(); expect(a.state.values.profile.address.city).toBe('Cairo');
    expect(() => createValixa({ date: { initial: new Date() } })).toThrow('plain');
  });
  it('rejects invalid field names atomically', () => {
    const form = createValixa({ a: ['', ''] });
    expect(() => form.setValues({ a: 'new', bad: 'x' } as never)).toThrow('Unknown field');
    expect(form.state.values.a).toBe('');
    expect(() => createValixa({ constructor: ['', ''] })).toThrow('Reserved');
  });
  it('handles field names that shadow Object prototype methods', async () => {
    const form = createValixa({ toString: ['', 'required'], hasOwnProperty: ['', ''] });
    expect(form.getFieldState('toString').errors).toEqual([]);
    expect((await form.validate()).errors.toString).toEqual(['toString is required.']);
    form.setValue('toString', 'valid');
    expect((await form.validate()).valid).toBe(true);
    expect(form.getFieldState('toString').errors).toEqual([]);
  });
  it('implements opt-in change and blur validation', async () => {
    const change = createValixa({ name: ['', 'required'] }, { validateOn: 'change' });
    change.setValue('name', 'valid'); await vi.waitFor(() => expect(change.state.validating).toBe(false));
    change.setValue('name', ''); await vi.waitFor(() => expect(change.state.invalid).toBe(true));
    const blur = createValixa({ name: ['', 'required'] }, { validateOn: 'blur' });
    blur.setTouched('name'); await vi.waitFor(() => expect(blur.state.invalid).toBe(true));
  });
});

describe('asynchronous validation ownership', () => {
  it('aborts old runs and prevents stale responses overwriting new state', async () => {
    const old = deferred<boolean>(); let signal: AbortSignal | undefined;
    const form = createValixa({ user: { initial: 'old', validate: (value: string, context) => {
      if (value === 'old') { signal = context.signal; return old.promise; }
      return true;
    } } });
    const first = form.validate(); expect(form.state.validating).toBe(true);
    form.setValue('user', 'new'); expect(signal?.aborted).toBe(true);
    expect((await form.validate()).valid).toBe(true);
    old.resolve(false); expect((await first).stale).toBe(true);
    expect(form.state.errors).toEqual({}); expect(form.state.validating).toBe(false);
  });
  it('preserves server errors against in-flight validation', async () => {
    const remote = deferred<boolean>();
    const form = createValixa({ user: { initial: '', validate: () => remote.promise } });
    const run = form.validate(); form.setError('user', 'Already taken'); remote.resolve(true);
    expect((await run).stale).toBe(true); expect(form.state.errors.user).toEqual(['Already taken']);
  });
  it('reset and disposal invalidate pending work', async () => {
    for (const action of ['reset', 'dispose'] as const) {
      const remote = deferred<boolean>();
      const form = createValixa({ user: { initial: '', validate: () => remote.promise } });
      const run = form.validate(); form[action](); remote.resolve(false);
      expect((await run).stale).toBe(true); expect(form.state.validating).toBe(false);
    }
  });
});

describe('submission', () => {
  it('validates before submission and marks all fields touched', async () => {
    const form = createValixa({ email: ['', 'required | email'] }); const handler = vi.fn();
    expect((await form.submit(handler)).status).toBe('invalid'); expect(handler).not.toHaveBeenCalled();
    expect(form.state).toMatchObject({ submitCount: 1, touched: { email: true }, submitting: false, submitted: false });
    form.setValue('email', 'user@example.com');
    expect(await form.submit(values => values.email)).toEqual({ status: 'success', data: 'user@example.com' });
    expect(form.state).toMatchObject({ submitCount: 2, submitted: true, submitting: false });
  });
  it('prevents duplicates, passes isolated data, and awaits async handlers', async () => {
    const pending = deferred<number>();
    const form = createValixa({ count: [1, 'minValue:0'] });
    const first = form.submit(data => { data.count = 9; return pending.promise; });
    await vi.waitFor(() => expect(form.state.validating).toBe(false));
    expect(form.state.submitting).toBe(true);
    expect((await form.submit(() => 2)).status).toBe('busy');
    expect(form.state.values.count).toBe(1); pending.resolve(3);
    expect(await first).toEqual({ status: 'success', data: 3 });
  });
  it('propagates handler failures, permits retry and maps server errors', async () => {
    const form = createValixa({ email: ['a@b.com', 'email'] });
    await expect(form.submit(() => { form.setError('email', 'Taken'); throw new Error('422'); })).rejects.toThrow('422');
    expect(form.state.submitting).toBe(false); expect(form.state.errors.email).toEqual(['Taken']);
    expect((await form.submit(() => true)).status).toBe('success');
  });
  it('does not submit values changed during validation', async () => {
    const pending = deferred<boolean>(); const handler = vi.fn();
    const form = createValixa({ name: { initial: 'a', validate: () => pending.promise } });
    const run = form.submit(handler); form.setValue('name', 'b'); pending.resolve(true);
    expect((await run).status).toBe('stale'); expect(handler).not.toHaveBeenCalled();
  });
  it('supports cancellation, event callbacks and disabled state', async () => {
    const form = createValixa({ name: ['x', 'required'] });
    form.setDisabled(true); expect((await form.submit(() => 1)).status).toBe('cancelled');
    form.setDisabled(false); form.setReadonly(true); expect(form.getFieldState('name').readonly).toBe(true);
    const pending = deferred<void>(); let signal: AbortSignal | undefined;
    const event = { preventDefault: vi.fn() };
    const run = form.handleSubmit((_, context) => { signal = context.signal; return pending.promise; })(event);
    await vi.waitFor(() => expect(signal).toBeDefined());
    form.cancelSubmit(); expect(signal?.aborted).toBe(true); pending.resolve();
    expect((await run).status).toBe('cancelled'); expect(event.preventDefault).toHaveBeenCalledOnce();
  });
});
