# React example application

From the workspace root:

```sh
pnpm install
pnpm build
pnpm example:react
```

Open the URL printed by Vite. The three navigation buttons select complete forms:

1. Native HTML login: required/email/password validation and async submission.
2. MUI registration: name/email/password/confirmation, terms checkbox, country
   Select and username validation. `taken` simulates an unavailable username.
3. Advanced MUI: single and multiple Autocomplete, numeric budget, optional Dayjs
   DatePicker, custom payload-based seat counter, Switch and RadioGroup, reset and
   async server errors. Giza simulates a 422 field error; Cairo succeeds.

The API is simulated in memory. No values are transmitted. Password values are
never logged. Event handlers explicitly catch submission rejections. Registration
puts fields and submit state in separate components to demonstrate subscription
isolation; the compact advanced example subscribes its parent to several fields.

Production build and Chromium verification:

```sh
pnpm examples:build
pnpm exec playwright install chromium
pnpm test:browser
```

The browser tests serve the production build, not a development-only source alias.
The combined example includes the full picker and MUI component set in one bundle;
applications should split routes according to their own needs.
