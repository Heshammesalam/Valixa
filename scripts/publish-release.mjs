import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, config, publicationOrder } from './release-lib.mjs';

assert(process.env.GITHUB_ACTIONS === 'true', 'Publishing is restricted to the protected GitHub workflow');
assert(process.env.RELEASE_CONFIGURATION_VERIFIED === 'true', 'Repository admin must verify scope rights, OIDC and environment protections before enabling release');
assert(process.env.RELEASE_APPROVED_VERSION === config.version, 'Exact package version approval is required');
assert(config.repository === `https://github.com/${process.env.GITHUB_REPOSITORY}`, 'Verified repository must match the workflow');
assert(process.env.ACTIONS_ID_TOKEN_REQUEST_URL, 'OIDC trusted publisher environment is required; no token fallback');
const manifest = JSON.parse(readFileSync(join(root, 'artifacts/release/manifest.json'), 'utf8'));
assert(!manifest.errors.length && !manifest.blockers.length && manifest.version === config.version, 'Release artifact verification must pass');
const verification = JSON.parse(readFileSync(join(root, 'artifacts/release/verification.json'), 'utf8'));
assert(verification.complete && verification.version === config.version && verification.sourceSha === process.env.GITHUB_SHA, 'All gates must pass on this exact CI source SHA/version');
for (const command of ['check', 'examples:build', 'test:browser', 'test:browser:release', 'test:packages', 'release:check', 'benchmark', 'benchmark:compare', 'benchmark:phase6', 'audit:security']) assert(verification.commands.some(item => item.command === command && item.exitCode === 0), `Missing successful gate: ${command}`);
const confirmations = [];
for (const item of publicationOrder()) {
  const entry = manifest.packages.find(entry => entry.name === item.manifest.name);
  assert(entry?.version === config.version, 'Release inventory/version mismatch');
  const tarball = join(root, 'artifacts/release', entry.file), bytes = readFileSync(tarball);
  assert.equal(createHash('sha512').update(bytes).digest('hex'), entry.sha512, 'Immutable tarball checksum changed');
  const url = new URL(`${encodeURIComponent(entry.name)}/${entry.version}`, config.registry);
  const previous = await fetch(url, { signal: AbortSignal.timeout(15000) });
  assert.equal(previous.status, 404, `${entry.name}@${entry.version} already exists or registry preflight failed; never overwrite/re-publish`);
  execFileSync('npm', ['publish', tarball, '--ignore-scripts', '--access', 'public', '--tag', config.tag, '--provenance', '--registry', config.registry], { cwd: root, stdio: 'inherit' });
  let published;
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (response.ok) { published = await response.json(); break; }
    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  assert.equal(published?.version, entry.version, `Registry did not confirm ${entry.name}`);
  assert.equal(published.dist.integrity, `sha512-${Buffer.from(entry.sha512, 'hex').toString('base64')}`, 'Registry tarball integrity differs');
  confirmations.push({ name: entry.name, version: entry.version, integrity: published.dist.integrity });
  writeFileSync(join(root, 'artifacts/release/registry-confirmations.json'), JSON.stringify(confirmations, null, 2) + '\n');
}
