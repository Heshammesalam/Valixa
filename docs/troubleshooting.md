# Troubleshooting

| Symptom | Check |
| --- | --- |
| Package not found on npm | Candidate preparation is not publication. Check the readiness report/registry or install verified local tarballs. |
| Cannot resolve /auto or /devtools peer | Install matching @valixa/auto or @valixa/devtools explicitly; Angular uses dedicated packages. |
| CommonJS require fails | Shipping output is ESM. Use import or a compatible bundler. |
| Input does not update | Bind through the framework field adapter, honor its event shape, and avoid mutating snapshots. |
| Values change but a component stays stale | Read a subscribed field/state projection; a raw core snapshot read is not a UI subscription. |
| Form ignores changed initial props | Framework form ownership initializes once. Remount the owner with a meaningful record/version key. |
| Row state jumps after movement | Track row.key and bind row.form; indices are current positions, not stable identities. |
| Hidden/disabled field still blocks submit | Visibility does not skip validation. Configure validateWhen deliberately. |
| Submit promise settled but request did not run | Check status: invalid/busy/stale/cancelled differ from success. |
| Async work finishes after reset | Pass AbortSignal to application requests; ignored signals cannot stop external work, but stale results cannot commit. |
| Number/date types do not match | Provide an explicit compatible empty value/date codec; native string and Material Date views differ. |
| Angular multiple autocomplete throws | Use multi-select or a custom renderer; this capability is intentionally rejected. |
| DevTools shows redacted values | Expected default. Reveal only selected nonsensitive paths in development; messages need a second explicit opt-in. |
| npm publish fails authentication | Do not paste tokens into chat or files. Verify scope rights, workflow identity, protected environment and configured npm trusted publishers. |

For SSR, keep per-request form ownership and avoid sharing live forms across users.
DevTools panel mounts only on the client. Native React/Vue hydration is tested in
jsdom; production SSR/hydration claims must follow the compatibility matrix.
