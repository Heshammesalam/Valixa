import type { ValueCodec } from 'valixa-angular';

/** NativeDateAdapter civil date codec. 'invalid' must be rejected by a blueprint validator. */
export const dateOnlyCodec: ValueCodec<string | null, Date | null> = Object.freeze({
  encode(value: Date | null): string | null {
    if (value === null) return null;
    if (!Number.isFinite(value.getTime())) return 'invalid';
    return `${String(value.getFullYear()).padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  },
  decode(value: string | null): Date | null {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number) as [number, number, number];
    const date = new Date(0); date.setHours(0, 0, 0, 0); date.setFullYear(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }
});
/** Object options commit; search strings/clearing commit null, preventing stale selection submission. */
export function autocompleteCodec<T extends object>(isOption: (value: unknown) => value is T): ValueCodec<T | null, T | string | null> {
  return { encode: value => isOption(value) ? value : null, decode: value => value };
}
