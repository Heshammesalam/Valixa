import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as z from 'zod';
import * as yup from 'yup';
import * as v from 'valibot';
import { blueprint, collection, createValixa, nested } from 'valixa';
import { parseStandard, standardFormValidator, standardValidator, StandardSchemaError } from 'valixa/standard';
import type { StandardSchemaV1 } from 'valixa/standard';

describe('Standard Schema providers', () => {
  const schemas = [
    ['Zod', z.object({ email: z.email('Invalid email') })],
    ['Yup', yup.object({ email: yup.string().email('Invalid email').required() })],
    ['Valibot', v.object({ email: v.pipe(v.string(), v.email('Invalid email')) })]
  ] as const;
  for (const [vendor, schema] of schemas) it(`${vendor}: whole form validates and recovers without a vendor adapter`, async () => {
    const definition = blueprint({ email: ['bad'] });
    const form = createValixa(definition, { validateForm: standardFormValidator(schema, definition) });
    expect((await form.validate()).valid).toBe(false);
    expect(form.state.errors.email).toEqual(['Invalid email']);
    form.setValue('email', 'user@example.com');
    expect((await form.submit(values => values.email)).status).toBe('success');
    expect(form.state.errors.email).toBeUndefined(); form.dispose();
  });
  it('supports field validation and explicit typed transformed output', async () => {
    const schema = z.string().min(1).transform(Number);
    const form = createValixa({ quantity: { initial: '12', validate: standardValidator(schema) } });
    const result = await form.submit(async (values, { signal }) => parseStandard(schema, values.quantity, { signal }));
    expect(result).toEqual({ status: 'success', data: 12 });
    expect(form.state.values.quantity).toBe('12');
    expectTypeOf(await parseStandard(schema, '3')).toEqualTypeOf<number>();
    if (false) {
      // @ts-expect-error schema input is a string
      await parseStandard(schema, 3);
      // @ts-expect-error validator input is a string
      standardValidator(schema)(3, { field: 'quantity', values: {}, signal: new AbortController().signal });
      // @ts-expect-error form schema has incompatible input
      standardFormValidator(z.object({ quantity: z.number() }), blueprint({ quantity: [''] }));
    }
    form.dispose();
  });
  it('accepts schemas with optional/defaulted inputs when form values are a valid subset', async () => {
    const definition = blueprint({ email: [''] });
    const form = createValixa(definition, { validateForm: standardFormValidator(z.object({ email: z.string().optional() }), definition) });
    expect((await form.validate()).valid).toBe(true); form.dispose();
    expect(await parseStandard(yup.string().trim().lowercase().required(), '  USER  ')).toBe('user');
    expect(await parseStandard(v.pipe(v.string(), v.transform(Number)), '4')).toBe(4);
  });
  it('maps literal dotted names, nested escaped paths and collection issues', async () => {
    const definition = blueprint({ 'a.b': [''], profile: nested({ 'first.name': [''] }), rows: collection({ name: [''] }, [{ name: '' }]) });
    const schema = z.object({ 'a.b': z.string().min(1, 'Literal'), profile: z.object({ 'first.name': z.string().min(1, 'Nested') }), rows: z.array(z.object({ name: z.string().min(1, 'Row') })) });
    const form = createValixa(definition, { validateForm: standardFormValidator(schema, definition) });
    await form.validate();
    expect(form.state.errors['a.b']).toEqual(['Literal']);
    expect(form.state.errors['profile.first\\.name']).toEqual(['Nested']);
    expect(form.state.errors.rows).toEqual(['Row']); form.dispose();
  });
  it('keeps root/unmatched/unsafe issue paths visible without prototype writes', async () => {
    const schema: StandardSchemaV1<{ name: string }> = { '~standard': { version: 1, vendor: 'fixture', validate: () => ({ issues: [
      { message: 'Root' }, { message: 'Unsafe', path: ['__proto__', 'polluted'] }, { message: 'Unknown', path: [Symbol('key')] }, { message: 'Name', path: [{ key: 'name' }] }
    ] }) } };
    const definition = blueprint({ name: [''] });
    const form = createValixa(definition, { validateForm: standardFormValidator(schema, definition) });
    await form.validate(); expect(form.state.formErrors).toEqual(['Root', 'Unsafe', 'Unknown']);
    expect(form.state.errors.name).toEqual(['Name']); expect({}).not.toHaveProperty('polluted'); form.dispose();
  });
  it('does not let provider mutation affect caller-owned or frozen form data', async () => {
    const schema: StandardSchemaV1<{ email: string }> = { '~standard': { version: 1, vendor: 'mutating', validate(input) {
      (input as { email: string }).email = 'changed'; return { value: input as { email: string } };
    } } };
    const input = { email: 'original' }; expect(await parseStandard(schema, input)).toEqual({ email: 'changed' }); expect(input.email).toBe('original');
    const definition = blueprint({ email: ['original'] }); const form = createValixa(definition, { validateForm: standardFormValidator(schema, definition) });
    expect((await form.validate()).valid).toBe(true); expect(form.state.values.email).toBe('original'); form.dispose();
  });
  it('aborts promptly and ignores late rejected work without unhandled rejection', async () => {
    let reject!: (error: Error) => void;
    const schema: StandardSchemaV1<string> = { '~standard': { version: 1, vendor: 'async', validate: () => new Promise((_, fail) => { reject = fail; }) } };
    const controller = new AbortController(); const parsing = parseStandard(schema, '', { signal: controller.signal });
    await Promise.resolve(); controller.abort(); await expect(parsing).rejects.toMatchObject({ name: 'AbortError' }); reject(new Error('Late'));
    const stopped = new AbortController(); stopped.abort(); const validate = vi.fn();
    await expect(parseStandard({ '~standard': { version: 1, vendor: 'fixture', validate } }, '', { signal: stopped.signal })).rejects.toMatchObject({ name: 'AbortError' }); expect(validate).not.toHaveBeenCalled();
  });
  it('preserves form stale-result protection and exception/timeout handling', async () => {
    let resolve!: (value: { issues: { message: string; path: string[] }[] }) => void;
    const schema: StandardSchemaV1<{ email: string }> = { '~standard': { version: 1, vendor: 'async', validate: () => new Promise(done => { resolve = done; }) } };
    const definition = blueprint({ email: ['before'] }); const form = createValixa(definition, { validateForm: standardFormValidator(schema, definition) });
    const validation = form.validate(); await Promise.resolve(); await Promise.resolve(); form.setValue('email', 'after');
    expect((await validation).stale).toBe(true); resolve({ issues: [{ path: ['email'], message: 'Old' }] });
    await Promise.resolve(); expect(form.state.errors.email).toBeUndefined(); form.dispose();
    const failing = createValixa(definition, { validateForm: standardFormValidator({ '~standard': { version: 1, vendor: 'fail', validate: () => { throw Error('Provider'); } } }, definition) });
    expect((await failing.validate()).valid).toBe(false); expect(failing.state.formErrors).toHaveLength(1); failing.dispose();
    const timeout = createValixa(definition, { validateForm: standardFormValidator(schema, definition), validation: { timeout: 5 } });
    expect((await timeout.validate()).valid).toBe(false); expect(timeout.state.formErrors.join(' ')).toMatch(/timed out/i); timeout.dispose();
  });
  it('awaits actual provider asynchronous refinements', async () => {
    const schema = z.string().refine(async value => value === 'ready', 'Not ready');
    await expect(parseStandard(schema, 'ready')).resolves.toBe('ready');
    await expect(parseStandard(schema, 'waiting')).rejects.toBeInstanceOf(StandardSchemaError);
  });
  it('rejects invalid protocols/results and preserves immutable issue details', async () => {
    expect(() => standardValidator({} as StandardSchemaV1)).toThrow('Standard Schema v1');
    const bad = { '~standard': { version: 1, vendor: 'bad', validate: () => ({ issues: [] }) } } as StandardSchemaV1;
    await expect(parseStandard(bad, '')).rejects.toThrow('Invalid Standard Schema result');
    try { await parseStandard(z.string().min(3), ''); throw Error('Expected failure'); } catch (error) {
      expect(error).toBeInstanceOf(StandardSchemaError); expect(Object.isFrozen((error as StandardSchemaError).issues)).toBe(true);
    }
  });
});
