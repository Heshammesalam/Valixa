import { useState } from 'react';
import { Button, Stack, TextField } from '@mui/material';
import type { CollectionRow } from 'valixa';
import { nativeText, useValixa, useValixaAdapter, useValixaState } from 'valixa-react';
import { useMuiField } from 'valixa-mui';
import { reactiveOptions, reactiveSchema } from '../../shared/reactive.js';
import type { AddressValues } from '../../shared/reactive.js';

function Address({ row }: { row: CollectionRow<AddressValues> }) {
  const city = useMuiField(row.form, 'city'), confirm = useMuiField(row.form, 'confirm');
  return <section data-testid="address-row" data-row-key={row.key}><TextField label="Address city" {...city.textField()} /><TextField label="Confirm city" {...confirm.textField()} /></section>;
}
export function ReactiveForm() {
  const form = useValixa(reactiveSchema, reactiveOptions), state = useValixaState(form);
  const country = useValixaAdapter(form, 'country', nativeText), city = useMuiField(form, 'user.city');
  const addresses = form.array('addresses'); const [result, setResult] = useState('');
  return <form noValidate onSubmit={event => { event.preventDefault(); void form.submit(values => { setResult(JSON.stringify(values)); }).catch(() => setResult('Request failed')); }}><Stack spacing={2}>
    <h2>Reactive engine</h2><p>Conditional nested fields, row identity and live message localization.</p>
    <label htmlFor={country.id}>Country code</label><input {...country} />
    {city.state.visible && <TextField label="City" {...city.textField()} />}
    {addresses.items.map(row => <Address key={row.key} row={row} />)}
    <Button type="button" onClick={() => addresses.append({ city: '', confirm: '' })}>Add address</Button>
    <Button type="button" disabled={addresses.items.length < 2} onClick={() => addresses.move(0, 1)}>Move first down</Button>
    <Button type="button" disabled={!addresses.items.length} onClick={() => addresses.remove(0)}>Remove first</Button>
    <Button type="button" onClick={() => form.setLocale(state.locale === 'en' ? 'ar' : 'en')}>Switch language</Button>
    <Button type="submit">Save reactive</Button><Button type="button" onClick={() => { form.reset(); setResult(''); }}>Reset reactive</Button>
    <output aria-label="Reactive result">{result}</output>
  </Stack></form>;
}
