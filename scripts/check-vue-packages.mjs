import assert from 'node:assert/strict';
import { attachAdvancedTypes, verifyAdvancedConsumer } from './advanced-consumer.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url), pnpm = process.env.npm_execpath;
assert(pnpm?.includes('pnpm'), 'Run via pnpm test:packages');
const run = (args, cwd = root) => execFileSync(process.execPath, [pnpm, ...args], { cwd, stdio: 'inherit' });
const version = name => JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8')).version;
const artifacts = resolve(root, 'artifacts/packages'); mkdirSync(artifacts, { recursive: true });
const tarballs = Object.fromEntries(['core', 'vue', 'vuetify'].map(name => {
  run(['--filter', `@valixa/${name}`, 'pack', '--pack-destination', artifacts]);
  const metadata = JSON.parse(readFileSync(join(root, `packages/${name}/package.json`), 'utf8'));
  return [`@valixa/${name}`, `file:${join(artifacts, `valixa-${name}-${metadata.version}.tgz`).replaceAll('\\', '/')}`];
}));
const exampleRequire = createRequire(join(root, 'examples/vue-vuetify/package.json'));
const viteRequire = createRequire(exampleRequire.resolve('vite'));
const { rollup } = await import(pathToFileURL(viteRequire.resolve('rollup')).href);
for (const variant of ['vue', 'vuetify']) {
  const directory = mkdtempSync(join(tmpdir(), `valixa-${variant}-`));
  const selected = variant === 'vue' ? ['@valixa/core', '@valixa/vue'] : Object.keys(tarballs);
  const dependencies = Object.fromEntries(selected.map(name => [name, tarballs[name]]));
  dependencies.vue = version('vue'); dependencies['@vue/server-renderer'] = version('@vue/server-renderer');
  if (variant === 'vuetify') dependencies.vuetify = version('vuetify');
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies,
    pnpm: { overrides: Object.fromEntries(selected.map(name => [name, tarballs[name]])) } }, null, 2));
  writeFileSync(join(directory, '.npmrc'), 'auto-install-peers=false\n');
  run(['install', '--ignore-workspace', '--offline', '--ignore-scripts', '--lockfile=false'], directory);
  const consumerRequire = createRequire(join(directory, 'package.json'));
  assert.throws(() => consumerRequire.resolve('react'));
  if (variant === 'vue') assert.throws(() => consumerRequire.resolve('vuetify'));
  for (const name of selected) {
    const packageRoot = join(directory, 'node_modules', ...name.split('/'));
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
    assert.equal(manifest.type, 'module'); assert.equal(manifest.sideEffects, false);
    for (const dependency of Object.values(manifest.dependencies ?? {})) assert(!dependency.startsWith('workspace:'));
    for (const file of ['dist/index.js', 'dist/index.d.ts', 'dist/index.js.map', 'dist/index.d.ts.map', 'README.md', 'LICENSE']) assert(existsSync(join(packageRoot, file)), file);
  }
  // SSR legitimately omits style assets. Browser production tests include the real Vuetify CSS.
  writeFileSync(join(directory, 'styles.mjs'), `export async function load(url, context, next) {
    if (/\\.(css|sass|scss)$/.test(new URL(url).pathname)) return {format:'module', source:'export {};', shortCircuit:true};
    return next(url, context);
  }`);
  writeFileSync(join(directory, 'register.mjs'), `import {register} from 'node:module'; register(new URL('./styles.mjs', import.meta.url));`);
  const uiImports = variant === 'vue' ? '' : `import {createVuetify} from 'vuetify'; import {VTextField} from 'vuetify/components'; import {useVuetifyField} from '@valixa/vuetify';`;
  const uiRender = variant === 'vue' ? `return () => h('input', {value: field.state.value.value});`
    : `const props = useVuetifyField(form, 'email', {kind:'text'}); return () => h(VTextField, {...props.value, label:'Email'});`;
  writeFileSync(join(directory, 'smoke.mjs'), `
    import assert from 'node:assert/strict'; import {createSSRApp, effectScope, h} from 'vue'; import {renderToString} from '@vue/server-renderer';
    import {useValixa, useValixaField} from '@valixa/vue'; ${uiImports}
    const scope = effectScope(); const owned = scope.run(() => useValixa({email:['', 'required | email']}));
    assert.equal((await owned.validate()).valid, false); owned.setValue('email', 'user@example.com');
    assert.equal((await owned.submit(data => data.email)).status, 'success'); scope.stop();
    const App = {
      setup() {
        const form = useValixa({email:['user@example.com','email']}); const field = useValixaField(form, 'email');
        ${uiRender}
      }
    };
    const app = createSSRApp(App); ${variant === 'vuetify' ? 'app.use(createVuetify({ssr:true}));' : ''}
    assert.match(await renderToString(app), /user@example.com/); console.log('Packaged ${variant} JavaScript/SSR passed');
  `);
  execFileSync(process.execPath, ['--import', './register.mjs', 'smoke.mjs'], { cwd: directory, stdio: 'inherit' });
  verifyAdvancedConsumer(directory);
  writeFileSync(join(directory, 'consumer.ts'), `
    import {effectScope} from 'vue'; import {useValixa, useValixaField, defineValixaAdapter, useValixaAdapter} from '@valixa/vue';
    ${variant === 'vuetify' ? `import {useVuetifyField, fileMetadata, useVuetifyFileField} from '@valixa/vuetify'; import type {FileMetadata} from '@valixa/vuetify';` : ''}
    effectScope().run(() => {
      const form = useValixa({email:[''], age:[18], agree:[false]}); const field = useValixaField(form, 'email'); const email: string = field.state.value.value;
      // @ts-expect-error unknown field
      useValixaField(form, 'missing');
      // @ts-expect-error incorrect value
      form.setValue('age', 'eighteen');
      const nullable = defineValixaAdapter<number|null,{clear:()=>void}>(field => ({clear:()=>field.setValue(null)}));
      // @ts-expect-error nullable writer cannot bind a non-nullable field
      useValixaAdapter(form,'age',nullable);
      ${variant === 'vuetify' ? `const text: string = useVuetifyField(form,'email',{kind:'text'}).value.modelValue;
        // @ts-expect-error incompatible component
        useVuetifyField(form,'agree',{kind:'text'});
        // @ts-expect-error invalid numeric clear policy
        useVuetifyField(form,'age',{kind:'number',emptyValue:null});
        const files = useValixa({uploads:{initial:[] as FileMetadata[]}}); useVuetifyFileField(files,'uploads',fileMetadata,{multiple:true});` : ''}
    });
  `);
  attachAdvancedTypes(directory, 'consumer.ts', `effectScope().run(()=>{const field=useValixaField(advancedForm,'user.age');const value:number=field.state.value.value;${variant === 'vue' ? '' : "useVuetifyField(advancedForm,'user.age',{kind:'number',emptyValue:0});"}});`);
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--strict', '--exactOptionalPropertyTypes', '--noEmit', '--skipLibCheck', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', 'consumer.ts'], { cwd: directory, stdio: 'inherit' });
  const exportName = variant === 'vue' ? 'useValixa' : 'useVuetifyField';
  writeFileSync(join(directory, 'tree.mjs'), `export {${exportName}} from './node_modules/@valixa/${variant}/dist/index.js';`);
  const bundle = await rollup({ input: join(directory, 'tree.mjs'), external: ['vue', '@valixa/core', '@valixa/vue'] });
  const { output } = await bundle.generate({ format: 'es' }); await bundle.close();
  assert(output[0].code.includes(exportName));
  assert(!output[0].code.includes(variant === 'vue' ? 'No Valixa form was provided' : 'VFileInput must emit'));
  console.log(`Packaged ${variant} declarations/peer isolation/tree-shaking passed (${directory})`);
}
