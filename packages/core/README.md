# @valixa/core

Framework-independent form state, validation, subscriptions and submission.
ESM and TypeScript declarations, with no runtime dependencies.

```js
import { createValixa } from '@valixa/core';

const form = createValixa({ email: ['', 'required | email'] });
form.setValue('email', 'user@example.com');
const result = await form.validate();
if (result.valid) await form.submit(async data => data.email);
form.dispose();
```

Core API: `blueprint`, `createValixa`, `nested`, `collection`, `registerLocale`, `parseRules`, `RuleSyntaxError`,
`defaultMessages`, `Blueprint`, `ValixaForm`, plus public TypeScript contracts.
Use `form.state` to read immutable snapshots, `subscribe` / `subscribeField` to
observe them, and `handleSubmit` for an event callback.

Supported rules: required, email, url, min/max length, minValue/maxValue, same.
Custom and asynchronous validators are supported with abort signals and stale-result
protection. Values are acyclic plain data. Existing object/array fields stay atomic;
explicit `nested` and `collection` constructors opt into typed paths and stable rows.
Dependency graphs, field scheduling, conditional behaviors, form validation and
English/Arabic localization are included. Framework bindings remain separate packages.
See [API.md](API.md) and the [advanced guide](ADVANCED.md) for semantics and examples.

MIT license. This initial version has not been published.
