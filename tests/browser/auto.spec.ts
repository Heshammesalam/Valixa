import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

for (const [framework, port] of [['react', 4173], ['vue', 4174], ['angular', 4175]] as const) {
  test(`${framework} generated form validates, preserves row identity and exposes redacted local diagnostics`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}`);
    const timings: Record<string, number> = {};
    let start = performance.now(); await page.getByRole('button', { name: 'Auto Form', exact: true }).click(); await expect(page.getByLabel(/Full name/)).toBeVisible(); timings.initialRender = performance.now() - start;
    const form = page.locator('form');
    await form.getByRole('button', { name: 'Save generated', exact: true }).click(); await expect(page.getByRole('alert', { name: 'Form errors' })).toBeVisible();
    await page.getByLabel(/Full name/).fill('taken'); await expect(form.getByText('Name is unavailable.', { exact: true }).first()).toBeVisible();
    start = performance.now(); await page.getByLabel(/Full name/).fill('Ada'); await expect(page.getByLabel(/Full name/)).toHaveValue('Ada'); timings.singleFieldUpdate = performance.now() - start;
    await page.getByLabel(/Email address/).fill('ada@example.com'); await page.getByLabel(/Password/).fill('secret-password');
    await page.getByLabel(/Age/).fill('24');
    start = performance.now(); if (framework === 'vue') await page.getByRole('combobox', { name: 'Country', exact: true }).press('ArrowDown'); else await page.getByRole('combobox', { name: 'Country', exact: true }).click(); await page.getByRole('option', { name: 'Egypt', exact: true }).click(); await expect(page.getByLabel(/Profile city/)).toBeVisible(); timings.conditionalUpdate = performance.now() - start;
    await page.getByLabel(/Profile city/).fill('Cairo');
    await page.getByRole('combobox', { name: 'Office', exact: true }).fill('Cai'); await page.getByRole('option', { name: 'Cairo', exact: true }).click();
    if (framework === 'vue') await page.getByRole('combobox', { name: 'Skills', exact: true }).press('ArrowDown'); else await page.getByRole('combobox', { name: 'Skills', exact: true }).click(); await page.getByRole('option', { name: 'TypeScript', exact: true }).click(); await page.keyboard.press('Escape');
    await page.getByLabel(/Start date/).fill(framework === 'angular' ? '11/10/2026' : '2026-11-10'); await page.getByLabel(/Start date/).press('Tab');
    await page.getByRole('radio', { name: 'Pro', exact: true }).check(); await page.getByLabel(/Notes/).fill('Generated UI'); await page.getByRole('checkbox', { name: 'I agree', exact: true }).check(); await page.getByRole('button', { name: 'Add seat' }).click();
    start = performance.now(); await page.getByRole('button', { name: 'Add address', exact: true }).click(); await expect(page.getByLabel(/Address city/)).toBeVisible(); timings.dynamicRow = performance.now() - start;
    await page.getByLabel(/Address city/).fill('Cairo'); const first = await page.locator('[data-valixa-row]').getAttribute('data-valixa-row');
    await page.getByRole('button', { name: 'Add address', exact: true }).click(); await page.getByLabel(/Address city/).nth(1).fill('Giza'); await page.getByRole('button', { name: 'Move row 2 up' }).click(); expect(await page.locator('[data-valixa-row]').nth(1).getAttribute('data-valixa-row')).toBe(first);
    await page.getByRole('button', { name: 'Remove row', exact: true }).first().click();
    await form.getByRole('button', { name: 'Save generated', exact: true }).click(); const result = page.getByLabel('Generated result'); await expect(result).toContainText('ada@example.com');
    const values = JSON.parse(await result.textContent() || '{}'); expect(values).toMatchObject({ name: 'Ada', age: 24, country: 'EG', profile: { city: 'Cairo' }, office: { id: 'cairo' }, tags: ['ts'], day: '2026-11-10', plan: 'pro', seats: 2, addresses: [{ city: 'Cairo' }] }); expect(values).not.toHaveProperty('password');
    const tools = page.getByRole('region', { name: 'Valixa DevTools' }); await expect(tools).not.toContainText('secret-password'); await expect(tools).not.toContainText('ada@example.com'); await expect(tools.getByLabel('Lifecycle event timeline')).toContainText('submit.succeeded');
    await tools.getByText('Dependency graph', { exact: true }).click(); await expect(tools.getByRole('img', { name: 'Validation dependency graph' })).toBeVisible();
    await tools.getByRole('button', { name: 'Pause recording' }).click(); await page.getByLabel(/Notes/).fill('Paused'); await expect(tools.getByRole('button', { name: 'Resume recording' })).toBeVisible(); await tools.getByRole('button', { name: 'Resume recording' }).click();
    await tools.getByRole('searchbox', { name: 'Search diagnostics' }).fill('submit.succeeded'); await expect(tools.locator('ol li')).toHaveCount(1); await tools.getByRole('searchbox').fill('');
    await form.getByRole('button', { name: 'Reset', exact: true }).click(); await expect(page.getByLabel(/Full name/)).toHaveValue(''); await expect(page.locator('[data-valixa-row]')).toHaveCount(0); await expect(result).toBeEmpty();
    await tools.getByRole('button', { name: 'Clear timeline' }).click(); await expect(tools.locator('ol li')).toHaveCount(0);
    expect(errors).toEqual([]);
    mkdirSync('artifacts/phase-6', { recursive: true }); writeFileSync(`artifacts/phase-6/${framework}-browser-latency.json`, JSON.stringify({ framework, methodology: 'One production Chromium flow; wall-clock action-to-visible latency including Playwright transport, UI libraries, DevTools and async validation; diagnostic measurements, no timing assertions.', milliseconds: timings }, null, 2));
  });
}
