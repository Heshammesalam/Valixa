# Migration and compatibility

1.0.0-rc.1 is a candidate for the first stable 1.0.0, not a registry publication claim.
Phase 7 does not intentionally change the Phase 6 runtime API. Public declaration
hashes are captured in release/api-baseline.json and checked during tarball verification.
The compatibility report records actual results; declaration equality is not alone
a proof of every JavaScript behavior, so existing runtime/consumer gates remain.

Changes from local 0.1.0 workspaces: matching 1.0.0-rc.1 package versions/internal peer
ranges, complete release metadata, Angular file-list normalization, protected release
automation and patched build/test-tool dependencies. Install all related Valixa packages
at the same candidate version. No automatic migration to a new product API is required.

Explicit domains and boundaries remain: ESM output; plain acyclic values; nested and
collection opt-in; typed empty numeric policies; explicit Date/File conversion; guarded
user-originated writes; programmatic core writes remain available. Old framework
form ownership still initializes once and reset restores original defaults.

Use only tested framework minor lines listed in installation.md. React/Vue optional
generic/custom registry limitations and Angular multiple-autocomplete rejection remain
documented capabilities. Future incompatible runtime/type changes require a major
version, migration examples and independent consumer verification.
