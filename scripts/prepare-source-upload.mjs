import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './release-lib.mjs';
const ignored = new Set(['node_modules', 'dist', 'artifacts', 'test-results', 'playwright-report', '.angular', 'out-tsc', '.git', '.codex', '.agents', '.aws']);
const files = [], flagged = [];
function visit(path) {
  for (const entry of readdirSync(join(root, path), { withFileTypes: true })) {
    if (ignored.has(entry.name) || /^\.env|^\.npmrc$|\.(tgz|pem|key)$/.test(entry.name)) continue;
    const child = path ? `${path}/${entry.name}` : entry.name;
    if (entry.isDirectory()) visit(child);
    else if (entry.isFile()) {
      const content = readFileSync(join(root, child), 'utf8');
      if (/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|npm_[A-Za-z0-9]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}/.test(content)) flagged.push(child);
      files.push({ path: child, mode: '100644', type: 'blob', content });
    }
  }
}
visit(''); assert.deepEqual(flagged, [], 'Credential-shaped source content must be reviewed before upload');
writeFileSync(join(root, 'artifacts/phase-7-source-tree.json'), JSON.stringify(files));
console.log(JSON.stringify({ files: files.length, bytes: files.reduce((sum, file) => sum + Buffer.byteLength(file.content), 0), flagged }));
