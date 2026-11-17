# Public npm publication: 1.0.0-rc.2

Publication completed on 17 November 2026 after explicit approval of the exact inventory, version, next tag and local npm CLI method. The first six public packages were published on 15 November; the remaining five were completed after renewing npm authentication. Every published tarball was downloaded and its bytes matched the approved SHA-512.

| Order | Package | Version | Tarball bytes |
| --- | --- | --- | --- |
| 1 | [valixa](https://www.npmjs.com/package/valixa/v/1.0.0-rc.2) | 1.0.0-rc.2 | 77808 |
| 2 | [valixa-angular](https://www.npmjs.com/package/valixa-angular/v/1.0.0-rc.2) | 1.0.0-rc.2 | 17541 |
| 3 | [valixa-auto](https://www.npmjs.com/package/valixa-auto/v/1.0.0-rc.2) | 1.0.0-rc.2 | 10840 |
| 4 | [valixa-devtools](https://www.npmjs.com/package/valixa-devtools/v/1.0.0-rc.2) | 1.0.0-rc.2 | 23604 |
| 5 | [valixa-angular-devtools](https://www.npmjs.com/package/valixa-angular-devtools/v/1.0.0-rc.2) | 1.0.0-rc.2 | 3378 |
| 6 | [valixa-angular-material](https://www.npmjs.com/package/valixa-angular-material/v/1.0.0-rc.2) | 1.0.0-rc.2 | 9509 |
| 7 | [valixa-react](https://www.npmjs.com/package/valixa-react/v/1.0.0-rc.2) | 1.0.0-rc.2 | 15536 |
| 8 | [valixa-vue](https://www.npmjs.com/package/valixa-vue/v/1.0.0-rc.2) | 1.0.0-rc.2 | 17203 |
| 9 | [valixa-angular-auto](https://www.npmjs.com/package/valixa-angular-auto/v/1.0.0-rc.2) | 1.0.0-rc.2 | 16777 |
| 10 | [valixa-mui](https://www.npmjs.com/package/valixa-mui/v/1.0.0-rc.2) | 1.0.0-rc.2 | 15017 |
| 11 | [valixa-vuetify](https://www.npmjs.com/package/valixa-vuetify/v/1.0.0-rc.2) | 1.0.0-rc.2 | 15668 |

```sh
npm install valixa@next valixa-vue@next valixa-vuetify@next
```

This release includes valixa/standard, providing Standard Schema adapters for Zod, Yup and Valibot. Providers remain application dependencies; no provider is bundled in core. Existing entry points and all 31 previous declaration baselines were preserved.

## Verification and source

Source: ec5cb1a35a737d5eba680fb50aeb8c4ff5bf9659. [All five successful CI jobs](https://github.com/Heshammesalam/Valixa/actions/runs/43714366087) cover Node 20/22/24, production browsers/Nuxt, independent package consumers and benchmarks. All 334 uploaded source blobs were independently verified.

Fifteen required local release gates exited zero. Coverage includes 205 tests/34 files, 3 tooling tests, 51 production browser scenarios plus 3 Nuxt scenarios, 13 independent consumer cases, eleven packed-content/API checks and a strict audit with zero known vulnerabilities. Nuxt ran on the supported isolated Node 24.15.0 runtime.

Diagnostic failures were preserved and addressed: the Vue row-identity assertion now waits for DOM reconciliation, consumer Rollup matches the lockfile-tested version, and the standalone Node runtime was completed with the existing npm CLI. For the last environment correction, eight successful gates were retained only after verifying the source tree was unchanged; the failed packaging gate and every remaining gate were actually rerun. No failure was converted to a successful exit without execution.

[Registry checksum evidence](../../release/registry-1.0.0-rc.2.json) records actual tags, previous tags and download confirmation. The approved aggregate manifest SHA-256 is `4252a9ecfc6f6ff26ef7f1dc2bf11b78c485dd01bd8690a26e7a40fe29dd8878`.

## Publication method and limits

Candidate verification completed on 15 November; the strict dependency audit was
refreshed on 17 November and again reported no known vulnerabilities, without ignored advisories.

Commands used npm publish on the exact approved tarballs with --ignore-scripts --access public --tag next and the public npm registry. The maintainer privately completed npm web authentication. No npm token was read/copied by this work, no stage command was run, and no GitHub release or release tag was created.

As explicitly approved, this local publication has no GitHub OIDC provenance. Trusted publishers remain unverified and VALIXA_RELEASE_READY remains unset; protected CI publication was not enabled or bypassed.

This is a release candidate. The pilots use simulated APIs, the Nuxt matrix covers the pinned Node-server fixture, and its private licensed build-tool patch remains a maintenance responsibility. That patch and Nuxt are not dependencies or bundled files of any Valixa library. Provider issue strings are not automatically translated by Valixa locale changes.

## Actual registry tags after publication

- valixa: latest=1.0.0-rc.1, next=1.0.0-rc.2
- valixa-angular: latest=1.0.0-rc.1, next=1.0.0-rc.2
- valixa-auto: latest=1.0.0-rc.1, next=1.0.0-rc.2
- valixa-devtools: latest=1.0.0-rc.1, next=1.0.0-rc.2
- valixa-angular-devtools: latest=1.0.0-rc.1, next=1.0.0-rc.2
- valixa-angular-material: latest=1.0.0-rc.1, next=1.0.0-rc.2
- valixa-react: latest=1.0.0-rc.1, next=1.0.0-rc.2
- valixa-vue: latest=1.0.0-rc.1, next=1.0.0-rc.2
- valixa-angular-auto: latest=1.0.0-rc.1, next=1.0.0-rc.2
- valixa-mui: latest=1.0.0-rc.1, next=1.0.0-rc.2
- valixa-vuetify: latest=1.0.0-rc.1, next=1.0.0-rc.2

No dist-tag was changed separately after publishing. Stable 1.0.0 was not published.
