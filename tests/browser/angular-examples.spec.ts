import { expect, test } from '@playwright/test';
const url = 'http://127.0.0.1:4175';

test('Angular prerender hydrates native bindings, validates, submits and resets', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const taskWindow = window as Window & { valixaServerInput?: Element };
    const observer = new MutationObserver(() => {
      const input = document.getElementById('angular-login-email');
      if (input && !taskWindow.valixaServerInput) { taskWindow.valixaServerInput = input; observer.disconnect(); }
    }); observer.observe(document, { subtree: true, childList: true });
  });
  const response = await page.goto(url); expect(await response!.text()).toContain('ngh=');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toHaveAccessibleDescription('email is required.');
  expect(await page.evaluate(() => (window as Window & { valixaServerInput?: Element }).valixaServerInput === document.getElementById('angular-login-email'))).toBe(true);
  await page.getByLabel('Email', { exact: true }).fill('user@example.com'); await page.getByLabel('Password', { exact: true }).fill('long-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Login complete.');
  await page.getByRole('button', { name: 'Reset', exact: true }).click(); await expect(page.getByLabel('Email', { exact: true })).toHaveValue(''); expect(errors).toEqual([]);
});

test('Material registration validates asynchronously, exposes errors and retries server rejection', async ({ page }) => {
  await page.goto(url); await page.getByRole('button', { name: 'Registration', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Ada Lovelace'); await page.getByLabel('Email', { exact: true }).fill('used@example.com');
  const username = page.getByLabel('Username', { exact: true }); await username.fill('taken'); await username.press('Tab');
  await expect(username).toHaveAccessibleDescription('Username is unavailable.'); await username.fill('ada');
  await page.getByLabel('Password', { exact: true }).fill('long-password'); await page.getByLabel('Confirm password', { exact: true }).fill('long-password');
  const country = page.getByRole('combobox', { name: 'Country' }); await country.focus(); await country.press('Enter'); await page.getByRole('option', { name: 'Egypt', exact: true }).click();
  await page.getByRole('checkbox', { name: 'I agree to the terms' }).check(); await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toHaveAccessibleDescription('Email is already registered.');
  await page.getByLabel('Email', { exact: true }).fill('ada@example.com'); await page.getByRole('button', { name: 'Create account', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Account created.');
});

test('advanced Material controls preserve draft semantics, codecs, keyboard behavior and flags', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(url); await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  const city = page.getByRole('combobox', { name: 'Office city' }); await city.fill('Cai'); await city.press('ArrowDown'); await city.press('Enter'); await expect(city).toHaveValue('Cairo');
  await city.fill('Unselected draft'); await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(city).toHaveAccessibleDescription('city is required.'); await expect(city).toHaveValue('Unselected draft');
  await city.fill('Cai'); await city.press('ArrowDown'); await city.press('Enter');
  const offices = page.getByRole('combobox', { name: 'Other offices' }); await offices.click(); await page.getByRole('option', { name: 'Giza', exact: true }).click(); await offices.press('Escape');
  await page.getByRole('button', { name: 'Open calendar', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('mat-calendar button.mat-calendar-body-cell').filter({ hasText: /^\s*15\s*$/ }).click();
  await expect(page.getByRole('textbox', { name: 'Start date', exact: true })).not.toHaveValue('');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByLabel('Monthly budget', { exact: true }).fill('123.5'); await page.getByRole('button', { name: 'Add seat', exact: true }).click(); await expect(page.getByText('Seats: 2')).toBeVisible();
  await page.getByRole('radio', { name: 'Pro', exact: true }).check();
  // Material's signal-driven aria state can settle after the click under parallel load.
  const updates = page.getByRole('switch', { name: 'Email updates' });
  await updates.click(); await expect(updates).toBeChecked();
  await page.getByRole('button', { name: 'Lock fields', exact: true }).click(); await expect(page.getByLabel('Monthly budget', { exact: true })).toHaveAttribute('readonly'); await expect(offices).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Unlock fields', exact: true }).click();
  await page.getByRole('button', { name: 'Disable fields', exact: true }).click(); await expect(page.getByLabel('Monthly budget', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Enable fields', exact: true }).click();
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click(); await expect(page.getByRole('status')).toContainText('Preferences saved.');
  await page.getByRole('button', { name: 'Reset', exact: true }).click(); await expect(page.getByText('Seats: 1')).toBeVisible(); await expect(city).toHaveValue(''); await expect(page.getByLabel('Monthly budget', { exact: true })).toHaveValue(''); expect(errors).toEqual([]);
});
