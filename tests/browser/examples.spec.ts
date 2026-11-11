import { expect, test } from '@playwright/test';

test('native login validates and submits in Strict Mode', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('email is required.')).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveAccessibleDescription('email is required.');
  await page.getByLabel('Email', { exact: true }).fill('user@example.com');
  await page.getByLabel('Password', { exact: true }).fill('long-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Login complete.')).toBeVisible();
});

test('registration handles async validation, checkbox, select and submit', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Registration', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Ada Lovelace');
  await page.getByLabel('Email', { exact: true }).fill('ada@example.com');
  await page.getByLabel('Username', { exact: true }).fill('taken');
  await page.getByLabel('Username', { exact: true }).press('Tab');
  await expect(page.getByText('Username is unavailable.')).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('long-password');
  await page.getByLabel('Username', { exact: true }).fill('ada');
  await page.getByLabel('Confirm password', { exact: true }).fill('long-password');
  await page.getByRole('combobox', { name: 'Country' }).click(); await page.getByRole('option', { name: 'Egypt' }).click();
  await page.getByRole('checkbox', { name: 'I agree to the terms' }).check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Account created.')).toBeVisible();
});

test('advanced controls, picker, server errors, clear and reset', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  await page.getByRole('combobox', { name: 'Office city' }).click(); await page.getByRole('option', { name: 'Giza' }).click();
  await page.getByRole('button', { name: 'Increase seats' }).click(); await expect(page.getByText('Seats: 2')).toBeVisible();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByText('This office is full. Choose another city.')).toBeVisible();
  const city = page.getByRole('combobox', { name: 'Office city' });
  await expect(city).toHaveAttribute('aria-invalid', 'true');
  await city.fill('Cairo'); await page.getByRole('option', { name: 'Cairo', exact: true }).click();
  await page.getByRole('combobox', { name: 'Skills' }).click(); await page.getByRole('option', { name: 'React', exact: true }).click();
  await page.getByLabel('Monthly budget', { exact: true }).fill('500');
  await page.getByRole('switch', { name: 'Email updates' }).check();
  await page.getByRole('radio', { name: 'Pro', exact: true }).check();
  await page.getByRole('button', { name: /Choose date/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('gridcell', { name: '15', exact: true }).first().click();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByText('Preferences saved.')).toBeVisible();
  await city.hover(); await city.focus();
  await page.getByRole('button', { name: 'Clear', exact: true }).first().click();
  await expect(city).toHaveValue('');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByText('Seats: 1')).toBeVisible();
  await expect(page.getByLabel('Monthly budget')).toHaveValue('');
  expect(errors).toEqual([]);
});
