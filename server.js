// Read-only local preview. Production continues to use api.php.
import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const realRoot = await realpath(root);
const port = Number(process.env.PORT || 3001);
const rootFiles = new Set(['index.html', 'admin.html', 'admin-development.js', 'property.html', 'site.js', 'site.css', 'favicon.svg', 'robots.txt', 'sitemap.xml', 'llms.txt', 'aeo-source-of-truth.json']);
const pageFolders = new Set(['trust', 'terms', 'privacy', 'verify-property', 'nigerians-in-diaspora-property-investment']);
const mime = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.ogg': 'video/ogg' };
const mediaExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.mp4', '.webm', '.mov', '.ogg']);
const within = (base, target) => { const relative = path.relative(base, target); return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); };
function send(res, status, body, type = 'application/json; charset=utf-8', head = false) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(head ? undefined : body);
}

http.createServer(async (req, res) => {
  const head = req.method === 'HEAD';
  try {
    // Check the raw pathname before URL normalization can erase traversal segments.
    const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (!rawPath.startsWith('/') || rawPath.includes('\\') || rawPath.includes('\0') || rawPath.split('/').some(part => part === '..' || part === '.' || part.startsWith('.'))) {
      return send(res, 403, JSON.stringify({ error: 'Path is not available in preview.' }), undefined, head);
    }
    const url = new URL(req.url, 'http://localhost');
    if (rawPath === '/api.php') {
      const action = url.searchParams.get('action');
      if (action === 'session' && req.method === 'GET') return send(res, 200, JSON.stringify({ actor: 'Local preview (read-only)', readOnly: true }));
      if (action !== 'getData' || !['GET', 'HEAD'].includes(req.method)) {
        return send(res, 405, JSON.stringify({ error: 'Local preview is read-only. Login, uploads and changes require the production PHP service.' }), undefined, head);
      }
      const data = JSON.parse(await readFile(path.join(root, 'data.json'), 'utf8'));
      return send(res, 200, JSON.stringify(data), undefined, head);
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      return send(res, 405, JSON.stringify({ error: 'Local preview is read-only.' }));
    }
    let relative = rawPath.slice(1);
    if (!relative) relative = 'index.html';
    const folder = relative.replace(/\/$/, '');
    if (pageFolders.has(folder)) relative = `${folder}/index.html`;
    const parts = relative.split('/');
    const ext = path.extname(relative).toLowerCase();
    const allowed = rootFiles.has(relative) || (parts.length === 2 && pageFolders.has(parts[0]) && parts[1] === 'index.html') || (parts.length === 2 && ['images', 'uploads'].includes(parts[0]) && mediaExtensions.has(ext));
    if (!allowed) return send(res, 404, JSON.stringify({ error: 'File is not available in preview.' }), undefined, head);
    const filename = path.resolve(root, relative);
    if (!within(root, filename)) return send(res, 403, JSON.stringify({ error: 'Path is not available in preview.' }), undefined, head);
    const resolved = await realpath(filename);
    if (!within(realRoot, resolved) || !(await stat(resolved)).isFile()) return send(res, 403, JSON.stringify({ error: 'Path is not available in preview.' }), undefined, head);
    send(res, 200, await readFile(resolved), mime[ext] || 'application/octet-stream', head);
  } catch (error) {
    const status = error instanceof URIError ? 400 : error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500;
    send(res, status, JSON.stringify({ error: status === 400 ? 'Invalid URL.' : status === 404 ? 'File not found.' : 'Preview could not load this file.' }), undefined, head);
  }
}).listen(port, '127.0.0.1', () => console.log(`Read-only preview: http://127.0.0.1:${port}`));
