# Installation

The prepared release candidate is **1.0.0-rc.1**. Preparation does not mean npm
publication; see the release-readiness report for registry/authentication status.
Until publication is confirmed, use verified local tarballs from artifacts/release.

```sh
npm install ./artifacts/release/valixa-1.0.0-rc.1.tgz
```

After an explicitly approved publication, install matching Valixa versions together.
For candidates, use an exact version or the reviewed `next` tag, not an assumed latest.

| Application | Valixa packages | Framework peers |
| --- | --- | --- |
| Vanilla JS / TypeScript | `valixa` | None |
| React | `valixa`, `valixa-react` | React 19.2 |
| React + MUI | `valixa`, `valixa-react`, `valixa-mui` | MUI 7.3, Emotion 11; MUI X 8.29 only for /x |
| Vue | `valixa`, `valixa-vue` | Vue 3.5 |
| Vue + Vuetify | `valixa`, `valixa-vue`, `valixa-vuetify` | Vuetify 3.13 |
| Angular | `valixa`, `valixa-angular` | Angular 21.2, RxJS 7.8, tslib |
| Angular + Material | `valixa`, `valixa-angular`, `valixa-angular-material` | Material/CDK 21.2 |
| Auto Forms | Add auto; Angular adds angular-auto | Existing framework/UI peers |
| DevTools | Add devtools; Angular adds angular-devtools | No extra application UI library |

Public packages are unscoped: `valixa` is core and adapters use `valixa-*`. No npm organization is required. React/Vue Auto and DevTools are optional
subpaths of the existing framework packages. Installing manual React/Vue does not
require auto, devtools or an unrelated UI framework. Angular Material is separate
from Angular-only consumers. JavaScript output is ESM; CommonJS require is unsupported.

Use Node 24 for repository tooling. Angular's own compiler/runtime engine constraints
also apply. Type inference examples are verified with TypeScript 5.9.3; no compatibility
claim is made for older compilers without actual testing.
