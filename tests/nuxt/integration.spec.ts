import { expect, test } from '@playwright/test';
test('Nuxt production SSR isolates requests and hydrates native schema bindings', async ({ page, request }) => {
  const [first, second] = await Promise.all([
    request.get('/?email=first%40example.com'), request.get('/?email=second%40example.com')
  ]);
  expect(first.ok()).toBe(true); expect(second.ok()).toBe(true);
  const firstHtml = await first.text(), secondHtml = await second.text();
  expect(firstHtml).toContain('value="first@example.com"');
  expect(secondHtml).toContain('value="second@example.com"'); expect(secondHtml).not.toContain('first@example.com');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/hydration/i.test(message.text()) && ['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  await page.goto('/?email=FIRST%40example.com');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('FIRST@example.com');
  await page.getByLabel('Email', { exact: true }).fill('bad');
  await expect(page.getByRole('alert')).toHaveText('Enter a valid email');
  await page.getByLabel('Email', { exact: true }).fill('CUSTOMER@example.com');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status', { name: 'Profile result' })).toHaveText('customer@example.com');
  expect(errors).toEqual([]);
});
