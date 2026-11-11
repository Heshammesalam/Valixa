import { collection, nested } from '@valixa/core';
import type { FormOptions, InferValues } from '@valixa/core';

export const addressSchema = { city: ['', 'required'], confirm: ['', 'same:city'] } as const;
export type AddressValues = InferValues<typeof addressSchema>;
export const reactiveSchema = { country: [''], user: nested({ city: [''] }), addresses: collection(addressSchema) } as const;
export const reactiveOptions: FormOptions<InferValues<typeof reactiveSchema>> = {
  validation: { mode: 'onChange', debounce: 40 },
  behaviors: { 'user.city': { dependsOn: ['country'], visibleWhen: ({ values }) => Boolean(values.country),
    enabledWhen: ({ values }) => Boolean(values.country), requiredWhen: ({ values }) => Boolean(values.country) } },
  labels: { en: { 'user.city': 'City' }, ar: { 'user.city': 'المدينة' } }
};
