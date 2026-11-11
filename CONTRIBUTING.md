# Contributing

Use Node 24 and pnpm 10.26.2. Clone the repository, then:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm examples:build
pnpm exec playwright install chromium firefox webkit
pnpm test:browser
pnpm test:browser:release
pnpm test:packages
pnpm release:check:candidate
pnpm benchmark
pnpm benchmark:compare
pnpm benchmark:phase6
pnpm audit --audit-level=low
```

Package builds run in dependency order. Angular packages are normalized APF output
and must be packed from dist, not the source root. Consumer checks install actual
tarballs into fresh temporary directories outside the workspace. Runtime artifacts
and tarballs are ignored; do not commit node_modules, local logs or credentials.

Preserve manual form APIs and immutable snapshot/row identity contracts. Keep core
free of framework/DOM runtime dependencies and keep optional entry points isolated.
For fixes, add focused tests of meaningful behavior; avoid timing thresholds and
tests that merely repeat implementation details. Never weaken an advisory gate.

For post-1.0 public changes, run `pnpm changeset` and describe the user-visible impact.
All 11 packages follow a fixed version train while maintaining separate entry points.
SemVer patch fixes behavior without breaking contracts, minor adds compatible APIs,
major changes require a migration guide. First-release candidate promotion is handled
by `release:prepare`; see docs/releasing.md before invoking any version command.

Do not publish packages, create release tags, or dispatch the release workflow as
part of an ordinary contribution. Report vulnerabilities using SECURITY.md.
