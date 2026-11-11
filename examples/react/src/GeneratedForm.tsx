import { useEffect, useState } from 'react';
import { useValixa } from '@valixa/react';
import { ValixaAutoForm, defineReactAutoRenderer } from '@valixa/react/auto';
import { createMuiAutoAdapter } from '@valixa/mui/auto';
import { attachValixaDevtools } from '@valixa/devtools';
import type { ValixaInspection } from '@valixa/devtools';
import { ValixaDevtools } from '@valixa/react/devtools';
import { generatedSchema, generatedOptions, generatedUI, stringDate, saveGenerated } from '../../shared/generated.js';
const Counter = defineReactAutoRenderer<number>(({ field, config }) => <button type="button" aria-label="Add seat" disabled={field.state.disabled || field.state.readonly} onClick={() => field.setValue(field.state.value + 1)}>{config.label}: {field.state.value}</button>);
const adapter = createMuiAutoAdapter({ custom: { counter: Counter }, codecs: { civilDate: stringDate } });
export function GeneratedForm() {
  const form = useValixa(generatedSchema, generatedOptions), [result, setResult] = useState(''), [tools, setTools] = useState<ValixaInspection[]>([]);
  useEffect(() => { const inspection = attachValixaDevtools(form, { name: 'Generated registration', historyLimit: 60 }); setTools([inspection]); const off = form.observeEvents(() => setResult(''), { types: ['form.reset'] }); return () => { off(); inspection.detach(); }; }, [form]);
  return <><h2>Auto Form</h2><p>Explicit UI metadata, custom controls and local diagnostics.</p><ValixaAutoForm form={form} ui={generatedUI} adapter={adapter} onSubmit={saveGenerated} onResult={result => { if (result.status === 'success') setResult(result.data); }} /><output aria-label="Generated result">{result}</output><ValixaDevtools inspections={tools} /></>;
}
