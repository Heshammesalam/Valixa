import { verifyProductionConsumer } from './release-browser-consumer.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url)), require = createRequire(import.meta.url), pnpm = process.env.npm_execpath;
assert(pnpm?.includes('pnpm'), 'Run through pnpm test:packages:phase6');
const run = (args, cwd = root) => execFileSync(process.execPath, [pnpm, ...args], { cwd, stdio: 'inherit' });
const version = name => JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8')).version;
const artifacts = join(root, 'artifacts/packages'); mkdirSync(artifacts, { recursive: true });
const tarballs = {};
for (const name of ['core', 'auto', 'devtools', 'react', 'mui', 'vue', 'vuetify', 'angular', 'angular-material', 'angular-auto', 'angular-devtools']) {
  const directory = join(root, 'packages', name, ...(name.startsWith('angular') ? ['dist'] : []));
  run(['--dir', directory, 'pack', '--pack-destination', artifacts]);
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  tarballs[`@valixa/${name}`] = `file:${join(artifacts, `valixa-${name}-${manifest.version}.tgz`).replaceAll('\\', '/')}`;
}
const common = `import {blueprint,createValixa} from '@valixa/core'; import {defineAutoForm,createRenderingPlan} from '@valixa/auto'; import {attachValixaDevtools} from '@valixa/devtools';
const schema=blueprint({email:['','required | email'],seats:[1]}); const ui=defineAutoForm(schema,{fields:{email:{component:'email',label:'Email'},seats:{component:'number',label:'Seats',emptyValue:0}},submitLabel:'Save'});`;
for (const variant of ['headless', 'react', 'vue', 'angular']) {
  const selected = ['core', 'auto', 'devtools', ...(variant === 'react' ? ['react', 'mui'] : variant === 'vue' ? ['vue', 'vuetify'] : variant === 'angular' ? ['angular', 'angular-material', 'angular-auto', 'angular-devtools'] : [])].map(name => `@valixa/${name}`);
  // Canonicalize Windows 8.3 TEMP aliases before bundling to avoid duplicate module identities.
  const directory = realpathSync.native(mkdtempSync(join(tmpdir(), `valixa-phase6-${variant}-`)));
  const dependencies = Object.fromEntries(selected.map(name => [name, tarballs[name]]));
  const peers = variant === 'react' ? ['react', 'react-dom', '@types/react', '@types/react-dom', '@mui/material', '@emotion/react', '@emotion/styled'] : variant === 'vue' ? ['vue', 'vuetify', '@vue/server-renderer'] : variant === 'angular' ? ['@angular/core', '@angular/common', '@angular/forms', '@angular/compiler', '@angular/platform-browser', '@angular/platform-server', '@angular/material', '@angular/cdk', '@angular/build', '@angular/cli', '@angular/compiler-cli', 'rxjs', 'tslib', 'typescript'] : [];
  for (const peer of peers) dependencies[peer] = version(peer);
  if (variant === 'react' || variant === 'vue') { const viteRequire = createRequire(join(root,'examples/react/package.json')); dependencies.vite = JSON.parse(readFileSync(viteRequire.resolve('vite/package.json'),'utf8')).version; }
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies, pnpm: { overrides: { ...JSON.parse(readFileSync(join(root,'package.json'),'utf8')).pnpm.overrides, ...Object.fromEntries(selected.map(name => [name, tarballs[name]])) } } }, null, 2));
  writeFileSync(join(directory, '.npmrc'), 'auto-install-peers=false\n');
  run(['install', '--ignore-workspace', '--prefer-offline', '--ignore-scripts', '--lockfile=false'], directory);
  const consumer = createRequire(join(directory, 'package.json'));
  for (const framework of ['react', 'vue', '@angular/core']) if (!(variant === 'react' && framework === 'react') && !(variant === 'vue' && framework === 'vue') && !(variant === 'angular' && framework === '@angular/core')) assert.throws(() => consumer.resolve(framework));
  for (const name of selected) { const manifest = JSON.parse(readFileSync(join(directory, 'node_modules', name, 'package.json'), 'utf8')); assert.equal(manifest.sideEffects, false); assert(!JSON.stringify(manifest).includes('workspace:')); for (const entry of Object.values(manifest.exports)) if (typeof entry === 'object') for (const file of [entry.types, entry.import ?? entry.default].filter(Boolean)) assert(existsSync(join(directory, 'node_modules', name, file)), `${name}: ${file}`); }
  let types = `${common}
const form=createValixa(schema); const inspection=attachValixaDevtools(form); const value:string=form.state.values.email;
// @ts-expect-error unknown path
defineAutoForm(schema,{fields:{missing:{component:'text',label:'Missing'}}});
// @ts-expect-error incompatible widget value type
defineAutoForm(schema,{fields:{email:{component:'checkbox',label:'Email'}}});
inspection.detach();`;
  if (variant === 'react') types += `import {createElement} from 'react'; import {ValixaAutoForm,defineReactAutoRenderer} from '@valixa/react/auto'; import {muiAdapter} from '@valixa/mui/auto'; import {ValixaDevtools} from '@valixa/react/devtools'; const element=createElement(ValixaAutoForm<typeof schema.__values>,{form,ui,adapter:muiAdapter,onSubmit:values=>values.email}); const tools=createElement(ValixaDevtools,{inspections:[inspection]}); defineReactAutoRenderer<number>(({field})=>createElement('span',null,field.state.value.toFixed()));`;
  if (variant === 'vue') types += `import {h} from 'vue'; import {ValixaAutoForm,defineVueAutoRenderer} from '@valixa/vue/auto'; import {vuetifyAdapter} from '@valixa/vuetify/auto'; import {ValixaDevtools} from '@valixa/vue/devtools'; h(ValixaAutoForm,{form,ui,adapter:vuetifyAdapter,onSubmit:()=>{}}); h(ValixaDevtools,{inspections:[inspection]}); defineVueAutoRenderer<number>(({field})=>h('span',field.state.value.value.toFixed()));`;
  writeFileSync(join(directory, 'consumer.ts'), types);
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--strict', '--noEmit', '--skipLibCheck', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', 'consumer.ts'], { cwd: directory, stdio: 'inherit' });
  let smoke = `${common} import assert from 'node:assert/strict'; const form=createValixa(schema); const inspection=attachValixaDevtools(form); form.setValue('email','private@example.com'); assert(!JSON.stringify(inspection).includes('private@example.com')); assert.equal((await form.submit(v=>v.email)).status,'success'); inspection.detach(); assert.equal(inspection.getSnapshot().events.length,0);`;
  if (variant === 'headless') smoke += `await import('@valixa/devtools/panel'); assert.equal(typeof globalThis.document,'undefined'); createRenderingPlan(form,ui,{name:'test',widgets:['email','number']}); form.dispose();`;
  if (variant === 'react') smoke += `import {createElement} from 'react'; import {renderToString} from 'react-dom/server'; import {ValixaAutoForm} from '@valixa/react/auto'; import {muiAdapter} from '@valixa/mui/auto'; import {ValixaDevtools} from '@valixa/react/devtools'; assert.match(renderToString(createElement(ValixaAutoForm,{form,ui,adapter:muiAdapter,onSubmit:()=>{}})),/Email/); assert.match(renderToString(createElement(ValixaDevtools,{inspections:[]})),/div/); form.dispose();`;
  if (variant === 'vue') {
    writeFileSync(join(directory, 'styles.mjs'), `export async function load(url,context,next){if(/\\.(css|sass|scss)$/.test(new URL(url).pathname))return {format:'module',source:'export {};',shortCircuit:true};return next(url,context);}`);
    writeFileSync(join(directory, 'register.mjs'), `import {register} from 'node:module'; register(new URL('./styles.mjs',import.meta.url));`);
    smoke += `import {h,createSSRApp} from 'vue'; import {renderToString} from '@vue/server-renderer'; import {createVuetify} from 'vuetify'; import {ValixaAutoForm} from '@valixa/vue/auto'; import {vuetifyAdapter} from '@valixa/vuetify/auto'; import {ValixaDevtools} from '@valixa/vue/devtools'; const app=createSSRApp({render:()=>[h(ValixaAutoForm,{form,ui,adapter:vuetifyAdapter,onSubmit:()=>{}}),h(ValixaDevtools,{inspections:[]})]}); app.use(createVuetify({ssr:true})); assert.match(await renderToString(app),/Email/); form.dispose();`;
  }
  if (variant !== 'angular') { writeFileSync(join(directory, 'smoke.mjs'), smoke); execFileSync(process.execPath, [...(variant === 'vue' ? ['--import', './register.mjs'] : []), 'smoke.mjs'], { cwd: directory, stdio: 'inherit' }); }
  if (variant === 'react' || variant === 'vue') {
    const react = variant === 'react', entry = react ? 'main.tsx' : 'main.ts';
    const source = react ? `${common} import {createElement,useState} from 'react'; import {createRoot} from 'react-dom/client'; import {ValixaAutoForm} from '@valixa/react/auto'; import {muiAdapter} from '@valixa/mui/auto'; import {ValixaDevtools} from '@valixa/react/devtools'; const form=createValixa(schema),inspection=attachValixaDevtools(form); function App(){const [result,setResult]=useState('');return <><ValixaAutoForm form={form} ui={ui} adapter={muiAdapter} onSubmit={async values=>{await Promise.resolve();setResult('Saved '+values.email);}}/><output>{result}</output><ValixaDevtools inspections={[inspection]}/></>;} createRoot(document.getElementById('app')!).render(<App/>);`
      : `${common} import {createApp,h,ref} from 'vue'; import {createVuetify} from 'vuetify'; import 'vuetify/styles'; import {ValixaAutoForm} from '@valixa/vue/auto'; import {vuetifyAdapter} from '@valixa/vuetify/auto'; import {ValixaDevtools} from '@valixa/vue/devtools'; const form=createValixa(schema),inspection=attachValixaDevtools(form),result=ref(''); createApp({setup:()=>()=>[h(ValixaAutoForm,{form,ui,adapter:vuetifyAdapter,onSubmit:async (values:typeof schema.__values)=>{await Promise.resolve();result.value='Saved '+values.email;}}),h('output',result.value),h(ValixaDevtools,{inspections:[inspection]})]}).use(createVuetify()).mount('#app');`;
    writeFileSync(join(directory,entry),source); writeFileSync(join(directory,'index.html'),`<!doctype html><html><body><div id="app"></div><script type="module" src="/${entry}"></script></body></html>`);
    writeFileSync(join(directory,'vite.config.mjs'),`export default {esbuild:{jsx:'automatic'},build:{outDir:'dist'}};`);
    execFileSync(process.execPath,[resolve(consumer.resolve('vite/package.json'),'../bin/vite.js'),'build'],{cwd:directory,stdio:'inherit'});
    await verifyProductionConsumer(directory);
  }
  if (variant === 'angular') {
    writeFileSync(join(directory, 'ssr.mjs'), `import '@angular/compiler'; import assert from 'node:assert/strict'; import {Component,DestroyRef,inject,provideZonelessChangeDetection} from '@angular/core'; import {bootstrapApplication} from '@angular/platform-browser'; import {renderApplication,provideServerRendering} from '@angular/platform-server'; import {blueprint} from '@valixa/core'; import {createValixa} from '@valixa/angular'; import {defineAutoForm} from '@valixa/auto'; import {attachValixaDevtools} from '@valixa/devtools'; import {ValixaAutoForm} from '@valixa/angular-auto'; import {ValixaDevtools} from '@valixa/angular-devtools';
    const schema=blueprint({email:['ssr@example.com','email']}); class Ssr {form=createValixa(schema);ui=defineAutoForm(schema,{fields:{email:{component:'email',label:'Email'}}});inspection=attachValixaDevtools(this.form.core);save=()=>{};constructor(){inject(DestroyRef).onDestroy(()=>this.inspection.detach());}}
    Component({selector:'consumer-root',standalone:true,imports:[ValixaAutoForm,ValixaDevtools],template:'<valixa-auto-form [form]="form" [ui]="ui" [onSubmit]="save"/><valixa-devtools [inspections]="[inspection]"/>'})(Ssr);
    const html=await renderApplication(context=>bootstrapApplication(Ssr,{providers:[provideZonelessChangeDetection(),provideServerRendering()]},context),{document:'<html><head></head><body><consumer-root></consumer-root></body></html>',url:'http://localhost/',allowedHosts:['localhost']});assert.match(html,/ssr@example.com/);assert(!html.includes('Lifecycle event timeline'));`);
    execFileSync(process.execPath, ['ssr.mjs'], { cwd: directory, stdio: 'inherit' });
    mkdirSync(join(directory, 'src'));
    writeFileSync(join(directory, 'src/main.ts'), `import {Component,signal,provideZonelessChangeDetection,DestroyRef,inject} from '@angular/core'; import {bootstrapApplication} from '@angular/platform-browser'; import {createValixa} from '@valixa/angular'; import {blueprint} from '@valixa/core'; import {defineAutoForm} from '@valixa/auto'; import {attachValixaDevtools} from '@valixa/devtools'; import {ValixaAutoForm,ValixaAutoRenderer} from '@valixa/angular-auto'; import {ValixaDevtools} from '@valixa/angular-devtools';
    const schema=blueprint({email:['','required | email'],seats:[1]});
    @Component({selector:'consumer-root',standalone:true,imports:[ValixaAutoForm,ValixaAutoRenderer,ValixaDevtools],template:${JSON.stringify(`<valixa-auto-form [form]="form" [ui]="ui" [onSubmit]="save"><ng-template valixaAutoRenderer="counter" [autoField]="form.field('seats')" let-field><button type="button" (click)="field.setValue(field.value()+1)">Add seat</button></ng-template></valixa-auto-form><output>{{message()}}</output><valixa-devtools [inspections]="[inspection]"/>`)}})
    class App {form=createValixa(schema);ui=defineAutoForm(schema,{fields:{email:{component:'email',label:'Email'},seats:{component:'custom',label:'Seats',renderer:'counter'}},submitLabel:'Save'});inspection=attachValixaDevtools(this.form.core);message=signal('');save=async (values:typeof schema.__values)=>{this.message.set('Saved '+values.email+' seats '+values.seats);};constructor(){inject(DestroyRef).onDestroy(()=>this.inspection.detach());}}
    bootstrapApplication(App,{providers:[provideZonelessChangeDetection()]});`);
    writeFileSync(join(directory, 'src/index.html'), '<!doctype html><html><head><base href="/"></head><body><consumer-root></consumer-root></body></html>');
    writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ES2022', moduleResolution: 'bundler', experimentalDecorators: true, useDefineForClassFields: false, strict: true, exactOptionalPropertyTypes: true, skipLibCheck: true, lib: ['ES2022', 'DOM'], types: [], outDir: 'out-tsc' }, angularCompilerOptions: { strictTemplates: true, strictInjectionParameters: true }, files: ['src/main.ts'] }));
    writeFileSync(join(directory, 'angular.json'), JSON.stringify({ version: 1, cli: { analytics: false }, projects: { consumer: { projectType: 'application', root: '', sourceRoot: 'src', architect: { build: { builder: '@angular/build:application', options: { browser: 'src/main.ts', index: 'src/index.html', tsConfig: 'tsconfig.json', outputPath: 'dist', optimization: true, styles: ['node_modules/@angular/material/prebuilt-themes/azure-blue.css'] } } } } } }));
    execFileSync(process.execPath, [resolve(consumer.resolve('@angular/cli/package.json'), '../bin/ng.js'), 'build', '--progress=false'], { cwd: directory, stdio: 'inherit', env: { ...process.env, NG_BUILD_MAX_WORKERS: '2', NG_CLI_ANALYTICS: 'false' } });
    const webRoot = resolve(directory, 'dist/browser');
    const server = createServer(async (req, res) => { const path = resolve(webRoot, `.${new URL(req.url, 'http://localhost').pathname}`); if (!path.startsWith(webRoot + sep) && path !== webRoot) { res.writeHead(403).end(); return; } try { const file = extname(path) ? path : join(webRoot, 'index.html'); const content = await readFile(file); res.writeHead(200, { 'Content-Type': extname(file) === '.js' ? 'text/javascript' : extname(file) === '.css' ? 'text/css' : 'text/html' }).end(content); } catch { res.writeHead(404).end(); } });
    await new Promise(done => server.listen(0, '127.0.0.1', done)); let browser;
    try { browser = await chromium.launch({ channel: 'chromium' }); const page = await browser.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message)); await page.goto(`http://127.0.0.1:${server.address().port}`); await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.getByRole('alert', { name: 'Form errors' }).waitFor(); await page.getByRole('textbox', { name: 'Email' }).fill('user@example.com'); await page.getByRole('button', { name: 'Add seat' }).click(); await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.getByText('Saved user@example.com seats 2', { exact: true }).waitFor(); assert(!(await page.getByRole('region', { name: 'Valixa DevTools' }).textContent()).includes('user@example.com')); assert.deepEqual(errors, []); } finally { await browser?.close(); await new Promise(done => server.close(done)); }
  }
  console.log(`Phase 6 independent ${variant} consumer passed: ${directory}`);
}
