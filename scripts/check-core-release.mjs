import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { root, packages } from './release-lib.mjs';
const pnpm = process.env.npm_execpath, require = createRequire(import.meta.url), item = packages.find(item => item.folder === 'core');
assert(pnpm?.includes('pnpm')); const file = join(root, 'artifacts/packages', `${item.manifest.name}-${item.manifest.version}.tgz`).replaceAll('\\', '/');
const directory = mkdtempSync(join(tmpdir(), 'valixa-core-release-'));
writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { 'valixa': `file:${file}` } }));
writeFileSync(join(directory, '.npmrc'), 'auto-install-peers=false\n');
execFileSync(process.execPath, [pnpm, 'install', '--ignore-workspace', '--prefer-offline', '--ignore-scripts', '--lockfile=false'], { cwd: directory, stdio: 'inherit' });
const consumer = createRequire(join(directory, 'package.json'));
for (const dependency of ['react', 'vue', '@angular/core', 'valixa-auto', 'valixa-devtools']) assert.throws(() => consumer.resolve(dependency));
writeFileSync(join(directory, 'smoke.mjs'), `import assert from 'node:assert/strict'; import {blueprint,createValixa,nested,collection} from 'valixa';
const schema=blueprint({user:nested({email:['','required | email']}),rows:collection({city:['','required']})});const form=createValixa(schema,{locale:'ar'});
assert.equal((await form.validate()).valid,false);assert(form.state.errors['user.email'][0]);form.setValue('user.email','user@example.com');form.array('rows').append({city:'Cairo'});const key=form.array('rows').items[0].key;
const result=await form.submit(async values=>{await Promise.resolve();return values.rows[0].city;});assert.deepEqual(result,{status:'success',data:'Cairo'});assert.equal(form.array('rows').items[0].key,key);form.setError('user.email','Server rejection');assert.equal(form.state.errors['user.email'][0],'Server rejection');form.dispose();`);
execFileSync(process.execPath, ['smoke.mjs'], { cwd: directory, stdio: 'inherit' });
writeFileSync(join(directory, 'consumer.ts'), `import {blueprint,createValixa,nested,collection} from 'valixa';const schema=blueprint({user:nested({email:['']}),rows:collection({city:['']})});const form=createValixa(schema);const email:string=form.state.values.user.email;form.array('rows').append({city:'Cairo'});
// @ts-expect-error nested field must exist
form.setValue('user.missing','value');
// @ts-expect-error domain value must retain type
form.setValue('user.email',123);`);
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--strict', '--noEmit', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', 'consumer.ts'], { cwd: directory, stdio: 'inherit' });
console.log(`Independent vanilla JavaScript + TypeScript core consumer passed: ${directory}`);
