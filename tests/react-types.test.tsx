// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expectTypeOf, it } from 'vitest';
import { TextField, Checkbox, Autocomplete } from '@mui/material';
import { defineAdapter, nativeText, useValixa, useValixaAdapter, useValixaField } from '@valixa/react';
import { useMuiField } from '@valixa/mui';

afterEach(cleanup);
it('preserves inference and rejects invalid field names, values and component contracts', () => {
  function Contract() {
    const form = useValixa({ email: ['', 'email'], agree: [false], count: [0], amount: { initial: null as number | null },
      tags: { initial: [] as string[] }, person: { initial: null as { id: number; label: string } | null } });
    const email = useValixaField(form, 'email');
    const muiEmail = useMuiField(form, 'email'), agree = useMuiField(form, 'agree');
    const amount = useMuiField(form, 'amount'), tags = useMuiField(form, 'tags'), person = useMuiField(form, 'person');
    expectTypeOf(email.state.value).toEqualTypeOf<string>();
    expectTypeOf(agree.state.value).toEqualTypeOf<boolean>();
    if (false) {
      // @ts-expect-error invalid field name
      useValixaField(form, 'missing');
      // @ts-expect-error invalid MUI field name
      useMuiField(form, 'missing');
      // @ts-expect-error wrong value type
      email.setValue(10);
      // @ts-expect-error wrong native adapter value type
      useValixaAdapter(form, 'agree', nativeText);
      const nullableNumberAdapter = defineAdapter<number | null, { clear: () => void }>(field => ({ clear: () => field.setValue(null) }));
      // @ts-expect-error nullable adapter cannot write null into a number-only field
      useValixaAdapter(form, 'count', nullableNumberAdapter);
      // @ts-expect-error checkbox adapter cannot bind a string
      <Checkbox {...muiEmail.checkbox()} />;
      // @ts-expect-error text adapter cannot bind a boolean
      <TextField {...agree.textField()} />;
      // @ts-expect-error array select must declare multiple
      tags.select({});
      // @ts-expect-error object options require an explicit equality function
      person.autocomplete({ multiple: false, label: 'Person' });
      // @ts-expect-error empty numeric value must match field type
      amount.numberField({ emptyValue: 'invalid' });
    }
    return <><TextField {...muiEmail.textField()} /><Checkbox {...agree.checkbox()} />
      <TextField {...amount.numberField({ emptyValue: null })} />
      <Autocomplete options={['React']} {...tags.autocomplete({ multiple: true, label: 'Tags' })} /></>;
  }
  render(<Contract />);
});
