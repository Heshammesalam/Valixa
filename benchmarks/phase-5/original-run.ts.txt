import { performance } from 'node:perf_hooks';
import { cpus, platform, release, arch } from 'node:os';
import { writeFileSync } from 'node:fs';
import { createValixa, collection } from '../packages/core/src/index.js';
import { createValixa as baseline } from './baseline/core/index.js';

const warmup = 3, samples = 9, updates = 20;
type Distribution = { median: number; p10: number; p90: number; samples: number[] };
const distribution = (values: number[]): Distribution => {
  const sorted = [...values].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)]!, p10: sorted[Math.floor((sorted.length - 1) * .1)]!, p90: sorted[Math.ceil((sorted.length - 1) * .9)]!, samples: values };
};
async function measure(work: () => void | Promise<void>, divisor = 1): Promise<Distribution> {
  const times: number[] = [];
  for (let sample = -warmup; sample < samples; sample++) {
    const start = performance.now(); await work(); const elapsed = (performance.now() - start) / divisor;
    if (sample >= 0) times.push(elapsed);
  }
  return distribution(times);
}
const results: Record<string, unknown> = {
  environment: { date: new Date().toISOString(), node: process.version, platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model },
  methodology: { warmup, samples, updatesPerSample: updates, units: 'milliseconds per operation; heap deltas in bytes', clock: 'performance.now, sequential samples in one process', heap: global.gc ? 'five retained forms per sample, heap delta divided by five after forced GC; approximate, engine/cache dependent' : 'unavailable; use --expose-gc', baseline: 'Source snapshot captured before Phase 5 runtime edits; same process/Node/workloads. No other libraries compared.' },
  sizes: {}
};
for (const size of [10, 100, 1000]) {
  const record: Record<string, unknown> = {};
  for (const [label, factory] of [['baseline', baseline], ['phase5', createValixa]] as const) {
    const schema: Record<string, readonly [string, string]> = Object.fromEntries(Array.from({ length: size }, (_, index) => [`f${index}`, index === 0 ? ['start', ''] : index === 1 ? ['different', 'same:f0'] : ['', 'required']]));
    const create = () => factory(schema);
    const creation = await measure(() => { const form = create(); form.dispose(); });
    const form = create();
    const singleUpdate = await measure(() => { for (let index = 0; index < updates; index++) form.setValue('f0', `value-${index}`); }, updates);
    const fullValidation = await measure(async () => { await form.validate(); });
    let fieldNotifications = 0, formNotifications = 0;
    const offs = Object.keys(schema).map(name => form.subscribeField(name, () => fieldNotifications++));
    const off = form.subscribe(() => formNotifications++);
    await form.validate(); fieldNotifications = 0; formNotifications = 0; form.setValue('f0', 'notification-change');
    const notifications = { field: fieldNotifications, form: formNotifications, workload: 'One value change after full invalid validation; one same dependent; all other fields required.' };
    off(); offs.forEach(unsubscribe => unsubscribe());
    // Isolate invalidation timing from preparation; collect another explicit distribution.
    const invalidationTimes: number[] = [];
    for (let index = -warmup; index < samples; index++) { await form.validate(); const start = performance.now(); form.setValue('f0', `invalid-${index}`); if (index >= 0) invalidationTimes.push(performance.now() - start); }
    const asyncSchema = Object.fromEntries(Array.from({ length: size }, (_, index) => [`f${index}`, { initial: '', dependsOn: [], validate: async () => true }]));
    const asynchronous = factory(asyncSchema, { validateOn: 'change' });
    let sequence = 0;
    const asyncScheduling = await measure(async () => {
      asynchronous.setValue('f0', String(++sequence));
      let turns = 0; while (asynchronous.state.validating) { if (++turns > 10000) throw new Error('Unexpected non-settling benchmark'); await Promise.resolve(); }
    });
    asynchronous.dispose(); form.dispose();
    let heap: Distribution | null = null;
    if (global.gc) {
      const deltas: number[] = [];
      const retained: ReturnType<typeof create>[] = [];
      for (let index = 0; index < samples; index++) {
        global.gc(); const before = process.memoryUsage().heapUsed;
        for (let count = 0; count < 5; count++) retained.push(create());
        global.gc(); deltas.push((process.memoryUsage().heapUsed - before) / 5);
        for (const held of retained.splice(0)) held.dispose();
      }
      heap = distribution(deltas);
    }
    record[label] = { creationAndDisposal: creation, singleUpdate, dependentInvalidation: distribution(invalidationTimes), fullValidation, asyncScheduling, notifications, retainedHeapBytes: heap };
  }
  const arrays = createValixa({ rows: collection({ value: [''] }, Array.from({ length: size }, (_, index) => ({ value: String(index) }))) });
  const rows = arrays.array('rows');
  const dynamicArray = await measure(() => { rows.append({ value: 'new' }); rows.move(rows.items.length - 1, 0); rows.swap(0, 1); rows.remove(0); }, 4);
  const scheduled = createValixa(Object.fromEntries(Array.from({ length: size }, (_, index) => [`f${index}`, ['']])), { validation: { mode: 'onChange', debounce: 300 } });
  let sequence = 0;
  const debounceArmAndCancel = await measure(() => { scheduled.setValue('f0', String(++sequence)); scheduled.cancelValidation(); }, 2);
  scheduled.dispose(); arrays.dispose(); record.phase5Collections = { dynamicArrayPerOperation: dynamicArray, debounceArmOrCancel: debounceArmAndCancel, baseline: 'Unavailable: baseline has no dynamic collection/debounce API' };
  (results.sizes as Record<number, unknown>)[size] = record;
  console.log(`Measured ${size} fields and ${size} collection rows`);
}
writeFileSync(new URL('./results.json', import.meta.url), `${JSON.stringify(results, null, 2)}\n`);
console.log('Saved benchmarks/results.json');
