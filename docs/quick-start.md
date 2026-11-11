# Quick Start / JavaScript

```js
import { createValixa } from 'valixa';

const form = createValixa({
  email: ['', 'required | email'],
  password: ['', 'required | min:8']
});
form.setValue('email', 'user@example.com');
form.setValue('password', 'example-password');
const result = await form.submit(async (values, { signal }) => {
  // Return the result of your authenticated application request.
  // Revalidate values on the server; pass signal to abort-aware network APIs.
  return { saved: true };
});
if (result.status === 'invalid') {
  // Display result.errors using text nodes/framework text interpolation.
}
if (result.status === 'success') {
  // result.data is the submit handler's return value.
}
form.dispose();
```

Read `form.state` for the current immutable snapshot. Subscribe with `form.subscribe`
or `form.subscribeField` and invoke the returned disposer when leaving the view.
Framework owners already manage their native lifecycle. Core values are copied on
entry and frozen on reads; use setValue/setValues rather than mutation.

Rules are explicit: required, email, url, min/max length, minValue/maxValue, same.
Unknown/malformed rules throw during blueprint creation. Custom validators may return
true, false or a literal error string, synchronously or asynchronously.

Use `form.setError('email', 'Email is already registered.')` for an authenticated
server response; fresh validation may replace it. Catch thrown submit-handler failures
and display a request error. A duplicate submit returns busy; cancellation/obsolete
work has its own result status. Do not treat every settled submit promise as success.

Working runnable equivalents: examples/core/login.js and login.ts. Framework
ownership/control examples are linked from the documentation index.
