import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>');
for (const key of ['window', 'document', 'HTMLElement', 'SVGElement', 'Element', 'Node']) globalThis[key] = dom.window[key];
const vue = await import('vue'), valixa = await import('valixa-vue'), vee = await import('vee-validate');
const { build } = await import('esbuild');
const rule = value => (typeof value === 'string' && value.length >= 3) || 'Minimum 3 characters';
const warmup = 5, samples = 15, writes = 20;
const report = { date: new Date().toISOString(), node: process.version, source: 'Working tree with unpublished additive Standard Schema integration; manifest versions are not a new release', versions: {}, methodology: {
  warmup, samples, writes, order: 'Alternate first engine each sample; mounted setup, same initial values and field rule; validation on explicit request only',
  scope: 'Vue composables in mounted components; no input controls or rendering/paint latency measured. No timing pass/fail thresholds, no claim of general superiority.',
  units: 'milliseconds per operation', bundle: 'esbuild ESM browser production minified, Vue external, equivalent imports; raw and gzip bytes. No schema provider included.'
}, sizes: {}, bundles: {} };
for (const name of ['vue', 'vee-validate', 'valixa', 'valixa-vue']) report.versions[name] = JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url))).version;
function mounted(engine, count) {
  let api;
  const host = document.createElement('div'); document.body.append(host);
  const app = vue.createApp({ setup() {
    const initial = Object.fromEntries(Array.from({ length: count }, (_, i) => [`f${i}`, 'valid']));
    if (engine === 'valixa') {
      const form = valixa.useValixa(Object.fromEntries(Object.entries(initial).map(([name, value]) => [name, { initial: value, validate: rule, dependsOn: [] }])));
      for (const name of Object.keys(initial)) valixa.useValixaField(form, name);
      api = { set: value => form.setValue('f0', value), read: () => form.state.values.f0, validate: () => form.validate() };
    } else {
      const form = vee.useForm({ initialValues: initial });
      for (const name of Object.keys(initial)) vee.useField(name, rule, { validateOnValueUpdate: false });
      api = { set: value => form.setFieldValue('f0', value, false), read: () => form.values.f0, validate: () => form.validate() };
    }
    return () => vue.h('div');
  } });
  app.mount(host);
  return { ...api, dispose() { app.unmount(); host.remove(); } };
}
const stats = values => { const sorted = [...values].sort((a, b) => a - b); return { median: sorted[7], p10: sorted[1], p90: sorted[13], samples: values }; };
for (const count of [10, 100, 1000]) {
  const forms = { valixa: mounted('valixa', count), vee: mounted('vee', count) };
  await vue.nextTick(); await Promise.all(Object.values(forms).map(f => f.validate()));
  await new Promise(resolve => setTimeout(resolve, 10));
  const measurements = Object.fromEntries(Object.keys(forms).map(name => [name, { update: [], validation: [], initializationAndDisposal: [] }]));
  for (let sample = -warmup; sample < samples; sample++) {
    for (const name of sample % 2 === 0 ? ['valixa', 'vee'] : ['vee', 'valixa']) {
      const form = forms[name];
      let start = performance.now();
      for (let write = 0; write < writes; write++) { form.set(`value-${sample}-${write}`); await vue.nextTick(); }
      const update = (performance.now() - start) / writes;
      assert.equal(form.read(), `value-${sample}-${writes - 1}`);
      form.set('x'); await vue.nextTick();
      start = performance.now(); const result = await form.validate(); const validation = performance.now() - start;
      assert.equal(result.valid, false); assert(result.errors.f0); assert.equal(Object.keys(result.errors).length, 1);
      start = performance.now(); const temporary = mounted(name, count); await vue.nextTick(); temporary.dispose(); const initializationAndDisposal = performance.now() - start;
      // Drain asynchronous mount/disposal work outside measured operations.
      await new Promise(resolve => setTimeout(resolve, 10));
      if (sample >= 0) for (const [key, value] of Object.entries({ update, validation, initializationAndDisposal })) measurements[name][key].push(value);
    }
  }
  report.sizes[count] = Object.fromEntries(Object.entries(measurements).map(([name, metrics]) => [name, Object.fromEntries(Object.entries(metrics).map(([key, values]) => [key, stats(values)]))]));
  Object.values(forms).forEach(f => f.dispose());
}
for (const [name, contents] of Object.entries({ valixa: "export { useValixa, useValixaField } from 'valixa-vue';", vee: "export { useForm, useField } from 'vee-validate';" })) {
  const result = await build({ stdin: { contents, resolveDir: process.cwd() }, bundle: true, minify: true, format: 'esm', platform: 'browser', external: ['vue'], define: { 'process.env.NODE_ENV': '"production"' }, write: false });
  const bytes = result.outputFiles[0].contents; report.bundles[name] = { raw: bytes.length, gzip: gzipSync(bytes).length };
}
mkdirSync('artifacts/development', { recursive: true });
writeFileSync('artifacts/development/vue-comparison.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ versions: report.versions, sizes: Object.fromEntries(Object.entries(report.sizes).map(([size, engines]) => [size, Object.fromEntries(Object.entries(engines).map(([name, metrics]) => [name, Object.fromEntries(Object.entries(metrics).map(([key, values]) => [key, values.median]))]))])), bundles: report.bundles }, null, 2));
dom.window.close();
