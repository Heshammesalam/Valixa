import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../examples/angular-material/dist/browser/', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
createServer(async (req, res) => {
  const path = resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`);
  if (!path.startsWith(resolve(root) + sep) && path !== resolve(root)) { res.writeHead(403).end(); return; }
  try { const filename = extname(path) ? path : resolve(root, 'index.html'); const content = await readFile(filename);
    res.writeHead(200, { 'Content-Type': mime[extname(filename)] ?? 'application/octet-stream' }); res.end(content);
  } catch { res.writeHead(404).end(); }
}).listen(4175, '127.0.0.1', () => console.log('Angular production example: http://127.0.0.1:4175'));
