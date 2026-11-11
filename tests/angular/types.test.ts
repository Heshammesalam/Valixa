import '@angular/compiler';
import { expect, expectTypeOf, it } from 'vitest';
import type { DestroyRef } from '@angular/core';
import { createValixa, numberCodec } from 'valixa-angular';
import type { ValueCodec } from 'valixa-angular';
import { dateOnlyCodec } from 'valixa-angular-material';

it('preserves field/value inference and rejects invalid names and codecs', () => {
  const destroyRef = { destroyed: false, onDestroy: () => () => {} } satisfies DestroyRef;
  const form = createValixa({ email: [''], age: [18] }, { id: 'types', destroyRef });
  expectTypeOf(form.field('age').value()).toEqualTypeOf<number>(); expectTypeOf(form.field('email').value()).toEqualTypeOf<string>();
  const numeric: ValueCodec<number, string> = numberCodec(0); expect(numeric.encode('25')).toBe(25);
  if (false) {
    // @ts-expect-error unknown field name
    form.field('missing');
    // @ts-expect-error wrong value type
    form.field('age').setValue('18');
    // @ts-expect-error date codec cannot encode numeric field values
    const invalid: ValueCodec<number, Date | null> = dateOnlyCodec;
  }
  form.dispose();
});
