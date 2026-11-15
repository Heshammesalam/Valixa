import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { root } from './release-lib.mjs';
const pnpm = process.env.npm_execpath;
assert(pnpm?.includes('pnpm'), 'Run through pnpm test:packages:standard');
const output = join(root, 'artifacts/development/pack'); mkdirSync(output, { recursive: true });
execFileSync(process.execPath, [pnpm, '--dir', join(root, 'packages/core'), 'pack', '--pack-destination', output], { stdio: 'pipe' });
const manifest = JSON.parse(readFileSync(join(root, 'packages/core/package.json')));
const directory = realpathSync.native(mkdtempSync(join(tmpdir(), 'valixa-standard-')));
const versions = Object.fromEntries(['zod', 'yup', 'valibot'].map(name => [name, JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'))).version]));
writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: {
  valixa: `file:${join(output, `valixa-${manifest.version}.tgz`).replaceAll('\\', '/')}`,
  zod: versions.zod, yup: versions.yup, valibot: versions.valibot
} }));
execFileSync(process.execPath, [pnpm, 'install', '--ignore-workspace', '--prefer-offline', '--ignore-scripts'], { cwd: directory, stdio: 'pipe' });
writeFileSync(join(directory, 'consumer.mjs'), `
import assert from 'node:assert/strict';
import * as z from 'zod'; import * as yup from 'yup'; import * as v from 'valibot';
import { blueprint, createValixa } from 'valixa';
import { standardFormValidator, parseStandard } from 'valixa/standard';
const definition = blueprint({ email: ['bad'] });
for (const schema of [z.object({ email: z.email() }), yup.object({ email: yup.string().email().required() }), v.object({ email: v.pipe(v.string(), v.email()) })]) {
  const form = createValixa(definition, { validateForm: standardFormValidator(schema, definition) });
  assert.equal((await form.validate()).valid, false);
  form.setValue('email', 'user@example.com'); assert.equal((await form.validate()).valid, true); form.dispose();
}
assert.equal(await parseStandard(z.string().transform(Number), '12'), 12);
`);
writeFileSync(join(directory, 'consumer.ts'), `
import * as z from 'zod';
import { blueprint } from 'valixa';
import { standardFormValidator, parseStandard } from 'valixa/standard';
const schema = z.string().transform(Number);
const output: number = await parseStandard(schema, '12');
// @ts-expect-error input must be string
await parseStandard(schema, 12);
// @ts-expect-error incompatible form input
standardFormValidator(z.object({ email: z.number() }), blueprint({ email: [''] }));
void output;
`);
execFileSync(process.execPath, ['consumer.mjs'], { cwd: directory, stdio: 'inherit' });
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'consumer.ts'], { cwd: directory, stdio: 'inherit' });
console.log(`Packed valixa/standard: real Zod/Yup/Valibot runtime and negative TypeScript consumer passed (${directory})`);
