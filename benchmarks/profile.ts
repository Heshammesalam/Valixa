import { Session } from 'node:inspector';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const preserved = process.argv.includes('--phase5');
const includeCollected = process.argv.includes('--allocations');
const suffix = includeCollected ? '-allocation' : '';
const engine = await import(preserved ? './phase-5/core/index.js' : '../packages/core/src/index.js');
const { createValixa, collection } = engine;
const size = 1000, samples = 9, warmup = 3;
const schema = Object.fromEntries(Array.from({ length: size }, (_, i) => [`f${i}`, i === 0 ? ['start', ''] : i === 1 ? ['different', 'same:f0'] : ['', 'required']]));
const stats = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return { median: sorted[4], p10: sorted[0], p90: sorted[8], samples: values }; };
const results: Record<string, unknown> = { engine: preserved ? 'phase5' : 'current', node: process.version, size, warmup, samples, allocationMethod: includeCollected ? 'inspector sampled allocations including minor/major GC collected objects; instrumentation overhead included' : 'inspector sampled live allocations only, not allocation rate' };
async function measure(name: string, setup: () => (() => void | Promise<void>), cleanup: () => void = () => {}) {
  const times: number[] = [];
  for (let i = -warmup; i < samples; i++) { const work = setup(); const start = performance.now(); await work(); if (i >= 0) times.push(performance.now() - start); cleanup(); }
  results[name] = stats(times);
}
let form: any;
await measure('initialization', () => () => { form = createValixa(schema); }, () => form.dispose());
form = createValixa(schema);
await measure('singleMutation', () => () => form.setValue('f0', String(performance.now())));
await measure('snapshotPublicationNoChange', () => () => form.publish());
let calls = 0;
const offs = Object.keys(schema).map(name => form.subscribeField(name, () => { calls++; }));
await measure('mutationWith1000Subscribers', () => () => { const old = calls; form.setValue('f0', String(performance.now())); assert.equal(calls - old, 1); });
offs.forEach(off => off());
const definition = (form as any).definition;
await measure('graphTraversalOnly', () => () => { assert.equal(definition.graph.affected(['f0']).size, 2); });
await measure('fullValidation', () => async () => { const result = await form.validate(); assert.equal(result.stale, false); assert.equal(Object.keys(result.errors).length, size - 1); });
form.dispose();
let requests = 0;
const asyncSchema = Object.fromEntries(Array.from({ length: size }, (_, i) => [`f${i}`, { initial: '', dependsOn: [], validate: async () => { requests++; return true; } }]));
form = createValixa(asyncSchema, { validateOn: 'change' });
await measure('asyncScheduling', () => async () => { const before = requests; form.setValue('f0', String(performance.now())); for (let turn = 0; form.state.pending && turn < 100; turn++) await Promise.resolve(); assert.equal(form.state.pending, false); assert.equal(requests - before, 1); });
form.dispose();
const parent = createValixa({ rows: collection({ value: [''] }, Array.from({ length: size }, (_, i) => ({ value: String(i) }))) });
const rows = parent.array('rows');
await measure('collectionMoveAndBack', () => () => { const row = rows.items[0]; rows.move(0, 1); rows.move(1, 0); assert.equal(rows.items[0], row); });
parent.dispose();
await measure('disposal', () => { form = createValixa(schema); return () => form.dispose(); });

// Sampling is separate from timing microbenchmarks. Samples estimate CPU/allocation,
// not retained heap. Save raw profiles so attribution can be re-examined.
const session = new Session(); session.connect();
const post = (method: string, params: object = {}) => new Promise<any>((resolve, reject) => session.post(method as any, params, (error, value) => error ? reject(error) : resolve(value)));
await post('Profiler.enable');
for (const operation of ['updates', 'validation']) {
  const sampled = createValixa(schema);
  await post('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: includeCollected, includeObjectsCollectedByMinorGC: includeCollected });
  await post('Profiler.start');
  const start = performance.now();
  for (let i = 0; i < 200; i++) { if (operation === 'updates') sampled.setValue('f0', String(i)); else await sampled.validate(); }
  const elapsed = performance.now() - start;
  const cpu = await post('Profiler.stop'); const allocation = await post('HeapProfiler.stopSampling');
  const cpuTotals = new Map<string, number>();
  for (const node of cpu.profile.nodes) cpuTotals.set(node.callFrame.functionName || '(anonymous)', (cpuTotals.get(node.callFrame.functionName || '(anonymous)') ?? 0) + (node.hitCount ?? 0));
  const allocated = new Map<string, number>();
  const visit = (node: any) => { const name = node.callFrame.functionName || '(anonymous)'; allocated.set(name, (allocated.get(name) ?? 0) + node.selfSize); for (const child of node.children) visit(child); };
  visit(allocation.profile.head);
  const total = [...allocated.values()].reduce((sum, bytes) => sum + bytes, 0);
  results[`${operation}Profile`] = { operations: 200, elapsed, cpuSelfSamples: [...cpuTotals].sort((a, b) => b[1] - a[1]).slice(0, 18), allocationSites: [...allocated].sort((a, b) => b[1] - a[1]).slice(0, 18), sampledBytes: total, estimatedAllocatedBytesPerOperation: includeCollected ? total / 200 : null, estimatedAllocationMiBPerSecond: includeCollected ? total / (1024 * 1024) / (elapsed / 1000) : null };
  writeFileSync(`artifacts/phase-5-1-${preserved ? 'before' : 'after'}${suffix}-${operation}.cpuprofile`, JSON.stringify(cpu.profile));
  writeFileSync(`artifacts/phase-5-1-${preserved ? 'before' : 'after'}${suffix}-${operation}.heapprofile`, JSON.stringify(allocation.profile));
  sampled.dispose();
}
session.disconnect();
writeFileSync(new URL(`./phase-5-1-${preserved ? 'before' : 'after'}${suffix}-profile.json`, import.meta.url), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
