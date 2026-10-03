import { readFile } from 'fs/promises';
import { join, normalize } from 'path';

const root = process.cwd();

const staticServer = Bun.serve({
  port: 5501,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = normalize(join(root, pathname));
    const ext = filePath.split('.').pop().toLowerCase();
    const types = {
      html: 'text/html',
      js: 'application/javascript',
      css: 'text/css',
      png: 'image/png',
      jpg: 'image/jpeg',
      svg: 'image/svg+xml'
    };
    const headers = {
      'Content-Type': types[ext],
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    };
    try {
      return new Response(await readFile(filePath), { headers });
    } catch (e) {
      return new Response('Not found', { status: 404 });
    }
  }
});

console.log('Static server on http://localhost:5501');

Bun.serve({
  port: 6666,
  async fetch(_req) {
    const data = await readFile(join(root, 'run/tokio.js'));
    return new Response(data, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    });
  }
});

console.log('Debug server on http://localhost:6666');
