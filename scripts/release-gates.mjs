/** Both verification and publication require the same complete candidate checks. */
export const releaseGates = Object.freeze([
  'check', 'examples:build', 'examples:nuxt:build', 'examples:nuxt:check',
  'test:browser', 'test:browser:release', 'test:nuxt', 'test:packages',
  'release:check', 'benchmark', 'benchmark:compare', 'benchmark:phase6',
  'benchmark:release', 'benchmark:vue-comparison', 'audit:security'
]);
