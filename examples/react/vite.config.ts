import { defineConfig } from 'vite';
export default defineConfig({
  build: { rollupOptions: {
    onwarn(warning, warn) {
      // Client directives remain in library output; this example is a client-only SPA.
      if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('use client')) return;
      warn(warning);
    }
  } }
});
