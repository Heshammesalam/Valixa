# Local build-tool security patch

This private vendored copy is upstream MIT-licensed deepmerge 4.3.1's self-contained
CommonJS build and declarations. The original license is retained. It is **not** an
official upstream 4.3.2 release and must never be published by this repository.
The upstream and patched SHA-256 values are recorded in origin.json.

The scoped pnpm override applies only to @rollup/plugin-node-resolve's dependency
used by the private Nuxt example. No Valixa library imports or bundles this code.

[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) has no official
patched version at the time of this change. Upstream copying of own __proto__ keys
from the target can invoke the destination's inherited setter and poison its prototype.
All three writes to a merge destination now use Object.defineProperty to create
own data properties. This preserves legitimate keys without invoking inherited setters.

Regression tests cover target/source/nested attacks, null-prototype data, symbol
keys, arrays, custom array merging, custom merge functions and clone:false. A real
Nuxt production build and browser checks verify its actual build-tool use.

Remove this override when upstream provides a verified official fix; retain tests.
The local version identifies genuinely changed code; no audit advisory is ignored.
