/** Phase 1 values are acyclic plain objects/arrays and primitive data. */
export function copy<T>(value: T, ancestors = new Set<object>()): T {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function' || typeof value === 'symbol') throw new TypeError('Values must be plain data');
    return value;
  }
  if (ancestors.has(value)) throw new TypeError('Cyclic values are not supported');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError('Values must be plain objects, arrays, or primitives');
  }
  ancestors.add(value);
  const result = Array.isArray(value)
    ? value.map(item => copy(item, ancestors))
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item, ancestors)]));
  ancestors.delete(value);
  return result as T;
}
export function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}
export function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
