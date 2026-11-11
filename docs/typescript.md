# TypeScript

```ts
import { blueprint, createValixa, nested, collection } from 'valixa';

const schema = blueprint({
  user: nested({ email: ['', 'required | email'] }),
  age: [18],
  addresses: collection({ city: ['', 'required'] })
});
type Values = typeof schema.__values;
const form = createValixa(schema);
form.setValue('user.email', 'user@example.com');
form.setValue('age', 21);
form.array('addresses').append({ city: 'Cairo' });
const email: string = form.state.values.user.email;
```

Unknown field paths and incompatible values are compile-time errors. `nested(...)`
opts into paths; an ordinary object-valued field remains atomic. Collections expose
row-local fields through row.form and stable row.key, not permanent index paths.
Use `{initial: null as string | null}` to author nullable domains deliberately.

Snapshots are deeply readonly. Do not cast away readonly or use any to bypass an
incompatible UI codec. Numeric empty policies and dates are explicit in adapters.
`defineAutoForm(schema, config)` establishes typed UI paths/value compatibility.
Vue component prop generic erasure and custom Angular registry keys have the documented
limits in the Auto Forms guide; type the authoring metadata and handler explicitly.

Public declarations and negative inference fixtures are checked in pnpm check and
independent installed-consumer builds. JavaScript uses the same runtime APIs.
