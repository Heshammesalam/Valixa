import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { cpus, platform, release, arch } from 'node:os';
import { writeFileSync } from 'node:fs';
import * as before from './phase-5/core/index.js';
import * as after from '../packages/core/src/index.js';

// Paired Phase 5 / 5.1 suite. The original run.ts is retained unchanged.
// Same workload, warmup/sample/update counts; assertions execute outside timers.
const warmup = 3, samples = 9, updates = 20;
function stats(values: number[]) { const sorted = [...values].sort((a, b) => a - b); return { median: sorted[4], p10: sorted[0], p90: sorted[8], samples: values }; }
async function measure(work: () => void | Promise<void>, divisor = 1, check = () => {}, setup = () => {}) {
  const times: number[] = [];
  for (let i = -warmup; i < samples; i++) { setup(); const start = performance.now(); await work(); const elapsed = (performance.now() - start) / divisor; check(); if (i >= 0) times.push(elapsed); }
  return stats(times);
}
const output: any = { environment: { date: new Date().toISOString(), node: process.version, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model }, methodology: { warmup, samples, updates, timing: 'performance.now, milliseconds per operation; assertions outside timers; same schemas/order as run.ts', memory: 'five retained forms after forced GC per sample; approximate bytes/form, not allocation throughput', order: 'Phase 5 then Phase 5.1 at each size, same process; host/JIT drift remains possible' }, sizes: {} };
for (const size of [10, 100, 1000]) {
  const pair: any = {};
  for (const [label, engine] of [['phase5', before], ['phase5_1', after]] as const) {
    const schema: any = Object.fromEntries(Array.from({ length: size }, (_, i) => [`f${i}`, i === 0 ? ['start', ''] : i === 1 ? ['different', 'same:f0'] : ['', 'required']]));
    const create = () => engine.createValixa(schema);
    let created: any;
    const creationAndDisposal = await measure(() => { created = create(); created.dispose(); }, 1, () => { assert.equal(created.state.values.f0, 'start'); assert.equal(created.state.pending, false); });
    const form = create();
    const singleUpdate = await measure(() => { for (let i = 0; i < updates; i++) form.setValue('f0', `value-${i}`); }, updates, () => assert.equal(form.state.values.f0, 'value-19'));
    let validation: any;
    const checkValidation = () => { assert.equal(validation.valid, false); assert.equal(validation.stale, false); assert.equal(Object.keys(validation.errors).length, size - 1); assert.equal(form.state.pending, false); };
    const fullValidation = await measure(async () => { validation = await form.validate(); }, 1, checkValidation);
    let field = 0, whole = 0;
    const offs = Object.keys(schema).map(name => form.subscribeField(name, () => field++)); const off = form.subscribe(() => whole++);
    await form.validate(); field = 0; whole = 0; form.setValue('f0', 'notification-change'); assert.equal(field, 2); assert.equal(whole, 1);
    const notifications = { field, form: whole }; off(); offs.forEach(unsubscribe => unsubscribe());
    const invalidation: number[] = [];
    for (let i = -warmup; i < samples; i++) {
      validation = await form.validate(); checkValidation(); const start = performance.now(); form.setValue('f0', `invalid-${i}`); const elapsed = performance.now() - start;
      assert.equal(form.state.errors.f1, undefined); assert.equal(Object.keys(form.state.errors).length, size - 2); if (i >= 0) invalidation.push(elapsed);
    }
    let requests = 0;
    const asyncSchema: any = Object.fromEntries(Array.from({ length: size }, (_, i) => [`f${i}`, { initial: '', dependsOn: [], validate: async () => { requests++; return true; } }]));
    const asynchronous = engine.createValixa(asyncSchema, { validateOn: 'change' }); let sequence = 0;
    const asyncScheduling = await measure(async () => { asynchronous.setValue('f0', String(++sequence)); let turns = 0; while (asynchronous.state.validating) { if (++turns > 10000) throw Error('Non-settling benchmark'); await Promise.resolve(); } }, 1, () => { assert.equal(requests, sequence); assert.equal(asynchronous.state.validating, false); assert.equal(asynchronous.state.valid, true); });
    asynchronous.dispose(); form.dispose();
    const deltas: number[] = []; const retained: any[] = [];
    if (global.gc) for (let i = 0; i < samples; i++) { global.gc(); const initial = process.memoryUsage().heapUsed; for (let j = 0; j < 5; j++) retained.push(create()); global.gc(); deltas.push((process.memoryUsage().heapUsed - initial) / 5); for (const held of retained.splice(0)) held.dispose(); }
    const parent = engine.createValixa({ rows: engine.collection({ value: [''] }, Array.from({ length: size }, (_, i) => ({ value: String(i) }))) });
    const rows = parent.array('rows'); const originalKeys = rows.items.map(row => row.key);
    let priorKeys: string[] = [], priorValues: string[] = [];
    const dynamicArrayPerOperation = await measure(() => { rows.append({ value: 'new' }); rows.move(rows.items.length - 1, 0); rows.swap(0, 1); rows.remove(0); }, 4,
      () => { assert.equal(rows.items.length, size); assert.equal(new Set(rows.items.map(row => row.key)).size, size); assert.deepEqual(rows.items.slice(1).map(row => row.key), priorKeys.slice(1)); assert.deepEqual(parent.state.values.rows.map(row => row.value), ['new', ...priorValues.slice(1)]); },
      () => { priorKeys = rows.items.map(row => row.key); priorValues = rows.values.map(row => row.value); });
    // The existing array workload deliberately rotates surviving rows; no stronger
    // postcondition is substituted. Stable movement is checked in focused tests.
    assert.equal(originalKeys.length, size);
    const scheduled = engine.createValixa(Object.fromEntries(Array.from({ length: size }, (_, i) => [`f${i}`, ['']])), { validation: { mode: 'onChange', debounce: 300 } });
    let scheduledSequence = 0;
    const debounceArmOrCancel = await measure(() => { scheduled.setValue('f0', String(++scheduledSequence)); scheduled.cancelValidation(); }, 2, () => assert.equal(scheduled.state.pending, false));
    scheduled.dispose(); parent.dispose();
    pair[label] = { creationAndDisposal, singleUpdate, dependentInvalidation: stats(invalidation), fullValidation, asyncScheduling, retainedHeapBytes: deltas.length ? stats(deltas) : null, notifications, dynamicArrayPerOperation, debounceArmOrCancel };
  }
  output.sizes[size] = pair; console.log(`Paired Phase 5 / 5.1 assertions and measurements passed: ${size} fields`);
}
writeFileSync(new URL('./phase-5-1-results.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
