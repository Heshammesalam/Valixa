# valixa-angular-devtools

Optional standalone Angular binding for the shared native DevTools panel. Requires
Angular 21.2 and valixa-devtools; no Material dependency. Partial-Ivy APF.

```ts
import { ValixaDevtools } from 'valixa-angular-devtools';
import { attachValixaDevtools } from 'valixa-devtools';
// In the form owner's injection context:
const inspection = attachValixaDevtools(form.core, { name: 'Registration' });
inject(DestroyRef).onDestroy(() => inspection.detach());
```

```html
<valixa-devtools [inspections]="[inspection]"/>
```

Panel mounting uses afterNextRender and is SSR safe. Destroy/update releases panel
subscriptions. The panel borrows controllers; it never attaches a form implicitly
and does not detach inspections on component destruction. The attaching owner must
detach. Values/messages are redacted by default; no network/storage is used. Gate
attachment and optional imports to development builds.

See valixa-devtools and docs/phase-6.md in the repository for privacy, bounds and events.
