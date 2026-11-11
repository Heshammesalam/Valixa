import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const config = JSON.parse(readFileSync(join(root, 'release/config.json'), 'utf8'));
export const packages = readdirSync(join(root, 'packages'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
  const directory = join(root, 'packages', entry.name);
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  return { directory, folder: entry.name, manifest, packedDirectory: manifest.name.startsWith('@valixa/angular') ? join(directory, 'dist') : directory };
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
