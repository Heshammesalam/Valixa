# Vue + Vuetify examples

From the workspace root:

```sh
pnpm install
pnpm build
pnpm example:vue
```

Open Vite's printed URL. Select Native Vue, Registration or Advanced.

- Native login: validation, async submit, accessible errors and reset.
- Registration: all required account fields, async username availability (`taken`
  fails), country and terms, loading and mapped server errors (`used@example.com`
  simulates 422). Edit email and retry to succeed.
- Advanced: real Autocomplete, multiple Select, object/string Combobox, textarea,
  numeric budget, Switch, RadioGroup, custom seat control and file input. Only file
  metadata enters core; byte references remain in the adapter. Includes readonly
  toggling and unconditional reset of form and local files.

All APIs are simulated in memory. No form values are transmitted or credentials
logged. SVG icons/styles come from the local Vuetify package. Native forms use
`novalidate`; Valixa is the validation authority.

Run `pnpm examples:vue:build` for a production build and `pnpm test:browser` after
building both example apps for Chromium checks. `vue-tsc` runs in strict mode and
checks declared component props and adapter value types. The sole template option
override, `checkUnknownProps: false`, permits Vuetify's valid fallthrough native
attributes/events (e.g. VBtn type/click and VAlert role), absent from its declared
props. It does not disable type checks for declared model props or adapter options.
