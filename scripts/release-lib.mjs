import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const config = JSON.parse(readFileSync(join(root, 'release/config.json'), 'utf8'));
export const packages = readdirSync(join(root, 'packages'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
  const directory = join(root, 'packages', entry.name);
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  return { directory, folder: entry.name, manifest, packedDirectory: entry.name.startsWith('angular') ? join(directory, 'dist') : directory };
}).filter(item => !item.manifest.private);
export function publicationOrder() {
  const remaining = new Map(packages.map(item => [item.manifest.name, item])), result = [];
  while (remaining.size) {
    const ready = [...remaining.values()].filter(item => ![...Object.keys(item.manifest.dependencies ?? {}), ...Object.keys(item.manifest.peerDependencies ?? {})].some(name => remaining.has(name) && name !== item.manifest.name));
    if (!ready.length) throw new Error('Internal publication dependency cycle');
    for (const item of ready) { result.push(item); remaining.delete(item.manifest.name); }
  }
  return result;
}

export const packageName = folder => folder === 'core' ? 'valixa' : `valixa-${folder}`;

/** Preserve private build-tool overrides when a consumer lives outside the workspace. */
export function consumerOverrides() {
  const overrides = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).pnpm?.overrides ?? {};
  const fixtureRequire = createRequire(join(root, 'examples/react/package.json'));
  const viteRequire = createRequire(fixtureRequire.resolve('vite/package.json'));
  const rollup = JSON.parse(readFileSync(viteRequire.resolve('rollup/package.json'), 'utf8')).version;
  return { ...Object.fromEntries(Object.entries(overrides).map(([name, value]) => [name, typeof value === 'string' && value.startsWith('file:') ? `file:${resolve(root, value.slice(5)).replaceAll('\\', '/')}` : value])), rollup };
}
