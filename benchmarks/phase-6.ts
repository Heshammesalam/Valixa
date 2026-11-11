import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as baseline from './phase-6-baseline/core/index.js';
import * as current from '../packages/core/src/index.js';
import { attachValixaDevtools } from '../packages/devtools/src/index.js';

const warmup = 4, samples = 11, updates = 50;
function stats(values: number[]) { const sorted = [...values].sort((a, b) => a - b); return { median: sorted[5], min: sorted[0], max: sorted.at(-1), samples: values }; }
async function measure(work: () => unknown, divisor = 1) { const values: number[] = []; for (let n = -warmup; n < samples; n++) { const start = performance.now(); await work(); if (n >= 0) values.push((performance.now() - start) / divisor); } return stats(values); }
const report: any = { environment: { date: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model }, methodology: { warmup, samples, updates, unit: 'milliseconds/operation', baseline: 'Preserved optimized Phase 5.1 tarball sources before Phase 6', enabled: 'Explicit redacted inspection; pull current snapshot once after each batch; history bounded at 100', memory: 'Forced-GC median retained heap for 10 form/controller pairs; noisy approximate retained bytes, not allocation throughput. JSON bytes are serialized event payload size, not heap bytes.' }, sizes: {}, history: {} };
for (const size of [10, 100, 1000]) {
  const schema: any = Object.fromEntries(Array.from({ length: size }, (_, index) => [`f${index}`, ['', 'required']]));
  const entry: any = {};
  for (const mode of ['phase5_1', 'disabled', 'events', 'inspection'] as const) {
    const engine = mode === 'phase5_1' ? baseline : current;
    const form = engine.createValixa(schema) as current.ValixaForm<any>;
    const tools = mode === 'inspection' ? attachValixaDevtools(form, { historyLimit: 100 }) : undefined;
    let count = 0; const off = mode === 'events' ? form.observeEvents(() => count++) : undefined;
    let sequence = 0;
    const singleUpdate = await measure(() => { for (let index = 0; index < updates; index++) form.setValue('f0', String(++sequence)); tools?.getSnapshot(); }, updates);
    assert.equal(form.state.values.f0, String(sequence)); if (mode === 'events') assert.equal(count, sequence);
    const fullValidation = await measure(() => form.validate()); assert.equal(form.state.invalid, true);
    const creation = await measure(() => { const created = engine.createValixa(schema); created.dispose(); });
    tools?.detach(); off?.(); form.dispose(); entry[mode] = { singleUpdate, fullValidation, creation };
  }
  entry.disabledUpdateRatio = entry.disabled.singleUpdate.median / entry.phase5_1.singleUpdate.median;
  report.sizes[size] = entry;
}
for (const historyLimit of [0, 100, 1000]) {
  const deltas: number[] = []; let eventBytes = 0;
  for (let sample = 0; sample < samples; sample++) {
    global.gc?.(); const initial = process.memoryUsage().heapUsed;
    const retained = Array.from({ length: 10 }, () => { const form = current.createValixa({ value: [''], password: ['do not retain'] }); const tools = attachValixaDevtools(form, { historyLimit }); return { form, tools }; });
    for (const { form, tools } of retained) { for (let index = 0; index < 1200; index++) form.setValue('value', String(index)); const snapshot = tools.getSnapshot(); assert.equal(snapshot.events.length, historyLimit); const json = JSON.stringify(snapshot.events); assert(!json.includes('do not retain')); eventBytes = Buffer.byteLength(json); }
    await Promise.resolve(); global.gc?.(); deltas.push((process.memoryUsage().heapUsed - initial) / retained.length);
    for (const { form, tools } of retained) { tools.detach(); assert.deepEqual(tools.getSnapshot().events, []); form.dispose(); }
    await Promise.resolve();
  }
  report.history[historyLimit] = { retainedHeapBytesPerPair: stats(deltas), serializedEventBytes: eventBytes };
}
mkdirSync(new URL('../artifacts/phase-6/', import.meta.url), { recursive: true });
writeFileSync(new URL('../artifacts/phase-6/core-performance.json', import.meta.url), JSON.stringify(report, null, 2));
console.log('Phase 6 paired disabled/enabled instrumentation and bounded-history measurements passed.');
