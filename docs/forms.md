# Nested fields, collections, conditions, async validation and localization

```ts
import { blueprint, createValixa, nested, collection } from '@valixa/core';
const schema = blueprint({
  country: [''],
  user: nested({ city: [''] }),
  addresses: collection({ city: ['', 'required'] }),
  username: {
    initial: '', dependsOn: [],
    validate: async (value: string, { signal }) => {
      // Replace this local check with your abort-aware availability request.
      if (signal.aborted) return true;
      return value !== 'taken' || 'Username is unavailable.';
    }
  }
});
const form = createValixa(schema, {
  validation: { mode: 'onChange', debounce: 150, timeout: 5000 },
  behaviors: {
    'user.city': {
      dependsOn: ['country'],
      visibleWhen: ({ values }) => Boolean(values.country),
      requiredWhen: ({ values }) => Boolean(values.country),
      validateWhen: ({ values }) => Boolean(values.country)
    }
  },
  locale: 'en'
});
form.setValue('country', 'EG');
form.setValue('user.city', 'Cairo');
const rows = form.array('addresses');
rows.append({ city: 'Cairo' });
rows.append({ city: 'Giza' });
const first = rows.items[0]!;
rows.move(0, 1); // first.key and first.form retain identity
first.form.setValue('city', 'Alexandria');
form.setLocale('ar'); // rerenders structured messages, not literal server strings
await form.validate();
form.dispose();
```

Track row views by key, borrow row.form, and do not independently dispose a row store.
Removal/reset owns row disposal and aborts its validation. Explicit nested segments
are escaped and reserved prototype segments are rejected. Ordinary arrays/objects
remain atomic unless declared with collection/nested.

Dependencies schedule affected validation. Declare custom validator reads using
dependsOn; omitted unknown reads are conservative. A visible/disabled control is not
automatically excluded from validation or submission; use validateWhen/resetWhen
deliberately. Server constraints still apply regardless of UI flags.

Field requests and debounce timers have independent ownership. Obsolete async results
cannot commit; reset/disposal/cancelValidation abort active work. External requests
that ignore AbortSignal may continue outside the engine, though their result is stale.
Submission is separately cancellable with cancelSubmit. Await handler results and
check the discriminated status before reporting success.

English and Arabic catalogs ship in core; registerLocale adds application catalogs.
Literal server/custom messages are not implicitly translated, and document direction
is owned by the application. See packages/core/ADVANCED.md for full reference.
