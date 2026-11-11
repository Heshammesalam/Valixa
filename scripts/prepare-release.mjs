import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, config, packages } from './release-lib.mjs';

const args = process.argv.slice(2), repositoryAt = args.indexOf('--repository'), versionAt = args.indexOf('--version');
if (repositoryAt >= 0) {
  const repository = args[repositoryAt + 1]?.replace(/\.git$/, '').replace(/\/$/, '');
  assert(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? ''), 'Provide a real GitHub repository URL');
  config.repository = repository;
}
if (versionAt >= 0) { const version = args[versionAt + 1]; assert(/^1\.0\.0(?:-rc\.[1-9]\d*)?$/.test(version ?? ''), 'First release must be 1.0.0 or 1.0.0-rc.N'); config.version = version; config.tag = version.includes('-') ? 'next' : 'latest'; }
const descriptions = { 'angular-auto': 'Optional Angular Signals and Material Auto Forms for Valixa', 'angular-devtools': 'Optional Angular lifecycle binding for local Valixa DevTools' };
const names = new Set(packages.map(item => item.manifest.name));
for (const item of packages) {
  const manifest = item.manifest;
  manifest.version = config.version; manifest.description ??= descriptions[item.folder];
  manifest.keywords = ['forms', 'validation', 'typescript', 'headless', 'valixa', ...(['react', 'vue', 'angular'].filter(name => item.folder.includes(name)))];
  if (config.repository) {
    manifest.repository = { type: 'git', url: `${config.repository}.git`, directory: `packages/${item.folder}` };
    manifest.homepage = `${config.repository}#readme`; manifest.bugs = { url: `${config.repository}/issues` };
  }
  manifest.engines ??= { node: '>=20.19.0' };
  manifest.publishConfig = { access: 'public', registry: config.registry, tag: config.tag };
  if (item.folder.startsWith('angular')) {
    manifest.types = `./dist/types/valixa-${item.folder}.d.ts`;
    manifest.files = ['dist', 'README.md', 'LICENSE'];
  }
  for (const name of Object.keys(manifest.peerDependencies ?? {})) if (names.has(name)) manifest.peerDependencies[name] = `^${config.version}`;
  writeFileSync(join(item.directory, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
}
writeFileSync(join(root, 'release/config.json'), JSON.stringify(config, null, 2) + '\n');
const changesets = JSON.parse(readFileSync(join(root, '.changeset/config.json'), 'utf8'));
changesets.fixed = [[...names].sort()]; writeFileSync(join(root, '.changeset/config.json'), JSON.stringify(changesets, null, 2) + '\n');
console.log(`Prepared ${packages.length} packages at ${config.version}; no publication performed.`);
if (!config.repository) console.log('BLOCKER: repository identity still required; candidate metadata is intentionally incomplete.');
