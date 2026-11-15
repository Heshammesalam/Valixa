import { blueprint, collection, nested } from 'valixa';
import { parseStandard, standardFormValidator } from 'valixa/standard';
import * as z from 'zod';

export function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' })); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}
export const orderRowInput = {
  sku: { initial: 'BOOK', rules: 'required', dependsOn: [], validate: async (value: string, { signal }: { signal: AbortSignal }) => {
    await pause(value === 'TAKEN' ? 180 : 40, signal);
    return value !== 'TAKEN' || 'Product is unavailable';
  } },
  quantity: ['1']
} as const;
export const orderRow = blueprint(orderRowInput);
export const orderDefinition = blueprint({
  email: [''], delivery: ['pickup'], shipping: nested({ address: [''] }),
  items: collection(orderRowInput, [{ sku: 'BOOK', quantity: '1' }])
});
export const orderSchema = z.object({
  email: z.email('Enter a valid email'),
  delivery: z.string().refine(value => value === 'pickup' || value === 'ship', 'Choose pickup or shipping'),
  shipping: z.object({ address: z.string() }),
  items: z.array(z.object({ sku: z.string().min(1, 'Product is required'), quantity: z.string().regex(/^\d+$/, 'Quantity must be a whole number').transform(Number).pipe(z.number().min(1, 'Quantity must be at least 1').max(10, 'Quantity must be at most 10')) })).min(1, 'Add at least one item')
}).superRefine((value, context) => {
  if (value.delivery === 'ship' && !value.shipping.address.trim()) context.addIssue({ code: 'custom', path: ['shipping', 'address'], message: 'Shipping address is required' });
});
export const orderOptions = {
  validateForm: standardFormValidator(orderSchema, orderDefinition),
  validation: { mode: 'onChange', debounce: 60 },
  behaviors: { 'shipping.address': { dependsOn: ['delivery'], visibleWhen: ({ values }: { values: Readonly<Record<string, unknown>> }) => values.delivery === 'ship' } }
} as const;
export class OrderConflict extends Error {}
/** Local pilot API: no network, persistent storage or real customer records. */
export async function saveOrder(values: z.input<typeof orderSchema>, signal: AbortSignal) {
  const order = await parseStandard(orderSchema, values, { signal });
  await pause(450, signal);
  if (order.email === 'blocked@example.com') throw new OrderConflict('This email cannot place orders');
  return { id: 'ORDER-1001', ...order };
}
