# Angular + Material examples

From the workspace root:

```sh
pnpm install
pnpm build
pnpm example:angular
```

Open the printed development URL (port 5175). Three screens demonstrate:

1. Native login: email/password, validation, async submit and reset.
2. Material registration: all account fields, async username (`taken` fails),
   country/terms, loading and mapped 422 errors (`used@example.com` fails).
3. Advanced Material: object autocomplete with draft rejection, multiple object
   selection with compareWith, datepicker/civil-date codec, numeric budget, radio,
   slide toggle, custom payload-based counter, reset and disabled/readonly state.

The API is simulated locally, with AbortSignal support. Nothing is sent and no
credentials are logged. The app uses native novalidate forms, stable setup callbacks
and explicit rejection handling. No Angular Forms state/validators are created.

`pnpm --filter @valixa/example-angular build` runs a strict production AOT build
and prerenders the native initial route. `pnpm --filter @valixa/example-angular
preview` serves that output on port 4175. `pnpm test:browser` covers all apps after
`pnpm examples:build`.

The initial native screen uses provideClientHydration with explicit form IDs.
Browser tests verify hydration metadata and reuse of the actual server input node,
then interact with that binding. Material SSR also has a separate Node render test;
Material screens/popups are exercised after client navigation, so blanket popup or
incremental hydration coverage is not claimed.
