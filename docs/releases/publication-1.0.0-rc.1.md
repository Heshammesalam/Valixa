# Public npm publication: 1.0.0-rc.1

All eleven packages were published on 11 November 2026 after explicit approval of the exact names, version, next tag and one-time local bootstrap method. Each npm tarball was downloaded and matched against the approved SHA-512.

| Order | Public package | Version | Tarball bytes |
| --- | --- | --- | --- |
| 1 | [valixa](https://www.npmjs.com/package/valixa/v/1.0.0-rc.1) | 1.0.0-rc.1 | 73453 |
| 2 | [valixa-angular](https://www.npmjs.com/package/valixa-angular/v/1.0.0-rc.1) | 1.0.0-rc.1 | 17541 |
| 3 | [valixa-auto](https://www.npmjs.com/package/valixa-auto/v/1.0.0-rc.1) | 1.0.0-rc.1 | 10840 |
| 4 | [valixa-devtools](https://www.npmjs.com/package/valixa-devtools/v/1.0.0-rc.1) | 1.0.0-rc.1 | 23604 |
| 5 | [valixa-angular-devtools](https://www.npmjs.com/package/valixa-angular-devtools/v/1.0.0-rc.1) | 1.0.0-rc.1 | 3377 |
| 6 | [valixa-angular-material](https://www.npmjs.com/package/valixa-angular-material/v/1.0.0-rc.1) | 1.0.0-rc.1 | 9509 |
| 7 | [valixa-react](https://www.npmjs.com/package/valixa-react/v/1.0.0-rc.1) | 1.0.0-rc.1 | 15536 |
| 8 | [valixa-vue](https://www.npmjs.com/package/valixa-vue/v/1.0.0-rc.1) | 1.0.0-rc.1 | 17201 |
| 9 | [valixa-angular-auto](https://www.npmjs.com/package/valixa-angular-auto/v/1.0.0-rc.1) | 1.0.0-rc.1 | 16777 |
| 10 | [valixa-mui](https://www.npmjs.com/package/valixa-mui/v/1.0.0-rc.1) | 1.0.0-rc.1 | 15017 |
| 11 | [valixa-vuetify](https://www.npmjs.com/package/valixa-vuetify/v/1.0.0-rc.1) | 1.0.0-rc.1 | 15668 |

Core installation: `npm install valixa@next`. Add the relevant integration at the same version/tag.

The matching source CI passed on Node 20/22/24, production browsers and benchmarks: [run 42994106136](https://github.com/Heshammesalam/Valixa/actions/runs/42994106136). Local verification passed 190 tests, 45 cross-browser flows and 12 independent consumer cases.

Full registry metadata/checksum evidence: [release/registry-1.0.0-rc.1.json](../../release/registry-1.0.0-rc.1.json).

## Registry effects and limitations

Commands used `npm publish <approved-tarball> --ignore-scripts --access public --tag next --registry https://registry.npmjs.org/`. Normal npm CLI login and maintainer-completed web authentication were used. No stage command, public GitHub release or release tag was executed. No npm token was read or copied by this work.

npm nevertheless created public `0.0.0-stage` placeholder records during new-package processing and assigned both `latest` and `next` to `1.0.0-rc.1`. The evidence records these actual effects; no placeholder was unpublished and no dist-tag was changed afterward. This remains a release candidate, not stable 1.0.0.

As explicitly approved, the initial local bootstrap has no GitHub OIDC provenance. npm trusted publishers remain unconfigured and `VALIXA_RELEASE_READY` remains unset; protected CI publication is disabled until publisher setup. The GitHub environment requires the maintainer reviewer, restricts deployment to main and disallows administrator bypass.

Angular Auto required longer npm processing. Its upload was not retried; it was verified once processing completed. The remaining independent integrations were completed and every published tarball was verified together.
