import { expect, test } from '@playwright/test';

const url = 'http://127.0.0.1:4174';
test('Vue native form validates, submits, resets and preserves accessible error descriptions', async ({ page }) => {
  await page.goto(url); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toHaveAccessibleDescription('email is required.');
  await page.getByLabel('Email', { exact: true }).fill('user@example.com'); await page.getByLabel('Password', { exact: true }).fill('long-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Login complete.');
  await page.getByRole('button', { name: 'Reset', exact: true }).click(); await expect(page.getByLabel('Email', { exact: true })).toHaveValue('');
});

test('Vuetify registration validates asynchronously and maps server errors', async ({ page }) => {
  await page.goto(url); await page.getByRole('button', { name: 'Registration', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Ada Lovelace'); await page.getByLabel('Email', { exact: true }).fill('used@example.com');
  const username = page.getByLabel('Username', { exact: true }); await username.fill('taken'); await username.press('Tab');
  await expect(username).toHaveAccessibleDescription('Username is unavailable.');
  await username.fill('ada'); await page.getByLabel('Password', { exact: true }).fill('long-password');
  await page.getByLabel('Confirm password', { exact: true }).fill('long-password');
  const country = page.getByRole('combobox', { name: 'Country' }); await country.focus(); await country.press('ArrowDown');
  await page.getByRole('option', { name: 'Egypt', exact: true }).press('Enter');
  await page.getByRole('checkbox', { name: 'I agree to the terms' }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toHaveAccessibleDescription('Email is already registered.');
  await page.getByLabel('Email', { exact: true }).fill('ada@example.com'); await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Account created.');
});

test('Vuetify advanced controls handle keyboard selection, free entries, files, flags and reset', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(url); await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  const city = page.getByRole('combobox', { name: 'Office city' }); await expect(city).toHaveAttribute('required');
  await city.fill('Cai'); await expect(page.getByRole('option', { name: 'Cairo', exact: true })).toBeVisible(); await city.press('Enter'); await expect(city).toHaveValue('Cairo');
  const skills = page.getByRole('combobox', { name: 'Skills' }); await skills.focus(); await skills.press('ArrowDown'); await page.getByRole('option', { name: 'Vue', exact: true }).click(); await skills.press('Escape');
  const tags = page.getByRole('combobox', { name: 'Tags' }); await tags.fill('Research'); await tags.press('Enter'); await tags.press('Escape');
  await page.getByLabel('Monthly budget', { exact: true }).fill('99.5'); await page.getByLabel('Notes', { exact: true }).fill('Workspace notes');
  await page.getByLabel('Attachments', { exact: true }).setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.getByText('note.txt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add seat', exact: true }).click(); await expect(page.getByText('Seats: 2')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Email updates' }).check(); await page.getByRole('radio', { name: 'Pro', exact: true }).check();
  await page.getByRole('button', { name: 'Lock fields', exact: true }).click(); await expect(page.getByLabel('Monthly budget', { exact: true })).toHaveAttribute('readonly');
  await page.getByRole('button', { name: 'Unlock fields', exact: true }).click();
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Preferences saved. 1 local file(s).');
  await page.getByRole('button', { name: 'Reset', exact: true }).click(); await expect(page.getByText('Seats: 1')).toBeVisible();
  await expect(page.getByText('note.txt', { exact: true })).toHaveCount(0); await expect(page.getByLabel('Monthly budget', { exact: true })).toHaveValue('');
  expect(errors).toEqual([]);
});
