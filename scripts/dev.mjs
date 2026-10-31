import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { buildSite } from './build.mjs';
import handler from '../api/contact.js';
import retryHandler from '../api/retry-notifications.js';
import oauthHandler from '../api/naverworks-oauth.js';
import mailSyncHandler from '../api/sync-mail.js';
import adminHandler from '../api/admin.js';

if (!process.argv.includes('--no-build')) await buildSite();
const root = resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.avif': 'image/avif', '.gif': 'image/gif', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };
const headers = JSON.parse(await readFile('vercel.json', 'utf8')).headers[0].headers;
const server = createServer(async (req, res) => {
  for (const { key, value } of headers) res.setHeader(key, value);
  if (req.url.split('?')[0] === '/api/contact') return handler(req, res);
  if (req.url.split('?')[0] === '/api/retry-notifications') return retryHandler(req, res);
  if (req.url.split('?')[0] === '/api/naverworks-oauth') return oauthHandler(req, res);
  if (req.url.split('?')[0] === '/api/sync-mail') return mailSyncHandler(req, res);
  if (req.url.split('?')[0] === '/api/admin') return adminHandler(req, res);
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + '/')) throw new Error('Outside output directory');
    if (!extname(file)) file += '.html';
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(await readFile(resolve(root, '404.html')));
  }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('TEYVAT: http://localhost:' + server.address().port));
