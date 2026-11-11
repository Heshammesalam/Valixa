# valixa-mui

Explicit prop adapters for Material UI 7.3 and Valixa React. React, MUI and Emotion
are peers, never bundled. MUI X 8 is an optional peer used only by `valixa-mui/x`.
The base entry works without MUI X; the React package works without MUI.

```tsx
import { useValixa } from 'valixa-react';
import { useMuiField } from 'valixa-mui';
import { TextField } from '@mui/material';

function Login() {
  const form = useValixa({ email: ['', 'required | email'] });
  const email = useMuiField(form, 'email');
  return <TextField label="Email" {...email.textField()} />;
}
```

`useMuiField(form, name)` is the hook and field subscription boundary. Its prop
mapping methods are ordinary functions, with no hidden hooks. There is deliberately
no subscription-hiding `form.field()` API. Keep individual inputs in separate
components and whole-form status in `useValixaState` components for render isolation.

The result includes the low-level `FieldBinding` (`state`, `error`, `id`, `errorId`,
`name`, stable `setValue` and `onBlur`) plus:

| Method/property | Component contract |
| --- | --- |
| `textField({ type?, parse?, helperText? }?)` | String/nullable string → controlled TextField; null/undefined render as empty string |
| `numberField({ emptyValue, helperText? })` | Numeric/nullable numeric → TextField type number; finite numbers on edit; empty/invalid raw input uses the explicit typed empty value |
| `checkbox()` | Boolean/nullable boolean → checked and `(event, checked)`; null renders unchecked |
| `switch()` | Boolean/nullable boolean → Switch checked contract |
| `select(options)` | Select value/event contract; `multiple: true` required for array fields; scalar uses `{}`; optional `parse(unknown)` transforms payloads |
| `radioGroup()` | String/nullable string → RadioGroup `(event, value)` |
| `radio()` | Per-Radio disabled, readonly and ARIA props; use on every child Radio |
| `autocomplete(options)` | Explicit single/multiple value callback, equality, and `renderInput` forwarding |
| `formControlProps` | Parent FormControl error/disabled flags |
| `inputLabelProps` | Label ID/htmlFor for Select; Select's labelId matches automatically |
| `helperTextProps` | FormHelperText ID, first error text and error flag |

### Select and checkbox

```tsx
const country = useMuiField(form, 'country');
const agreed = useMuiField(form, 'agreed');
return <>
  <FormControl {...country.formControlProps}>
    <InputLabel {...country.inputLabelProps}>Country</InputLabel>
    <Select label="Country" {...country.select({})}>
      <MenuItem value="EG">Egypt</MenuItem>
    </Select>
    <FormHelperText {...country.helperTextProps} />
  </FormControl>
  <FormControl {...agreed.formControlProps}>
    <FormControlLabel label="Agree" control={<Checkbox {...agreed.checkbox()} />} />
    <FormHelperText {...agreed.helperTextProps} />
  </FormControl>
</>;
```

For multiple Select, normal arrays are preserved; browser-autofill comma-delimited
strings are split as documented by MUI. Use `parse` for numeric/native-select
coercion or a custom serialized representation. No component detection occurs.

### Autocomplete

```tsx
const city = useMuiField(form, 'city'); // string | null
<Autocomplete options={['Cairo', 'Giza']}
  {...city.autocomplete({ multiple: false, label: 'City' })} />;

const members = useMuiField(form, 'members'); // { id: number; label: string }[]
<Autocomplete options={options} getOptionLabel={item => item.label}
  {...members.autocomplete({ multiple: true, label: 'Members',
    isOptionEqualToValue: (a, b) => a.id === b.id })} />;
```

`multiple` is explicit and must match the field type. Null single values render as
null and null multiple values as an empty array. Object options **require** an
explicit equality callback because core copies objects. `renderInput` preserves
MUI's ref, input props, adornments and ARIA wiring. Supply option labels and options
yourself. Free-solo and disable-clearable variants need a custom adapter in this
release. Those variants change the value type and are not advertised by this API.

### Optional DatePicker

```tsx
import { useMuiDateField } from 'valixa-mui/x';
import type { DateCodec } from 'valixa-mui/x';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

const codec: DateCodec<string | null> = {
  decode: value => value ? dayjs(value) : null,
  encode: (date, context) => context.validationError ? 'invalid' : date?.format('YYYY-MM-DD') ?? null
};
// Blueprint: { date: { initial: null as string | null,
//   validate: (value: string | null) => value !== 'invalid' || 'Choose a valid date.' } }
const date = useMuiDateField(form, 'date', codec);
<LocalizationProvider dateAdapter={AdapterDayjs}>
  <DatePicker label="Start date" {...date} />
</LocalizationProvider>;
```

Core remains plain-data-only. A required `DateCodec<T>` maps library instances to
your chosen plain representation, including invalid edits. `encode` receives the
picker's change context, allowing an invalid sentinel to reach a normal core
validator instead of silently retaining an older valid date. `decode` must accept
that sentinel. Declare matching blueprint validation; picker min/max/format rules
do not replace core submission rules. DatePicker's own error state is preserved
when there is no core error. The adapter supplies core errors, flags, input IDs and
blur through text-field slot props. Install your date library and supply its
LocalizationProvider. Dayjs is the date implementation tested in this repository.

## Behavior and customization

Errors use the first core message, with connected helper IDs and `aria-invalid`.
Labels remain application-owned. Disabled/readonly flags flow through bindings;
the event writer also checks current store flags to prevent stale events bypassing
them. Programmatic core writes remain allowed. Blur calls core `setTouched`;
validation triggers retain core semantics. Submit/manual remains the default.

Spread adapter props after application props to keep the binding authoritative.
For custom slot content, merge the returned slot props rather than replacing them;
preserve Autocomplete's refs, adornments, events and IDs. Use `defineAdapter` from
`valixa-react` for a different component contract. No Controller wrapper required.

ESM with declarations. This release declares narrow peer ranges for the tested
major versions. Browser evidence is Chromium on Windows; no Firefox/WebKit/mobile,
full accessibility conformance, or other MUI major compatibility claim is made.

## Optional Auto Forms and DevTools

Phase 6 adds valixa-mui/auto with valixa-react/auto. Install valixa-auto explicitly when using these optional entries. Manual root exports remain independent. Dates require explicit codecs; custom renderer registries and group/row metadata are application-owned.
See docs/phase-6.md in the repository for examples, capabilities, privacy and compatibility limits.
