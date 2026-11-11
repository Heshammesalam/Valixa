import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';
export async function verifyProductionConsumer(directory, output = 'dist') {
  const webRoot = resolve(directory, output);
  const server = createServer(async (req, res) => {
    const path = resolve(webRoot, `.${new URL(req.url, 'http://localhost').pathname}`);
    if (!path.startsWith(webRoot + sep) && path !== webRoot) { res.writeHead(403).end(); return; }
    try { const file = extname(path) ? path : join(webRoot, 'index.html'), content = await readFile(file); res.writeHead(200, { 'Content-Type': extname(file) === '.js' ? 'text/javascript' : extname(file) === '.css' ? 'text/css' : 'text/html' }).end(content); } catch { res.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done)); let browser; const errors = [];
  try {
    browser = await chromium.launch({ channel: 'chromium' }); const page = await browser.newPage(); page.on('pageerror', error => errors.push(error.stack ?? error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    assert.deepEqual(errors, [], 'Consumer must bootstrap without browser exceptions');
    await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.getByRole('alert', { name: 'Form errors' }).waitFor();
    await page.getByRole('textbox', { name: 'Email' }).fill('user@example.com'); await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByText('Saved user@example.com', { exact: true }).waitFor();
    assert(!(await page.getByRole('region', { name: 'Valixa DevTools' }).textContent()).includes('user@example.com'));
    assert.deepEqual(errors, []);
  } catch (error) { throw new Error(`Independent production consumer failed (${directory}): ${error.message}; browser errors: ${JSON.stringify(errors)}`, { cause: error }); }
  finally { await browser?.close(); await new Promise(done => server.close(done)); }
}
