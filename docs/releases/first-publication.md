# First public publication proposal

Status: prepared for exact maintainer approval; **not executed**.

The maintainer approved all eleven public unscoped names. This proposal adds the
exact version and bootstrap method; it does not treat that naming decision as
approval of an immutable release candidate.

All packages below: **1.0.0-rc.1**, public access, distribution tag **next**.
Do not publish a stable version or a placeholder version under this proposal.

Publication order:

1. valixa
2. valixa-angular
3. valixa-auto
4. valixa-devtools
5. valixa-angular-devtools
6. valixa-angular-material
7. valixa-react
8. valixa-vue
9. valixa-angular-auto
10. valixa-mui
11. valixa-vuetify

## Evidence and immutable inputs

Source: `205512661d37e237cec0f47164d5bd043b81d39e`.
[Matching CI run](https://github.com/Heshammesalam/Valixa/actions/runs/42994106136).
All ten local release gates passed; 190 tests, 15 Chromium flows, 45 cross-browser
flows, twelve installed consumer cases, and zero audit advisories at verification.

Prepared manifest: `artifacts/release/manifest.json`, SHA-256
`a3eebb26df9129545ffb3d56a61b0655a8b47e9ab37749d0b8fafb5ceb3cc6ae`.
Every tarball has its own SHA-512 in this manifest. Recheck every checksum and all
eleven registry name/version preflights before the first upload. Do not rebuild or
substitute tarballs after approval. Stop on a changed hash or occupied name.

## One-time bootstrap limitation

Normal CLI login was verified as `heshammesalam` without reading credentials.
The new packages do not yet have npm package settings where a trusted publisher
can be configured. The proposed first upload uses the maintainer's normal local
npm session and any npm-required authentication challenge. It has **no GitHub
OIDC provenance attestation**. This exception needs explicit approval. It does
not modify or bypass the protected GitHub publishing script.

The equivalent command for each approved tarball, in the order above, is:

```powershell
npm publish artifacts/release/valixa-1.0.0-rc.1.tgz --ignore-scripts --access public --tag next --registry https://registry.npmjs.org/
```

Use the matching filename for each integration. Verify the registry version and
`dist.integrity` against the manifest immediately after each upload. Record
confirmations and stop on failure; do not blindly retry a partially published train.
If npm asks for authentication, the maintainer completes it privately.

Do not use staged publishing as a silent workaround: for a new package it creates
a public `0.0.0-stage` placeholder, outside this proposal's exact version approval.

## Subsequent releases

After the packages exist, configure each npm trusted publisher for repository
`Heshammesalam/Valixa`, workflow `release.yml`, environment `npm-release`.
The GitHub environment is already restricted to `main`, requires reviewer
`Heshammesalam`, and disallows administrator bypass. No CI credential was added.
Leave `VALIXA_RELEASE_READY` unset until every publisher is configured and verified.
Later releases use the protected OIDC workflow with provenance. Trusted publisher
configuration itself grants publishing permission and must be reviewed explicitly.

References: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/),
[npm staged publishing](https://docs.npmjs.com/staged-publishing/).
