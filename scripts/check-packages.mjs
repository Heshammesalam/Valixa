import { packageName } from './release-lib.mjs';
import assert from 'node:assert/strict';
import { attachAdvancedTypes, verifyAdvancedConsumer } from './advanced-consumer.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const pnpm = process.env.npm_execpath;
assert(pnpm?.includes('pnpm'), 'Run this check through pnpm test:packages');
function run(args, cwd = root) { execFileSync(process.execPath, [pnpm, ...args], { cwd, stdio: 'inherit' }); }
const artifacts = resolve(root, 'artifacts/packages');
mkdirSync(artifacts, { recursive: true });
const packages = ['core', 'react', 'mui'];
const tarballs = Object.fromEntries(packages.map(name => {
  const metadata = JSON.parse(readFileSync(join(root, `packages/${name}/package.json`), 'utf8'));
  run(['--filter', packageName(name), 'pack', '--pack-destination', artifacts]);
  return [packageName(name), `file:${join(artifacts, `${metadata.name}-${metadata.version}.tgz`).replaceAll('\\', '/')}`];
}));
function installedVersion(name) { return JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8')).version; }
const peerNames = ['react', 'react-dom', '@types/react', '@types/react-dom', '@mui/material', '@emotion/react', '@emotion/styled'];
const peers = Object.fromEntries(peerNames.map(name => [name, installedVersion(name)]));
const tsc = require.resolve('typescript/bin/tsc');

for (const variant of ['react', 'mui', 'mui-x']) {
  // Outside the workspace and all ancestor node_modules: dependencies cannot fall back to workspace aliases.
  const directory = mkdtempSync(join(tmpdir(), `valixa-${variant}-`));
  const selected = variant === 'react' ? ['valixa', 'valixa-react'] : Object.keys(tarballs);
  const dependencies = Object.fromEntries(selected.map(name => [name, tarballs[name]]));
  const selectedPeers = variant === 'react' ? Object.fromEntries(Object.entries(peers).filter(([name]) => !name.startsWith('@mui/') && !name.startsWith('@emotion/'))) : peers;
  if (variant === 'mui-x') {
    dependencies['@mui/x-date-pickers'] = installedVersion('@mui/x-date-pickers'); dependencies.dayjs = installedVersion('dayjs');
  }
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { ...dependencies, ...selectedPeers },
    pnpm: { overrides: { ...JSON.parse(readFileSync(join(root,'package.json'),'utf8')).pnpm.overrides, ...Object.fromEntries(selected.map(name => [name, tarballs[name]])) } } }, null, 2));
  writeFileSync(join(directory, '.npmrc'), 'auto-install-peers=false\n');
  run(['install', '--ignore-workspace', '--prefer-offline', '--ignore-scripts', '--lockfile=false'], directory);
  const consumerRequire = createRequire(join(directory, 'package.json'));
  if (variant === 'react') assert.throws(() => consumerRequire.resolve('@mui/material'), 'React package must work without MUI');
  if (variant !== 'mui-x') assert.throws(() => consumerRequire.resolve('@mui/x-date-pickers'), 'MUI X must remain optional');
  for (const name of selected) {
    const packageDirectory = join(directory, 'node_modules', ...name.split('/'));
    const manifest = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'));
    for (const specifier of Object.values(manifest.dependencies ?? {})) assert(!specifier.startsWith('workspace:'), 'Tarballs must rewrite workspace dependencies');
  }
  const muiImports = variant === 'react' ? '' : `import { TextField } from '@mui/material'; import { useMuiField } from 'valixa-mui';`;
  const muiBody = variant === 'react' ? `return createElement('input', {value: field.state.value, readOnly: true});`
    : `return createElement(TextField, {label: 'Email', ...useMuiField(owned, 'email').textField()});`;
  const xSmoke = variant === 'mui-x' ? `await import('valixa-mui/x');` : '';
  const xTypes = variant === 'mui-x' ? `
    import {useMuiDateField} from 'valixa-mui/x'; import type {DateCodec} from 'valixa-mui/x';
    import {DatePicker} from '@mui/x-date-pickers/DatePicker';
    import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
    import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
    import dayjs from 'dayjs';
    export function DateExample() {
      const form = useValixa({date: {initial: null as string | null}});
      const codec: DateCodec<string | null> = {decode: value => value ? dayjs(value) : null,
        encode: (value, context) => context.validationError ? 'invalid' : value?.format('YYYY-MM-DD') ?? null};
      return <LocalizationProvider dateAdapter={AdapterDayjs}><DatePicker {...useMuiDateField(form, 'date', codec)} /></LocalizationProvider>;
    }
  ` : '';
  writeFileSync(join(directory, 'smoke.mjs'), `
    import assert from 'node:assert/strict';
    import {createElement} from 'react'; import {renderToString} from 'react-dom/server';
    import {createValixa} from 'valixa';
    import {useValixa, useValixaField} from 'valixa-react';
    ${muiImports}
    const form = createValixa({email: ['', 'required | email']});
    assert.equal((await form.validate()).valid, false);
    form.setValue('email', 'user@example.com');
    assert.equal((await form.submit(data => data.email)).status, 'success');
    function App() { const owned = useValixa({email: ['user@example.com', 'email']}); const field = useValixaField(owned, 'email'); ${muiBody} }
    assert.match(renderToString(createElement(App)), /user@example.com/);
    ${xSmoke}
    console.log('Packaged ${variant} runtime passed');
  `);
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: directory, stdio: 'inherit' });
  verifyAdvancedConsumer(directory);
  writeFileSync(join(directory, 'consumer.tsx'), `
    import {useValixa, useValixaField} from 'valixa-react';
    ${muiImports}
    ${xTypes}
    export function App() {
      const form = useValixa({email: ['', 'email'], count: [0]});
      const field = useValixaField(form, 'email'); const email: string = field.state.value;
      // @ts-expect-error invalid field name
      useValixaField(form, 'missing');
      // @ts-expect-error invalid field value
      form.setValue('count', 'wrong');
      ${variant === 'react' ? 'return <input value={email} readOnly />;' : 'return <TextField {...useMuiField(form, "email").textField()} />;'}
    }
  `);
  attachAdvancedTypes(directory, 'consumer.tsx', `export function AdvancedConsumption(){const field=useValixaField(advancedForm,'user.age');const value:number=field.state.value;${variant === 'react' ? '' : "useMuiField(advancedForm,'user.age').numberField({emptyValue:0});"}return null;}`);
  execFileSync(process.execPath, [tsc, '--strict', '--exactOptionalPropertyTypes', '--skipLibCheck', '--noEmit', '--jsx', 'react-jsx', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', 'consumer.tsx'], { cwd: directory, stdio: 'inherit' });
  console.log(`Packaged ${variant} declarations passed (${directory})`);
}
