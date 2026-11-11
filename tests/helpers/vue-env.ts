import { vi } from 'vitest';
// jsdom lacks layout observers and media queries. Real layout/keyboard behavior is covered in Chromium.
if (!globalThis.ResizeObserver) vi.stubGlobal('ResizeObserver', class {
  observe() {} unobserve() {} disconnect() {}
});
if (!globalThis.visualViewport) vi.stubGlobal('visualViewport', null);
if (!window.matchMedia) window.matchMedia = (query: string) => ({ matches: false, media: query, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
if (!globalThis.CSS) vi.stubGlobal('CSS', { supports: () => false, escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`) });
