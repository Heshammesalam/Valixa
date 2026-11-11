import { afterEach, describe, expect, it, vi } from 'vitest';
import { blueprint, collection, createValixa, nested } from 'valixa';
import type { LifecycleEvent } from 'valixa';
import { REDACTED, attachValixaDevtools } from 'valixa-devtools';

afterEach(() => vi.useRealTimers());
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
describe('real opt-in lifecycle events', () => {
  it('orders real scheduling/start/failure/completion and never guesses cancellation', async () => {
    vi.useFakeTimers(); const form = createValixa({ name: ['', 'required'] }, { validation: { mode: 'onChange', debounce: 10 } });
    const events: LifecycleEvent[] = []; const off = form.observeEvents(event => events.push(event));
    form.setValue('name', 'x'); expect(events.map(event => event.type)).toEqual(['field.changed', 'validation.scheduled']);
    await vi.advanceTimersByTimeAsync(10); expect(events.map(event => event.type)).toEqual(['field.changed', 'validation.scheduled', 'validation.started', 'validation.completed']);
    form.setValue('name', ''); await vi.advanceTimersByTimeAsync(10); expect(events.slice(-3).map(event => event.type)).toEqual(['validation.started', 'validation.failed', 'validation.completed']);
    form.setDisabled(true); form.cancelValidation(); expect(events.filter(event => event.type === 'validation.cancelled')).toEqual([]);
    expect(events.map(event => event.sequence)).toEqual(events.map((_, index) => index + 1)); off(); const length = events.length; form.setReadonly(true); expect(events).toHaveLength(length); form.dispose();
  });
  it('identifies obsolete async requests, settles cancellation and excludes late completion', async () => {
    const remote = deferred<boolean>(); const form = createValixa({ name: { initial: 'old', dependsOn: [], validate: value => value === 'old' ? remote.promise : true } });
    const events: LifecycleEvent[] = []; form.observeEvents(event => events.push(event)); const old = form.validate('name'); const request = events[0]!.request;
    form.setValue('name', 'new'); expect((await old).stale).toBe(true); expect(events.some(event => event.type === 'validation.cancelled' && event.request === request)).toBe(true);
    await form.validate('name'); remote.resolve(false); await Promise.resolve(); expect(events.filter(event => event.type === 'validation.completed' && event.request === request)).toEqual([]);
    form.dispose(); expect(events.at(-1)?.type).toBe('form.disposed');
  });
  it('reports actual submission outcomes and isolates diagnostic observer exceptions', async () => {
    const form = createValixa({ name: ['', 'required'] }); const events: LifecycleEvent[] = [];
    form.observeEvents(event => events.push(event)); form.observeEvents(() => { throw new Error('observer'); });
    expect((await form.submit(() => {})).status).toBe('invalid'); expect(events.at(-1)).toMatchObject({ type: 'submit.failed', reason: 'invalid' });
    form.setValue('name', 'Ada'); await form.submit(() => 'data must never be an event'); expect(events.at(-1)?.type).toBe('submit.succeeded');
    await expect(form.submit(() => { throw new Error('private failure text'); })).rejects.toThrow('private failure');
    expect(JSON.stringify(events)).not.toContain('private failure text'); expect(JSON.stringify(events)).not.toContain('data must never');
    const pending = deferred<void>(); const run = form.submit(() => pending.promise); for (let i = 0; form.state.validating && i < 100; i++) await Promise.resolve(); form.cancelSubmit(); pending.resolve(); expect((await run).status).toBe('cancelled'); expect(events.some(event => event.type === 'submit.cancelled')).toBe(true); form.dispose();
  });
});
describe('readonly DevTools inspection', () => {
  it('redacts values/messages/credentials by default without building unobserved field snapshots', async () => {
    const form = createValixa({ email: ['ada@example.com'], password: ['never-record-this'], profile: { initial: { name: 'Ada', token: 'token-secret' } }, user: nested({ name: ['private-name'] }) });
    const read = vi.spyOn(form, 'getFieldState'); const inspection = attachValixaDevtools(form, { name: 'Registration' });
    expect(read).not.toHaveBeenCalled(); form.setError('password', 'Rejected never-record-this'); form.setValue('user.name', 'new-private-name');
    const state = inspection.getSnapshot(); const text = JSON.stringify(state); expect(text).not.toContain('never-record-this'); expect(text).not.toContain('ada@example.com'); expect(text).not.toContain('token-secret'); expect(text).not.toContain('private-name');
    expect(inspection.inspectField('password')?.value).toBe(REDACTED); expect(inspection.inspectField('password')?.errors).toEqual([REDACTED]);
    expect(JSON.stringify(inspection)).not.toContain('never-record-this');
    expect(state.events.every(event => !('values' in event) && !('errors' in event))).toBe(true); inspection.detach(); form.dispose();
  });
  it('uses explicit value allowlists, redacts sensitive descendants and bounds display data', () => {
    const form = createValixa({ profile: { initial: { name: 'Ada', token: 'secret-token' } }, password: ['secret-password'], text: ['a'.repeat(50)] });
    const inspection = attachValixaDevtools(form, { visibleValues: ['profile', 'password', 'text'], maxStringLength: 8 });
    expect(inspection.getSnapshot().values.profile).toEqual({ name: 'Ada', token: REDACTED }); expect(inspection.getSnapshot().values.password).toBe(REDACTED); expect(inspection.getSnapshot().values.text).toBe('aaaaaaaa…');
    expect(Object.isFrozen(inspection.getSnapshot().values)).toBe(true); inspection.detach(); form.dispose();
  });
  it('bounds wide opt-in objects and always redacts file-like data', () => {
    const form = createValixa({ data: { initial: Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`key${index}`, `value${index}`])) }, file: { initial: { name: 'private.pdf', size: 10, type: 'application/pdf' } } });
    const inspection = attachValixaDevtools(form, { visibleValues: ['*'], allowSensitive: true, maxNodes: 4 });
    const values = inspection.getSnapshot().values; expect(Object.keys(values.data as object).length).toBeLessThanOrEqual(4); expect(JSON.stringify(values)).not.toContain('value99');
    inspection.detach(); const files = attachValixaDevtools(form, { visibleValues: ['*'], allowSensitive: true }); expect(files.getSnapshot().values.file).toBe(REDACTED); files.detach(); form.dispose();
  });
  it('bounds history, pauses/resumes recording and clears retained data on detach/disposal', async () => {
    const form = createValixa({ name: [''] }); const inspection = attachValixaDevtools(form, { historyLimit: 2, visibleValues: ['name'] });
    form.setValue('name', 'one'); form.setValue('name', 'two'); form.setValue('name', 'three'); expect(inspection.getSnapshot().events).toHaveLength(2);
    inspection.pause(); form.setValue('name', 'four'); expect(inspection.getSnapshot().events).toHaveLength(2); expect(inspection.getSnapshot().values.name).toBe('four');
    inspection.resume(); form.setValue('name', 'five'); expect(inspection.getSnapshot().events).toHaveLength(2); inspection.clear(); expect(inspection.getSnapshot().events).toEqual([]);
    const listener = vi.fn(); inspection.subscribe(listener); inspection.detach(); expect(inspection.getSnapshot()).toMatchObject({ status: 'detached', values: {}, events: [], scopes: [] }); const calls = listener.mock.calls.length; form.setValue('name', 'after'); await Promise.resolve(); expect(listener).toHaveBeenCalledTimes(calls);
    const second = attachValixaDevtools(form); const live: string[] = []; second.subscribeEvents(event => live.push(event.type)); form.dispose(); expect(live).toContain('form.disposed'); expect(second.getSnapshot()).toMatchObject({ status: 'disposed', values: {}, events: [], scopes: [] });
  });
  it('tracks stable collection identities/local graphs and unsubscribes removed rows', async () => {
    const form = createValixa({ rows: collection({ city: [''], confirm: ['', 'same:city'] }) }, { validation: { mode: 'onChange' } }); const inspection = attachValixaDevtools(form);
    const rows = form.array('rows'); rows.append({ city: 'Cairo', confirm: '' }); rows.append({ city: 'Giza', confirm: '' }); const first = rows.items[0]!;
    rows.move(0, 1); let state = inspection.getSnapshot(); expect(state.collections[0]?.rows[1]?.key).toBe(first.key); expect(state.scopes.find(scope => scope.id.endsWith(first.key))?.dependencies.dependencies.confirm).toEqual(['city']);
    expect(state.events.some(event => event.type === 'collection.added')).toBe(true); expect(state.events.some(event => event.type === 'collection.moved')).toBe(true);
    expect(state.events.some(event => event.type === 'validation.started' && event.scope.includes(first.key))).toBe(true);
    rows.remove(1); state = inspection.getSnapshot(); expect(state.scopes.some(scope => scope.id.endsWith(first.key))).toBe(false); expect(state.events.some(event => event.type === 'collection.removed' && event.key === first.key)).toBe(true);
    inspection.detach(); form.dispose();
  });
  it('supports disabled/SSR-safe inspection and rejects invalid limits', () => {
    const form = createValixa(blueprint({ name: [''] })); const observe = vi.spyOn(form, 'observeEvents');
    const inspection = attachValixaDevtools(form, { enabled: false }); expect(inspection.getSnapshot().status).toBe('disabled'); expect(observe).not.toHaveBeenCalled();
    expect(() => attachValixaDevtools(form, { historyLimit: -1 })).toThrow('historyLimit'); expect(typeof window).toBe('undefined'); inspection.detach(); form.dispose();
  });
});
