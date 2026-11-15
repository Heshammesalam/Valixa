import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const merge: typeof import('../vendor/deepmerge/index.js') = require('../vendor/deepmerge/index.cjs');

it('patched build dependency defines __proto__ as data without poisoning returned objects', () => {
  const attack = JSON.parse('{"__proto__":{"admin":true},"safe":1}');
  for (const result of [merge(attack, {}), merge({}, attack), merge(attack, attack), merge({ nested: attack }, {}), merge.all([attack, {}])]) {
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect((result as Record<string, unknown>).admin).toBeUndefined();
    const nested = (result as { nested?: object }).nested;
    if (nested) { expect(Object.getPrototypeOf(nested)).toBe(Object.prototype); expect(nested).not.toHaveProperty('admin'); }
  }
  expect({}).not.toHaveProperty('admin');
  const nullObject = Object.create(null); Object.defineProperty(nullObject, '__proto__', { enumerable: true, value: { admin: true } });
  expect(Object.getPrototypeOf(merge(nullObject, {}))).toBe(Object.prototype);
});
it('preserves build-tool merge semantics, symbols and explicit options', () => {
  const key = Symbol('key');
  expect(merge({ a: [1], nested: { a: 1 }, [key]: 1 }, { a: [2], nested: { b: 2 }, [key]: 2 })).toEqual({ a: [1, 2], nested: { a: 1, b: 2 }, [key]: 2 });
  expect(merge({ a: [1] }, { a: [2] }, { arrayMerge: (_target, source) => source })).toEqual({ a: [2] });
  const object = { nested: { a: 1 } }; expect(merge({}, object, { clone: false }).nested).toBe(object.nested);
  expect(merge({ nested: { a: 1 } }, { nested: { b: 2 } }, { customMerge: name => name === 'nested' ? () => ({ replaced: true }) : undefined })).toEqual({ nested: { replaced: true } });
});
