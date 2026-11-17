# Standard Schema integration (1.0.0-rc.2+)

Published 1.0.0-rc.2 adds the optional `valixa/standard` entry point. Version
1.0.0-rc.1 does not contain it. Existing entry points and signatures are retained;
no vendor library or Standard Schema package is a runtime dependency of core.

Compatible providers implement [Standard Schema v1](https://standardschema.dev/).
Tests use actual Zod 4, Yup 1.7 and Valibot 1 schemas, including async validation.
Install the provider your application uses; Valixa does not import it for you.

```ts
import * as z from 'zod';
import { blueprint, createValixa } from 'valixa';
import { standardFormValidator, parseStandard } from 'valixa/standard';

const definition = blueprint({ email: [''], quantity: ['1'] });
const schema = z.object({
  email: z.email(),
  quantity: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1))
});
const options = { validateForm: standardFormValidator(schema, definition) };
const form = createValixa(definition, options);

const result = await form.submit(async (values, { signal }) => {
  const order = await parseStandard(schema, values, { signal });
  // order.quantity is number; form.state.values.quantity remains string.
  return order;
});
```

In Vue use `useValixa(definition, options)`; React and Angular use their existing
creation APIs with the same definition/options. No new component wrapper is needed.
Keep `useValixaState` once per owning component, and field adapters in their field
components when isolated updates matter. See the Purchase order tab in both pilots.

For an independent field:

```ts
import { standardValidator } from 'valixa/standard';
const form = createValixa({ email: { initial: '', validate: standardValidator(z.email()) } });
```

The field adapter returns the first provider issue, following the existing custom
validator contract. The form adapter retains all messages. An actual blueprint is
required for form mapping so literal dotted keys and escaped nested paths remain
unambiguous. Provider paths inside collections aggregate on the collection field;
attach field adapters to row definitions for individual row-field messages. Unmatched,
symbol and pathless issues appear in `state.formErrors`, never silently disappear.
The form adapter reserves the literal top-level name `$form` for these root issues.

Form schemas run during full `validate()`/submit and existing automatic form-validation
scheduling. `validate('field')` only runs that field's validators; use a field adapter
when that is the intended boundary. Existing debounce, timeout, stale-result and
dispose semantics are preserved. Provider throws become normal validation failures.

Provider validation receives an owned plain-data copy, protecting immutable snapshots
and caller input from casting/mutation. Validation never installs transformed output
in form state. `parseStandard` explicitly returns the provider output type and throws
`StandardSchemaError` with copied, frozen issues on invalid input. It revalidates;
there is no shared parsed-value cache that could leak stale output or cross requests.
Provider output may have types unsuitable for a form store; keep it at the API boundary.

Abort promptly stops awaiting a provider and ignores late outcomes, including rejected
promises. Standard Schema has no portable cancellation hook: abort does not physically
stop a provider's internal work/network call. Use signal-aware custom validators for
requests you need to cancel. Vendor-specific options are not forwarded by this entry point.

Vue SSR request isolation and native hydration are tested. The private Nuxt 4.6.4
example additionally passes production SSR, request-isolation and hydration tests
in Chromium, Firefox and WebKit. See [Nuxt integration](nuxt.md) for the exact scope
and build-tool security patch. No automatic-import Nuxt module or other Nuxt majors
are claimed. This entry point uses TypeScript's NoInfer utility (TypeScript 5.4+;
tested with 5.9), without changing existing entry-point declarations.

## Message localization

Valixa's built-in rules use its locale system. Provider-supplied strings remain
provider-owned: `form.setLocale()` does not translate text returned by Zod, Yup or
Valibot. Configure the provider or application translation callbacks and revalidate.
If replacing a schema object, create a new adapter and form owner; reassigning a
local variable does not update an existing adapter's captured schema. In SSR, keep
request-specific locale configuration isolated between requests.
