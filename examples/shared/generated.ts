import { blueprint, collection, nested } from '@valixa/core';
import type { FormOptions } from '@valixa/core';
import { defineAutoForm, defineAutoCodec } from '@valixa/auto';

export const generatedSchema = blueprint({
  name: { initial: '', rules: 'required', dependsOn: [], validate: async (value: string, { signal }) => {
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(done, 80); function done() { signal.removeEventListener('abort', abort); resolve(); } function abort() { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); } signal.addEventListener('abort', abort, { once: true }); });
    return value !== 'taken' || 'Name is unavailable.';
  } }, email: ['', 'required | email'], password: ['', 'required | min:8'], age: [18, 'minValue:18'], country: [''],
  profile: nested({ city: [''] }), agree: [false, 'required'], updates: [true], plan: ['basic'], notes: [''], tags: { initial: [] as string[] },
  office: { initial: null as { id: string } | null }, day: { initial: null as string | null }, seats: [1], addresses: collection({ city: ['', 'required'] })
});
export type GeneratedValues = typeof generatedSchema.__values;
export const generatedOptions: FormOptions<GeneratedValues> = { validation: { mode: 'onChange', debounce: 40 }, behaviors: {
  'profile.city': { dependsOn: ['country'], visibleWhen: ({ values }) => Boolean(values.country), requiredWhen: ({ values }) => Boolean(values.country) }
} };
export const generatedUI = defineAutoForm(generatedSchema, { fields: {
  name: { component: 'text', label: 'Full name', description: 'Try taken to see async validation.' }, email: { component: 'email', label: 'Email address' }, password: { component: 'password', label: 'Password' },
  age: { component: 'number', label: 'Age', emptyValue: 0 }, country: { component: 'select', label: 'Country', emptyValue: '', options: [{ label: 'Egypt', value: 'EG' }, { label: 'United States', value: 'US' }] },
  'profile.city': { component: 'text', label: 'Profile city' }, agree: { component: 'checkbox', label: 'I agree' }, updates: { component: 'switch', label: 'Email updates' },
  plan: { component: 'radio', label: 'Plan', options: [{ label: 'Basic', value: 'basic' }, { label: 'Pro', value: 'pro' }] }, notes: { component: 'textarea', label: 'Notes' },
  tags: { component: 'select', label: 'Skills', multiple: true, emptyValue: [], options: [{ label: 'TypeScript', value: 'ts' }, { label: 'Design', value: 'design' }] },
  office: { component: 'autocomplete', label: 'Office', emptyValue: null, options: [{ label: 'Cairo', value: { id: 'cairo' } }, { label: 'Giza', value: { id: 'giza' } }], compare: (a, b) => a.id === b.id },
  day: { component: 'date', label: 'Start date', codec: 'civilDate' }, seats: { component: 'custom', label: 'Seats', renderer: 'counter' }
}, collections: { addresses: { label: 'Addresses', addLabel: 'Add address', ui: defineAutoForm(blueprint({ city: ['', 'required'] }), { fields: { city: { component: 'text', label: 'Address city' } } }), createItem: () => ({ city: '' }) } },
layout: [{ group: 'identity', label: 'Identity', children: ['name', 'email', 'password', 'age'] }, { group: 'preferences', label: 'Preferences', children: ['country', 'profile.city', 'office', 'tags', 'day', 'plan', 'updates', 'notes', 'seats', 'agree'] }, { collection: 'addresses' }], submitLabel: 'Save generated'
});
export const stringDate = defineAutoCodec<string | null, string>({ view: 'string', decode: value => value ?? '', encode: value => value || null });
/** The example result deliberately excludes the password. */
export async function saveGenerated(values: GeneratedValues): Promise<string> { const { password: _, ...safe } = values; await Promise.resolve(); return JSON.stringify(safe); }
