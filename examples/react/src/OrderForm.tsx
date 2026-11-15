import { useState } from 'react';
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { CollectionRow } from 'valixa';
import { useValixa, useValixaState } from 'valixa-react';
import { useMuiField } from 'valixa-mui';
import { OrderConflict, orderDefinition, orderOptions, orderRow, saveOrder } from '../../shared/order.js';

function Item({ row }: { row: CollectionRow<typeof orderRow.__values> }) {
  const sku = useMuiField(row.form, 'sku'), quantity = useMuiField(row.form, 'quantity');
  const state = useValixaState(row.form);
  return <section data-testid="order-row" data-row-key={row.key}><TextField label="Product code" {...sku.textField()} /><TextField label="Quantity" {...quantity.textField()} />{state.pending && <span role="status" aria-label="Product availability">Checking product…</span>}</section>;
}
export function OrderForm() {
  const form = useValixa(orderDefinition, orderOptions), state = useValixaState(form), rows = form.array('items');
  const email = useMuiField(form, 'email'), address = useMuiField(form, 'shipping.address');
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage('');
    try { const result = await form.submit((values, { signal }) => saveOrder(values, signal)); setMessage(result.status === 'success' ? JSON.stringify(result.data) : result.status); }
    catch (error) { if (error instanceof OrderConflict) form.setError('email', error.message); else setMessage('Request failed. Please retry.'); }
  }
  return <form noValidate onSubmit={event => { void submit(event); }}><Stack spacing={2}>
    <Typography component="h2" variant="h5">Purchase order pilot</Typography>
    <Typography>Shared Zod rules, editable rows and a simulated API. Use blocked@example.com for a server rejection, or TAKEN as an unavailable product.</Typography>
    <TextField label="Customer email" {...email.textField()} />
    <TextField id="order-delivery" select label="Delivery" value={state.values.delivery} onChange={event => form.setValue('delivery', event.target.value)}><MenuItem value="pickup">Pickup</MenuItem><MenuItem value="ship">Ship</MenuItem></TextField>
    {state.values.delivery === 'ship' && <TextField label="Shipping address" {...address.textField()} />}
    {rows.items.map(row => <Item key={row.key} row={row} />)}
    {state.errors.items?.map((message, i) => <Alert severity="error" key={i}>{message}</Alert>)}
    {state.formErrors.map((message, i) => <Alert severity="error" key={i}>{message}</Alert>)}
    <Button type="button" onClick={() => rows.append({ sku: '', quantity: '1' })}>Add item</Button>
    <Button type="button" disabled={rows.items.length < 2} onClick={() => rows.move(0, 1)}>Move first item down</Button>
    <Button type="button" disabled={!rows.items.length} onClick={() => rows.remove(0)}>Remove first item</Button>
    <Button type="submit" disabled={state.submitting}>Place order</Button>
    <Button type="button" onClick={() => { form.cancelSubmit(); setMessage('cancelled'); }}>Cancel order</Button>
    <Button type="button" onClick={() => { form.reset(); setMessage(''); }}>Reset order</Button>
    <output aria-label="Order result">{message}</output>
  </Stack></form>;
}
