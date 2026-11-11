# Installation

The prepared release candidate is **1.0.0-rc.1**. Preparation does not mean npm
publication; see the release-readiness report for registry/authentication status.
Until publication is confirmed, use verified local tarballs from artifacts/release.

```sh
npm install ./artifacts/release/valixa-core-1.0.0-rc.1.tgz
```

After an explicitly approved publication, install matching Valixa versions together.
For candidates, use an exact version or the reviewed `next` tag, not an assumed latest.

| Application | Valixa packages | Framework peers |
| --- | --- | --- |
| Vanilla JS / TypeScript | core | None |
| React | core, react | React 19.2 |
| React + MUI | core, react, mui | MUI 7.3, Emotion 11; MUI X 8.29 only for /x |
| Vue | core, vue | Vue 3.5 |
| Vue + Vuetify | core, vue, vuetify | Vuetify 3.13 |
| Angular | core, angular | Angular 21.2, RxJS 7.8, tslib |
| Angular + Material | core, angular, angular-material | Material/CDK 21.2 |
| Auto Forms | Add auto; Angular adds angular-auto | Existing framework/UI peers |
| DevTools | Add devtools; Angular adds angular-devtools | No extra application UI library |

All package names use the `@valixa/` prefix. React/Vue Auto and DevTools are optional
subpaths of the existing framework packages. Installing manual React/Vue does not
require auto, devtools or an unrelated UI framework. Angular Material is separate
from Angular-only consumers. JavaScript output is ESM; CommonJS require is unsupported.

Use Node 24 for repository tooling. Angular's own compiler/runtime engine constraints
also apply. Type inference examples are verified with TypeScript 5.9.3; no compatibility
claim is made for older compilers without actual testing.
