import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import * as before from './phase-6-baseline/core/index.js';
import * as current from '../packages/core/src/index.js';

const warmup = 20, samples = 31, updates = 200, validations = 5;
const statistics = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return { median: sorted[15], p10: sorted[3], p90: sorted[27], samples: values }; };
const report: any = { date: new Date().toISOString(), node: process.version, methodology: { warmup, samples, updates, validations, order: 'Baseline/current alternate first position on every paired sample; both engines warmed before measurement', unit: 'milliseconds/operation', scope: 'Disabled instrumentation; same schema/data; independent retained forms; assertions outside timed work. No timing thresholds. Diagnostic supplement to unchanged benchmark commands.' }, sizes: {} };
for (const size of [10, 100, 1000]) {
  const schema: any = Object.fromEntries(Array.from({ length: size }, (_, index) => [`f${index}`, ['', 'required']]));
  const engines = [before, current], forms = engines.map(engine => engine.createValixa(schema)), sequence = [0, 0];
  const measurements = engines.map(() => ({ updates: [] as number[], validation: [] as number[], initialization: [] as number[] }));
  for (let sample = -warmup; sample < samples; sample++) {
    const order = sample % 2 === 0 ? [0, 1] : [1, 0];
    for (const index of order) {
      const form = forms[index]!, engine = engines[index]!, result = measurements[index]!;
      let started = performance.now(); for (let count = 0; count < updates; count++) form.setValue('f0', String(++sequence[index]!)); const updateTime = (performance.now() - started) / updates;
      assert.equal(form.state.values.f0, String(sequence[index]));
      started = performance.now(); for (let count = 0; count < validations; count++) await form.validate(); const validationTime = (performance.now() - started) / validations;
      assert.equal(Object.keys(form.state.errors).length, size - 1); assert.equal(form.state.pending, false);
      started = performance.now(); const created = engine.createValixa(schema); created.dispose(); const initializationTime = performance.now() - started;
      if (sample >= 0) { result.updates.push(updateTime); result.validation.push(validationTime); result.initialization.push(initializationTime); }
    }
  }
  forms.forEach(form => form.dispose());
  const baseline = Object.fromEntries(Object.entries(measurements[0]!).map(([name, values]) => [name, statistics(values)])), disabled = Object.fromEntries(Object.entries(measurements[1]!).map(([name, values]) => [name, statistics(values)]));
  report.sizes[size] = { baseline, disabled, ratios: Object.fromEntries(Object.keys(baseline).map(name => [name, disabled[name]!.median! / baseline[name]!.median!])) };
}
writeFileSync(new URL('../artifacts/phase-7-paired-performance.json', import.meta.url), JSON.stringify(report, null, 2));
console.log('Counterbalanced Phase 7 performance assertions and paired measurements passed.');
