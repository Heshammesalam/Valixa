import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { root, config, packages, publicationOrder } from './release-lib.mjs';
import { canonicalDeclaration } from './api-compatibility.mjs';

const candidate = process.argv.includes('--candidate'), blockers = [], errors = [], inventory = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
if (!config.repository) blockers.push('Verified public repository identity/homepage/bugs/trusted publisher configuration is missing');
const names = new Set(packages.map(item => item.manifest.name));
const baseline = JSON.parse(readFileSync(join(root, 'release/api-baseline.json'), 'utf8'));
for (const [path, hash] of Object.entries(baseline)) {
  const target = join(root, 'packages', path);
  check(existsSync(target) && createHash('sha256').update(canonicalDeclaration(readFileSync(target, 'utf8'))).digest('hex') === hash, `API declaration changed beyond approved module renames: ${path}`);
}
const artifacts = join(root, 'artifacts/release'); mkdirSync(artifacts, { recursive: true });
for (const item of publicationOrder()) {
  const manifest = JSON.parse(readFileSync(join(item.packedDirectory, 'package.json'), 'utf8'));
  for (const field of ['name', 'version', 'description', 'license', 'keywords', 'exports', 'types', 'files', 'engines', 'publishConfig']) check(Boolean(manifest[field]), `${item.folder}: missing ${field}`);
  check(manifest.version === config.version, `${manifest.name}: inconsistent release version`);
  check(manifest.license === 'MIT' && manifest.sideEffects === false && manifest.type === 'module', `${manifest.name}: package policy mismatch`);
  check(manifest.publishConfig?.access === 'public', `${manifest.name}: scoped public access required`);
  if (config.repository) for (const field of ['repository', 'homepage', 'bugs']) check(Boolean(manifest[field]), `${manifest.name}: missing ${field}`);

  for (const [name, range] of Object.entries({ ...manifest.dependencies, ...manifest.peerDependencies })) if (names.has(name) && !range.startsWith('workspace:')) check(range === `^${config.version}` || range === config.version, `${manifest.name}: incompatible internal range ${name}@${range}`);
  if (item.folder === 'core') check(!Object.keys(manifest.dependencies ?? {}).length && !Object.keys(manifest.peerDependencies ?? {}).length, 'core runtime must remain dependency-free');
  for (const [key, entry] of Object.entries(manifest.exports)) {
    if (typeof entry !== 'object') continue;
    for (const target of [entry.types, entry.import ?? entry.default].filter(Boolean)) check(existsSync(join(item.packedDirectory, target)), `${manifest.name}${key}: missing export ${target}`);
  }
  const npmCli = [join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),join(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js')].find(existsSync);
  const dry = JSON.parse(execFileSync(npmCli ? process.execPath : 'npm', [...(npmCli ? [npmCli] : []), 'pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: item.packedDirectory, encoding: 'utf8' }))[0];
  const files = dry.files.map(item => item.path);
  check(files.includes('LICENSE') && files.includes('README.md'), `${manifest.name}: missing package docs/license`);
  check(files.some(path => path.endsWith('.js.map') || path.endsWith('.mjs.map')) && files.some(path => path.endsWith('.d.ts')), `${manifest.name}: missing output/maps/declarations`);
  for (const path of files) {
    check(!/(?:^|\/)(?:tests?|artifacts|node_modules|\.git|\.env|\.npmrc)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$|\.tgz$/i.test(path), `${manifest.name}: forbidden packed file ${path}`);
    const content = readFileSync(join(item.packedDirectory, path), 'utf8');
    check(!/[A-Z]:[\\/](?:Users|gitHub)|\/home\/runner\/work\/|\/Users\//.test(content), `${manifest.name}: absolute local path in ${path}`);
    check(!/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|npm_[A-Za-z0-9]{30,}|gh[pousr]_[A-Za-z0-9]{30,}/.test(content), `${manifest.name}: credential-shaped content in ${path}`);
    if (path.endsWith('.map')) { const map = JSON.parse(content); check((map.sources ?? []).every(source => !/^(?:[A-Z]:|\/)/i.test(source)), `${manifest.name}: absolute map source`); }
  }
  const pnpm = process.env.npm_execpath; assert(pnpm?.includes('pnpm'), 'Run via pnpm release:check');
  execFileSync(process.execPath, [pnpm, '--dir', item.packedDirectory, 'pack', '--pack-destination', artifacts], { cwd: root, stdio: 'pipe' });
  const file = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`, bytes = readFileSync(join(artifacts, file));
  const packed = JSON.parse(execFileSync('tar', ['-xOf', join(artifacts,file), 'package/package.json'], {encoding:'utf8'}));
  check(!JSON.stringify({...packed.dependencies,...packed.peerDependencies,...packed.devDependencies}).match(/workspace:|file:|link:/), `${manifest.name}: unresolved local dependency in actual tarball`);
  for (const [name,range] of Object.entries({...packed.dependencies,...packed.peerDependencies})) if (names.has(name)) check(range === `^${config.version}` || range === config.version, `${manifest.name}: packed internal range ${name}@${range}`);
  const actual = execFileSync('tar', ['-tf', join(artifacts, file)], { encoding: 'utf8' }).trim().split(/\r?\n/).map(path => path.replace(/^package\//, '')).sort();
  check(JSON.stringify(actual) === JSON.stringify([...files].sort()), `${manifest.name}: dry-run and actual tarball contents differ`);
  inventory.push({ name: manifest.name, version: manifest.version, file, sha512: createHash('sha512').update(bytes).digest('hex'), bytes: bytes.length, files, metadata: packed });
}
for (const entry of readdirSync(join(root, 'examples'), { withFileTypes: true }).filter(entry => entry.isDirectory())) {
  const path = join(root, 'examples', entry.name, 'package.json'); if (existsSync(path)) check(JSON.parse(readFileSync(path)).private === true, `${entry.name}: example must be private`);
}
const report = { version: config.version, tag: config.tag, repository: config.repository, date: new Date().toISOString(), blockers, errors, packages: inventory };
writeFileSync(join(artifacts, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ packages: inventory.length, errors, blockers, manifest: relative(root, join(artifacts, 'manifest.json')) }, null, 2));
if (errors.length || (!candidate && blockers.length)) process.exitCode = 1;
