import { expect, test } from '@playwright/test';

for (const [framework, port] of [['React', 4173], ['Vue', 4174]] as const) {
  test(`${framework} purchase order: conditional rules, stable rows, typed output, server errors and cancellation`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByRole('button', { name: 'Purchase order', exact: true }).click();
    await page.getByRole('button', { name: 'Place order', exact: true }).click();
    await expect(page.getByText('Enter a valid email', { exact: true })).toBeVisible();
    await page.getByLabel('Customer email', { exact: true }).fill('blocked@example.com');
    if (framework === 'Vue') await page.getByLabel('Delivery', { exact: true }).selectOption('ship');
    else { await page.getByRole('combobox', { name: /^Delivery/ }).click(); await page.getByRole('option', { name: 'Ship', exact: true }).click(); }
    await expect(page.getByText('Shipping address is required', { exact: true })).toBeVisible();
    await page.getByLabel('Shipping address', { exact: true }).fill('Cairo');
    await page.getByLabel('Quantity', { exact: true }).fill('0');
    await expect(page.getByText('Quantity must be at least 1', { exact: true })).toBeVisible();
    await page.getByLabel('Quantity', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Place order', exact: true }).click();
    await expect(page.getByText('This email cannot place orders', { exact: true })).toBeVisible();
    await page.getByLabel('Customer email', { exact: true }).fill('customer@example.com');
    const firstKey = await page.getByTestId('order-row').getAttribute('data-row-key');
    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    await page.getByLabel('Product code', { exact: true }).nth(1).fill('PEN');
    await page.getByRole('button', { name: 'Move first item down', exact: true }).click();
    expect(await page.getByTestId('order-row').nth(1).getAttribute('data-row-key')).toBe(firstKey);
    await expect(page.getByLabel('Quantity', { exact: true }).nth(1)).toHaveValue('2');
    await page.getByRole('button', { name: 'Remove first item', exact: true }).click();
    await page.getByLabel('Product code', { exact: true }).fill('TAKEN');
    await expect(page.getByRole('status', { name: 'Product availability' })).toBeVisible();
    await page.getByLabel('Product code', { exact: true }).fill('BOOK');
    await page.getByRole('button', { name: 'Place order', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Order result' })).toHaveText('cancelled');
    await page.getByRole('button', { name: 'Place order', exact: true }).click();
    const output = page.getByRole('status', { name: 'Order result' });
    await expect(output).toContainText('ORDER-1001');
    const order = JSON.parse(await output.innerText()); expect(order.items[0].quantity).toBe(2); expect(order.shipping.address).toBe('Cairo');
    await expect(page.getByText('Product is unavailable', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Reset order', exact: true }).click();
    await expect(page.getByLabel('Customer email', { exact: true })).toHaveValue('');
    await expect(page.getByTestId('order-row')).toHaveCount(1); expect(errors).toEqual([]);
  });
}
