import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/angular/**/*.test.ts'], environment: 'jsdom' } });
