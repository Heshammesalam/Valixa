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
  // Callers own input containers (external data is copied at the write boundary).
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}
/** Internal plain-data projection sharing. Never pass unowned application objects. */
export function share<T>(previous: T | undefined, next: T): T {
  if (Object.is(previous, next)) return previous as T;
  if (!next || typeof next !== 'object') return next;
  const old = previous && typeof previous === 'object' && Array.isArray(previous) === Array.isArray(next) ? previous as Record<string, unknown> : undefined;
  if (!old && Object.isFrozen(next)) return next;
  const keys = Object.keys(next);
  let unchanged = old !== undefined && Object.keys(old).length === keys.length && (!Array.isArray(next) || (previous as unknown[]).length === next.length);
  if (unchanged && keys.every(key => Object.hasOwn(old!, key) && Object.is(old![key], (next as Record<string, unknown>)[key]))) return previous as T;
  const entries = keys.map(key => {
    const value = share(old?.[key], (next as Record<string, unknown>)[key]);
    if (!old || !Object.hasOwn(old, key) || !Object.is(value, old[key])) unchanged = false;
    return [key, value] as const;
  });
  if (unchanged) return previous as T;
  if (Array.isArray(next)) {
    const array: unknown[] = new Array(next.length);
    for (const [key, value] of entries) Object.defineProperty(array, key, { value, enumerable: true, configurable: true, writable: true });
    return Object.freeze(array) as T;
  }
  // Object.fromEntries defines own data properties, including atomic __proto__
  // keys. Object.assign onto a normal object would invoke its prototype setter.
  const result = Object.fromEntries(entries);
  if (Object.getPrototypeOf(next) === null) Object.setPrototypeOf(result, null);
  return Object.freeze(result) as T;
}
export function sameRecord(a: Readonly<Record<string, unknown>> | undefined, b: Readonly<Record<string, unknown>>): boolean {
  if (a === b) return true;
  const keys = Object.keys(b);
  return a !== undefined && Object.keys(a).length === keys.length && keys.every(key => Object.hasOwn(a, key) && Object.is(a[key], b[key]));
}
export function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
/** Configuration may contain callbacks, unlike form values. Copy containers only. */
export function configuration<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(configuration)) as T;
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, configuration(item)]))) as T;
  return value;
}
