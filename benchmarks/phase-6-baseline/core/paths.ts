/** Escaping applies to segments in explicit nested schemas. Legacy top-level keys stay literal. */
export function escapePath(segment: string): string { return segment.replace(/\\/g, '\\\\').replace(/\./g, '\\.'); }
export function parsePath(path: string): readonly string[] {
  const segments: string[] = []; let segment = '', escaped = false;
  for (const char of path) {
    if (escaped) { if (char !== '.' && char !== '\\') throw new TypeError(`Invalid path escape: ${path}`); segment += char; escaped = false; }
    else if (char === '\\') escaped = true;
    else if (char === '.') { segments.push(segment); segment = ''; }
    else segment += char;
  }
  if (escaped) throw new TypeError(`Incomplete path escape: ${path}`);
  segments.push(segment);
  for (const part of segments) safeSegment(part);
  return segments;
}
export function safeSegment(segment: string): void {
  if (!segment || ['__proto__', 'prototype', 'constructor'].includes(segment)) throw new TypeError(`Reserved or empty path segment: ${segment}`);
}
export function readPath(object: Readonly<Record<string, unknown>>, path: string): unknown {
  if (Object.hasOwn(object, path)) return object[path];
  let value: unknown = object;
  for (const segment of parsePath(path)) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, segment)) return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}
export function writePath(object: Record<string, unknown>, segments: readonly string[], value: unknown): void {
  let target = object;
  for (const [index, segment] of segments.entries()) {
    safeSegment(segment);
    if (index === segments.length - 1) Object.defineProperty(target, segment, { value, enumerable: true, configurable: true, writable: true });
    else {
      if (!Object.hasOwn(target, segment)) Object.defineProperty(target, segment, { value: {}, enumerable: true, configurable: true, writable: true });
      target = target[segment] as Record<string, unknown>;
    }
  }
}
