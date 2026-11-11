import { GeneratedForm } from './GeneratedForm.js';
import { StrictMode, useState } from 'react';
import { ReactiveForm } from './ReactiveForm.js';
import { createRoot } from 'react-dom/client';
import { Alert, Autocomplete, Box, Button, Checkbox, Chip, Container, CssBaseline, FormControl, FormControlLabel, FormHelperText, InputLabel, MenuItem, Paper, Radio, RadioGroup, Select, Stack, Switch, TextField, ThemeProvider, Typography, createTheme } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { blueprint } from 'valixa';
import type { ValixaForm } from 'valixa';
import { connectValixa, defineAdapter, nativeText, useValixa, useValixaAdapter, useValixaState } from 'valixa-react';
import { useMuiField } from 'valixa-mui';
import { useMuiDateField } from 'valixa-mui/x';
import type { DateCodec } from 'valixa-mui/x';

const theme = createTheme({ palette: { primary: { main: '#315c51' }, background: { default: '#f4f6f3' } }, typography: { fontFamily: 'Inter, system-ui, sans-serif' }, shape: { borderRadius: 12 } });
function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    function abort() { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function NativeLogin() {
  const form = useValixa({ email: ['', 'required | email'], password: ['', 'required | min:8'] });
  const email = useValixaAdapter(form, 'email', nativeText), password = useValixaAdapter(form, 'password', nativeText);
  const state = useValixaState(form); const [message, setMessage] = useState('');
  return <form noValidate onSubmit={event => {
    setMessage('');
    void form.handleSubmit(async (_, { signal }) => { await delay(300, signal); setMessage('Login complete.'); })(event)
      .catch(() => setMessage('Login request failed. Please retry.'));
  }}><Stack spacing={2}>
    <Typography variant="h5" component="h2">Native login</Typography>
    <Typography color="text.secondary">Your HTML, with Valixa handling state and validation.</Typography>
    <label htmlFor={email.id}>Email</label><input {...email} type="email" autoComplete="email" style={{ padding: 12 }} />
    {state.errors.email?.[0] && <span id={email['aria-describedby']} role="alert">{state.errors.email[0]}</span>}
    <label htmlFor={password.id}>Password</label><input {...password} type="password" autoComplete="current-password" style={{ padding: 12 }} />
    {state.errors.password?.[0] && <span id={password['aria-describedby']} role="alert">{state.errors.password[0]}</span>}
    <Button type="submit" variant="contained" disabled={state.submitting}>{state.submitting ? 'Signing in…' : 'Sign in'}</Button>
    {message && <Alert severity="info">{message}</Alert>}
  </Stack></form>;
}

const registration = blueprint({
  name: ['', 'required | min:2'], email: ['', 'required | email'], password: ['', 'required | min:8'],
  confirm: ['', 'required | same:password'], username: { initial: '', rules: 'required | min:3',
    validate: async (value: string, { signal }) => { await delay(250, signal); return value !== 'taken' || 'Username is unavailable.'; } },
  agree: [false, 'required'], country: ['', 'required']
});
type Registration = typeof registration.__values;
function RegistrationText({ form, name, label, type = 'text' }: {
  form: ValixaForm<Registration>; name: 'name' | 'email' | 'password' | 'confirm' | 'username'; label: string; type?: string;
}) {
  const field = useMuiField(form, name);
  return <TextField label={label} {...field.textField({ type, helperText: field.state.validating ? 'Checking…' : name === 'username' ? 'Try “taken” to see async validation.' : '' })} />;
}
function RegistrationPreferences({ form }: { form: ValixaForm<Registration> }) {
  const country = useMuiField(form, 'country'), agree = useMuiField(form, 'agree');
  return <><FormControl {...country.formControlProps}><InputLabel {...country.inputLabelProps}>Country</InputLabel>
    <Select label="Country" {...country.select({})}><MenuItem value="EG">Egypt</MenuItem><MenuItem value="US">United States</MenuItem></Select>
    <FormHelperText {...country.helperTextProps} /></FormControl>
    <FormControl {...agree.formControlProps}><FormControlLabel label="I agree to the terms" control={<Checkbox {...agree.checkbox()} />} />
      <FormHelperText {...agree.helperTextProps} /></FormControl></>;
}
function RegistrationActions({ form }: { form: ValixaForm<Registration> }) {
  const state = useValixaState(form);
  return <Button type="submit" variant="contained" disabled={state.submitting}>{state.submitting ? 'Creating account…' : 'Create account'}</Button>;
}
function RegistrationForm() {
  const form = useValixa(registration, { validateOn: 'blur' }); const [message, setMessage] = useState('');
  return <form noValidate onSubmit={event => {
    setMessage(''); void form.handleSubmit(async (_, { signal }) => { await delay(350, signal); setMessage('Account created.'); })(event)
      .catch(() => setMessage('Registration request failed. Please retry.'));
  }}><Stack spacing={2}>
    <Typography variant="h5" component="h2">Create your account</Typography>
    <Typography color="text.secondary">Independent field subscriptions, shared form behavior.</Typography>
    <RegistrationText form={form} name="name" label="Name" /><RegistrationText form={form} name="email" label="Email" type="email" />
    <RegistrationText form={form} name="username" label="Username" /><RegistrationText form={form} name="password" label="Password" type="password" />
    <RegistrationText form={form} name="confirm" label="Confirm password" type="password" />
    <RegistrationPreferences form={form} /><RegistrationActions form={form} />
    {message && <Alert severity="info">{message}</Alert>}
  </Stack></form>;
}

type CounterProps = { label: string; value: number; onAmountChange: (payload: { amount: number }) => void; error: boolean };
function Counter({ label, value, onAmountChange, error }: CounterProps) {
  return <Box><Typography component="span">{label}: {value}</Typography>{' '}
    <Button aria-label="Increase seats" aria-invalid={error} onClick={() => onAmountChange({ amount: value + 1 })}>Add seat</Button></Box>;
}
const counterAdapter = defineAdapter<number, Omit<CounterProps, 'label'>>(field => ({
  value: field.state.value, onAmountChange: payload => field.setValue(payload.amount), error: Boolean(field.error)
}));
const SeatCounter = connectValixa(Counter, counterAdapter);
const dateCodec: DateCodec<string | null> = {
  decode: value => value ? dayjs(value) : null,
  encode: (value, context) => context.validationError ? 'invalid' : value?.format('YYYY-MM-DD') ?? null
};
function AdvancedForm() {
  const form = useValixa({ city: { initial: null as string | null, rules: 'required' },
    skills: { initial: [] as string[] }, seats: [1, 'minValue:1'], updates: [false], plan: ['basic'],
    budget: { initial: null as number | null }, date: { initial: null as string | null,
      validate: (value: string | null) => value !== 'invalid' || 'Choose a valid date.' } });
  const city = useMuiField(form, 'city'), skills = useMuiField(form, 'skills'), updates = useMuiField(form, 'updates');
  const plan = useMuiField(form, 'plan'), budget = useMuiField(form, 'budget');
  const date = useMuiDateField(form, 'date', dateCodec), state = useValixaState(form);
  const [message, setMessage] = useState('');
  return <form noValidate onSubmit={event => {
    setMessage(''); void form.handleSubmit(async (data, { signal }) => {
      await delay(400, signal);
      if (data.city === 'Giza') { form.setError('city', 'This office is full. Choose another city.'); throw new Error('422'); }
      setMessage('Preferences saved.');
    })(event).catch(() => setMessage('Could not save. Review the field errors and retry.'));
  }}><Stack spacing={2}>
    <Typography variant="h5" component="h2">Workspace preferences</Typography>
    <Typography color="text.secondary">Autocomplete, custom payloads and server errors. Giza simulates an HTTP 422 response.</Typography>
    <Autocomplete options={['Cairo', 'Giza', 'Alexandria']} {...city.autocomplete({ multiple: false, label: 'Office city' })} />
    <Autocomplete options={['React', 'TypeScript', 'Design']} {...skills.autocomplete({ multiple: true, label: 'Skills' })} />
    <TextField label="Monthly budget" {...budget.numberField({ emptyValue: null })} />
    <LocalizationProvider dateAdapter={AdapterDayjs}><DatePicker label="Start date" {...date} /></LocalizationProvider>
    <SeatCounter form={form} name="seats" label="Seats" />
    <FormControlLabel label="Email updates" control={<Switch {...updates.switch()} />} />
    <FormControl component="fieldset"><Typography id={`${plan.id}-label`}>Plan</Typography>
      <RadioGroup aria-labelledby={`${plan.id}-label`} row {...plan.radioGroup()}>
        <FormControlLabel value="basic" label="Basic" control={<Radio {...plan.radio()} />} />
        <FormControlLabel value="pro" label="Pro" control={<Radio {...plan.radio()} />} />
      </RadioGroup></FormControl>
    <Stack direction="row" spacing={1}><Button variant="contained" type="submit" disabled={state.submitting}>{state.submitting ? 'Saving…' : 'Save preferences'}</Button>
      <Button type="button" onClick={() => { form.reset(); setMessage(''); }}>Reset</Button></Stack>
    {message && <Alert severity={state.submitted ? 'success' : 'error'}>{message}</Alert>}
  </Stack></form>;
}

function App() {
  const [page, setPage] = useState<'native' | 'registration' | 'advanced' | 'reactive' | 'auto'>('native');
  return <ThemeProvider theme={theme}><CssBaseline /><Container maxWidth="sm" sx={{ py: { xs: 3, md: 7 } }}>
    <Stack spacing={3}><Box><Chip size="small" label="HEADLESS FORMS · REACT + MUI" variant="outlined" />
      <Typography variant="h3" component="h1" sx={{ mt: 2, fontWeight: 700, letterSpacing: '-0.04em' }}>Valixa</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>Your interface. One form engine.</Typography></Box>
      <Stack component="nav" aria-label="Examples" direction="row" spacing={1}>
        {(['native', 'registration', 'advanced', 'reactive', 'auto'] as const).map(tab => <Button key={tab} aria-pressed={page === tab} variant={page === tab ? 'contained' : 'outlined'}
          onClick={() => setPage(tab)}>{tab === 'auto' ? 'Auto Form' : tab === 'native' ? 'Native HTML' : tab === 'registration' ? 'Registration' : tab === 'reactive' ? 'Reactive engine' : 'Advanced'}</Button>)}
      </Stack>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 } }}>{page === 'auto' ? <GeneratedForm /> : page === 'native' ? <NativeLogin /> : page === 'registration' ? <RegistrationForm /> : page === 'reactive' ? <ReactiveForm /> : <AdvancedForm />}</Paper>
      <Typography variant="caption" color="text.secondary">Interactive examples use a local simulated API. No data leaves this page.</Typography>
    </Stack></Container></ThemeProvider>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
