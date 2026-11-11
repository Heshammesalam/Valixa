import { expectTypeOf, it } from 'vitest';
import { blueprint, createValixa } from '../packages/core/src/index.js';

it('infers values and restricts field names, values and submission output', async () => {
  const form = createValixa({ email: ['', 'email'], age: [0, 'minValue:0'], agree: [false, 'required'] });
  expectTypeOf(form.state.values.email).toEqualTypeOf<string>();
  expectTypeOf(form.state.values.age).toEqualTypeOf<number>();
  expectTypeOf(form.state.values.agree).toEqualTypeOf<boolean>();
  form.setValue('age', 20);
  // Compile-only negative assertions must not execute.
  if (false) {
    // @ts-expect-error unknown field
    form.setValue('missing', '');
    // @ts-expect-error wrong value type
    form.setValue('age', '20');
    // @ts-expect-error immutable state
    form.state.values.email = 'no';
    // @ts-expect-error wrong field subscription
    form.subscribeField('missing', () => {});
  }
  const reusable = blueprint({ email: ['', 'required'] });
  expectTypeOf(createValixa(reusable).state.values.email).toEqualTypeOf<string>();
  await form.submit(data => {
    expectTypeOf(data.email).toEqualTypeOf<string>();
    expectTypeOf(data.age).toEqualTypeOf<number>();
    return data.age;
  });
});
