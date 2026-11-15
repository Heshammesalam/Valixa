# Scoped Vue comparison: Valixa and VeeValidate

Measured 15 November 2026 on the local Windows/Node host. Exact versions and every
sample, p10, median and p90 are in [raw results](../benchmarks/vue-comparison-results.json).
Valixa is the working tree with unpublished additions; its manifest still says
1.0.0-rc.1. Vue is 3.5.45 and the registry-resolved stable VeeValidate is 4.15.1.
This is not a benchmark of VeeValidate v5 documentation or an assumed v5 release.

```sh
pnpm build
pnpm benchmark:vue-comparison
```

The final run was performed without concurrent project builds or tests. The earlier
concurrent diagnostic run is retained in ignored artifacts, not used in these tables.
Five warmup rounds precede fifteen samples. The first engine alternates per sample.
Both mount actual composables inside Vue components in jsdom, register the same
number of fields, start with the same valid strings and use the same validation
function. Automatic value-change validation is disabled in both. Each update awaits
Vue nextTick; full validation verifies exactly one invalid field. Assertions are
outside timed work. Async mount/disposal work is drained outside timed operations.

## Local medians, milliseconds per operation

| Fields | Valixa update | Vee update | Valixa full validation | Vee full validation |
| --- | --- | --- | --- | --- |
| 10 | 0.0247 | 0.0973 | 0.1295 | 0.9563 |
| 100 | 0.0342 | 0.5195 | 0.5006 | 12.8806 |
| 1000 | 0.7144 | 12.8769 | 14.2359 | 242.0412 |

| Fields | Valixa initialization + disposal | Vee initialization + disposal |
| --- | --- | --- |
| 10 | 0.6970 | 2.0516 |
| 100 | 1.4029 | 29.0046 |
| 1000 | 17.8897 | 3340.0728 |

Valixa was faster in these measured operations. Initialization registers every
field composable inside one owner component, which is an intentionally synthetic
stress case. Libraries have different bookkeeping and default mount-validation
behavior; those are not erased to make the implementations identical. These figures
are not an isolated validation-algorithm comparison or a recommended component layout.

## Equivalent import bundle experiment

esbuild bundles/minifies production ESM with Vue external. Imports expose
`useValixa`/`useValixaField` versus `useForm`/`useField`. No schema provider, Nuxt,
component library, Auto renderer or DevTools panel is included.

| Entry | Minified bytes | Gzip bytes |
| --- | --- | --- |
| Valixa Vue form + field | 42,269 | 12,255 |
| VeeValidate form + field | 28,869 | 10,574 |

VeeValidate is smaller for these imports: Valixa costs 1,681 additional gzip bytes.
Different capabilities and API structures can affect tree shaking; this is not an
assertion that the libraries offer identical features or every application ships
these exact sizes. The new Standard Schema subpath is not included in this fixture.

## What the results do not establish

There are no timing pass/fail thresholds and no overall winner score. Real UI controls,
browser paint/interaction latency, Nuxt rendering, memory/heap behavior, dependency
graphs, dynamic row performance, network validation and schema-provider overhead
are not measured here. The separate browser suite verifies behavior, not speed.

Developer learning effort, maintenance history and production adoption are also not
timings. Use the real application pilots to evaluate those concerns. VeeValidate's
broader established Vue ecosystem is not replaced by a favorable synthetic number.
Bundle-size reduction and independent application feedback remain useful next work.
