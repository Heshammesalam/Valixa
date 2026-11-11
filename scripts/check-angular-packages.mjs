import assert from 'node:assert/strict';
import { attachAdvancedTypes, verifyAdvancedConsumer } from './advanced-consumer.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url)); const require = createRequire(import.meta.url), pnpm = process.env.npm_execpath;
assert(pnpm?.includes('pnpm'), 'Run through pnpm test:packages:angular');
const run = (args, cwd = root) => execFileSync(process.execPath, [pnpm, ...args], { cwd, stdio: 'inherit' });
const artifacts = resolve(root, 'artifacts/packages'); mkdirSync(artifacts, { recursive: true });
const version = name => JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8')).version;
const tarballs = {};
for (const name of ['core', 'angular', 'angular-material']) {
  const directory = name === 'core' ? join(root, 'packages/core') : join(root, `packages/${name}/dist`);
  // Angular packages are packed from ng-packagr output, never the workspace source manifest.
  run(['--dir', directory, 'pack', '--pack-destination', artifacts]);
  const metadata = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  tarballs[`@valixa/${name}`] = `file:${join(artifacts, `valixa-${name}-${metadata.version}.tgz`).replaceAll('\\', '/')}`;
}

for (const material of [false, true]) {
  const variant = material ? 'angular-material' : 'angular';
  const directory = mkdtempSync(join(tmpdir(), `valixa-${variant}-`));
  const selected = material ? Object.keys(tarballs) : ['@valixa/core', '@valixa/angular'];
  const dependencies = Object.fromEntries(selected.map(name => [name, tarballs[name]]));
  for (const name of ['@angular/core', '@angular/common', '@angular/forms', '@angular/compiler', '@angular/platform-browser', '@angular/platform-server', 'rxjs', 'tslib']) dependencies[name] = version(name);
  if (material) for (const name of ['@angular/material', '@angular/cdk']) dependencies[name] = version(name);
  const devDependencies = Object.fromEntries(['@angular/build', '@angular/cli', '@angular/compiler-cli', 'typescript'].map(name => [name, version(name)]));
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies, devDependencies,
    pnpm: { overrides: Object.fromEntries(selected.map(name => [name, tarballs[name]])) } }, null, 2));
  writeFileSync(join(directory, '.npmrc'), 'auto-install-peers=false\n');
  run(['install', '--ignore-workspace', '--offline', '--ignore-scripts', '--lockfile=false'], directory);
  const consumerRequire = createRequire(join(directory, 'package.json'));
  if (!material) assert.throws(() => consumerRequire.resolve('@angular/material'));
  for (const name of ['react', 'vue']) assert.throws(() => consumerRequire.resolve(name));
  for (const name of selected.filter(name => name !== '@valixa/core')) {
    const packageRoot = join(directory, 'node_modules', ...name.split('/'));
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
    assert.equal(manifest.type, 'module'); assert.equal(manifest.sideEffects, false); assert(!manifest.scripts);
    const entry = manifest.exports['.']; const code = readFileSync(join(packageRoot, entry.default), 'utf8');
    assert(code.includes('ɵɵngDeclareDirective')); assert(code.includes("from '@angular/core'"));
    for (const path of [entry.default, `${entry.default}.map`, entry.types, `${entry.types}.map`, 'README.md', 'LICENSE']) assert(existsSync(join(packageRoot, path)), path);
    assert(readFileSync(join(packageRoot, entry.types), 'utf8').includes('ɵɵDirectiveDeclaration'));
    assert(!JSON.stringify(manifest).includes('workspace:'));
  }
  const imports = material ? `import {MatInputModule} from '@angular/material/input'; import {MatFormFieldModule} from '@angular/material/form-field'; import {VALIXA_MATERIAL,dateOnlyCodec} from '@valixa/angular-material';` : '';
  const template = material ? `<form novalidate (submit)="onSubmit($event)"><mat-form-field><mat-label>Email</mat-label><input matInput [valixaField]="email"><mat-error>{{email.error()}}</mat-error></mat-form-field><button>Save</button><output>{{message()}}</output></form>`
    : `<form novalidate (submit)="onSubmit($event)"><label [for]="email.id">Email</label><input [valixaField]="email"><p>{{email.error()}}</p><button>Save</button><output>{{message()}}</output></form>`;
  const componentImports = material ? '[...VALIXA_MATERIAL,MatInputModule,MatFormFieldModule]' : '[ValixaFieldDirective]';
  writeFileSync(join(directory, 'smoke.mjs'), `
    import '@angular/compiler'; import assert from 'node:assert/strict';
    import {Component,provideZonelessChangeDetection} from '@angular/core'; import {bootstrapApplication} from '@angular/platform-browser';
    import {renderApplication,provideServerRendering} from '@angular/platform-server';
    import {createValixa,ValixaFieldDirective} from '@valixa/angular'; ${imports}
    let cleanup; const form = createValixa({email:['','required | email']},{id:'js',destroyRef:{onDestroy:fn=>{cleanup=fn;return()=>{};},destroyed:false}});
    assert.equal((await form.validate()).valid,false);form.setValue('email','user@example.com');assert.equal((await form.submit(data=>data.email)).status,'success');cleanup();
    class SsrApp {form=createValixa({email:['user@example.com','email']},{id:'ssr-consumer'});email=this.form.field('email');}
    Component({selector:'consumer-root',standalone:true,imports:${componentImports},template:'<input ${material ? 'matInput' : ''} [valixaField]="email">'})(SsrApp);
    const html=await renderApplication(context=>bootstrapApplication(SsrApp,{providers:[provideServerRendering(),provideZonelessChangeDetection()]},context),{document:'<html><head></head><body><consumer-root></consumer-root></body></html>',url:'http://localhost/',allowedHosts:['localhost']});
    assert.match(html,/user@example.com/); console.log('Packaged ${variant} JavaScript and SSR passed');
  `);
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: directory, stdio: 'inherit' });
  verifyAdvancedConsumer(directory);
  mkdirSync(join(directory, 'src'));
  const source = `import {Component,signal,provideZonelessChangeDetection} from '@angular/core'; import {bootstrapApplication} from '@angular/platform-browser';
    import {createValixa,ValixaFieldDirective} from '@valixa/angular'; ${imports}
    @Component({selector:'consumer-root',standalone:true,imports:${componentImports},template:${JSON.stringify(template)}})
    class App {form=createValixa({email:['','required | email'],age:[18]},{id:'consumer'});email=this.form.field('email');message=signal('');
      submit=this.form.handleSubmit(async data=>{this.message.set('Saved '+data.email);});onSubmit(event:Event){void this.submit(event).catch(()=>this.message.set('Failed'));}}
    bootstrapApplication(App,{providers:[provideZonelessChangeDetection()]});`;
  writeFileSync(join(directory, 'src/main.ts'), source);
  writeFileSync(join(directory, 'src/index.html'), '<!doctype html><html lang="en"><head><base href="/"></head><body><consumer-root></consumer-root></body></html>');
  const config = { compilerOptions: { target: 'ES2022', module: 'ES2022', moduleResolution: 'bundler', experimentalDecorators: true, useDefineForClassFields: false,
    strict: true, exactOptionalPropertyTypes: true, skipLibCheck: true, lib: ['ES2022', 'DOM'], types: [], outDir: 'out-tsc' },
    angularCompilerOptions: { strictTemplates: true, strictInjectionParameters: true }, files: ['src/main.ts'] };
  writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify(config));
  writeFileSync(join(directory, 'angular.json'), JSON.stringify({ version: 1, cli: { analytics: false }, projects: { consumer: { projectType: 'application', root: '', sourceRoot: 'src', architect: {
    build: { builder: '@angular/build:application', options: { browser: 'src/main.ts', index: 'src/index.html', tsConfig: 'tsconfig.json', outputPath: 'dist', optimization: true,
      styles: material ? ['node_modules/@angular/material/prebuilt-themes/azure-blue.css'] : [] } }
  } } } }));
  const compilerManifest = consumerRequire.resolve('@angular/compiler-cli/package.json');
  const compilerBin = JSON.parse(readFileSync(compilerManifest, 'utf8')).bin.ngc;
  const ngc = resolve(compilerManifest, '..', compilerBin);
  attachAdvancedTypes(directory, 'src/main.ts', `import {bindValixa,numberCodec} from '@valixa/angular';
    @Component({standalone:true,imports:[ValixaFieldDirective],template:'<input [valixaField]="field" [valixaCodec]="codec">'})
    class AdvancedConsumption{form=bindValixa(advancedForm);field=this.form.field('user.age');codec=numberCodec(0);}`);
  execFileSync(process.execPath, [ngc, '-p', 'tsconfig.json', '--noEmit'], { cwd: directory, stdio: 'inherit' });
  writeFileSync(join(directory, 'src/bad.ts'), `import {Component} from '@angular/core';import {createValixa,ValixaFieldDirective} from '@valixa/angular';
    @Component({standalone:true,imports:[ValixaFieldDirective],template:${JSON.stringify('<input [valixaField]="form.field(\'missing\')">')}})
    class Bad {form=createValixa({email:['']},{id:'bad'});}`);
  writeFileSync(join(directory, 'tsconfig.bad.json'), JSON.stringify({ ...config, files: ['src/bad.ts'] }));
  let diagnostics = '';
  try { execFileSync(process.execPath, [ngc, '-p', 'tsconfig.bad.json', '--noEmit'], { cwd: directory, stdio: 'pipe' }); }
  catch (error) { diagnostics = String(error.stderr) + String(error.stdout); }
  assert(diagnostics.includes('missing') && diagnostics.includes('not assignable'), 'Strict Angular templates must reject unknown fields');
  if (material) {
    writeFileSync(join(directory, 'src/bad.ts'), `import {Component} from '@angular/core';import {createValixa} from '@valixa/angular';${imports}
      @Component({standalone:true,imports:${componentImports},template:${JSON.stringify('<input matInput [valixaField]="form.field(\'age\')" [valixaCodec]="codec">')}})
      class Bad {form=createValixa({age:[18]},{id:'bad-codec'});codec=dateOnlyCodec;}`);
    let diagnostics = '';
    try { execFileSync(process.execPath, [ngc, '-p', 'tsconfig.bad.json', '--noEmit'], { cwd: directory, stdio: 'pipe' }); }
    catch (error) { diagnostics = String(error.stderr) + String(error.stdout); }
    assert(diagnostics.includes('not assignable') && (diagnostics.includes('AngularField') || diagnostics.includes('ValueCodec')), 'Templates must reject incompatible codecs');
  }
  const cliRoot = join(consumerRequire.resolve('@angular/cli/package.json'), '..');
  execFileSync(process.execPath, [resolve(cliRoot, 'bin/ng.js'), 'build', '--progress=false'], { cwd: directory, stdio: 'inherit', env: { ...process.env, NG_BUILD_MAX_WORKERS: '2', NG_CLI_ANALYTICS: 'false' } });
  const webRoot = resolve(directory, 'dist/browser');
  const server = createServer(async (req, res) => {
    const path = resolve(webRoot, `.${new URL(req.url, 'http://localhost').pathname}`);
    if (!path.startsWith(webRoot + sep) && path !== webRoot) { res.writeHead(403).end(); return; }
    try { const file = extname(path) ? path : join(webRoot, 'index.html'); const content = await readFile(file);
      res.writeHead(200, { 'Content-Type': extname(file) === '.js' ? 'text/javascript' : extname(file) === '.css' ? 'text/css' : 'text/html' }).end(content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chromium' }); const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`); await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText('email is required.', { exact: true }).waitFor(); await page.getByRole('textbox', { name: 'Email' }).fill('user@example.com'); await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText('Saved user@example.com', { exact: true }).waitFor(); assert.deepEqual(errors, []);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
  console.log(`Packaged ${variant} strict templates, APF linking and production Chromium passed (${directory})`);
}
