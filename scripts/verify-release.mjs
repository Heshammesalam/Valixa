import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, config } from './release-lib.mjs';
const pnpm = process.env.npm_execpath; assert(pnpm?.includes('pnpm'), 'Run with pnpm release:verify');
const commands = ['check', 'examples:build', 'test:browser', 'test:browser:release', 'test:packages', 'release:check', 'benchmark', 'benchmark:compare', 'benchmark:phase6', 'audit:security'];
const directory = join(root, 'artifacts/release'); mkdirSync(directory, { recursive: true });
const report = { version: config.version, sourceSha: process.env.GITHUB_SHA ?? null, date: new Date().toISOString(), commands: [], complete: false };
for (const command of commands) {
  const file = join(directory, `verify-${command.replaceAll(':', '-')}.log`), fd = openSync(file, 'w'), start = Date.now();
  console.log(`Verifying pnpm ${command}`);
  const result = spawnSync(process.execPath, [pnpm, command], { cwd: root, stdio: ['ignore', fd, fd], env: process.env }); closeSync(fd);
  const text = readFileSync(file, 'utf8');
  report.commands.push({ command, exitCode: result.status ?? -1, elapsedMs: Date.now() - start, log: file.slice(root.length).replaceAll('\\', '/'), counts: text.match(/(?:Tests|Test Files)\s+\d+ passed[^\r\n]*|\d+ passed \([^\r\n]*/g) ?? [] });
  writeFileSync(join(directory, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  if (result.status !== 0) { console.error(text.slice(-10000)); process.exit(result.status ?? 1); }
}
report.complete = true; writeFileSync(join(directory, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`All ${commands.length} release gates passed for ${config.version}. No publication performed.`);
