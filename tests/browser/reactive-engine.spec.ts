import { expect, test } from '@playwright/test';

for (const [framework, port] of [['React/MUI', 4173], ['Vue/Vuetify', 4174], ['Angular/Material', 4175]] as const) {
  test(`${framework} conditional nested fields, live localization and stable dynamic rows`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}`); await page.getByRole('button', { name: 'Reactive engine', exact: true }).click();
    const city = page.getByRole('textbox', { name: 'City', exact: true }); await expect(city).toHaveCount(0);
    await page.getByLabel('Country code').fill('EG'); await expect(city).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('button', { name: 'Switch language' }).click(); await expect(page.getByText('المدينة مطلوب.', { exact: true })).toBeVisible();
    await city.fill('Cairo'); await page.getByRole('button', { name: 'Add address' }).click();
    const rows = page.getByTestId('address-row'); const key = await rows.nth(0).getAttribute('data-row-key');
    await rows.nth(0).getByRole('textbox', { name: 'Address city', exact: true }).fill('Cairo');
    await rows.nth(0).getByRole('textbox', { name: 'Confirm city', exact: true }).fill('wrong');
    await expect(rows.nth(0).getByRole('textbox', { name: 'Confirm city', exact: true })).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('button', { name: 'Add address' }).click();
    await rows.nth(1).getByRole('textbox', { name: 'Address city', exact: true }).fill('Giza');
    await page.getByRole('button', { name: 'Move first down' }).click();
    await expect(rows.nth(1)).toHaveAttribute('data-row-key', key!); await expect(rows.nth(1).getByRole('textbox', { name: 'Confirm city', exact: true })).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('button', { name: 'Remove first' }).click(); await expect(rows).toHaveCount(1);
    await rows.nth(0).getByRole('textbox', { name: 'Confirm city', exact: true }).fill('Cairo');
    await page.getByRole('button', { name: 'Save reactive' }).click();
    await expect(page.getByLabel('Reactive result')).toHaveText(JSON.stringify({ country: 'EG', user: { city: 'Cairo' }, addresses: [{ city: 'Cairo', confirm: 'Cairo' }] }));
    await page.getByRole('button', { name: 'Reset reactive' }).click(); await expect(rows).toHaveCount(0); await expect(city).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
