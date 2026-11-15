export default defineNuxtConfig({
  compatibilityDate: '2026-11-15',
  ssr: true,
  devtools: { enabled: false },
  telemetry: false,
  nitro: { preset: 'node-server' }
});
