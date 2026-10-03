const server = Bun.serve({
  port: 5501,
  fetch(req, server) {
    const url = new URL(req.url);
    let pathname = url.pathname;
    if (pathname === '/') pathname = '/index.html';
    const filePath = `C:/Users/vrock/Documents/Adventure${pathname}`;
    const headers = {};
    const ext = filePath.split('.').pop().toLowerCase();
    const types = {
      html: 'text/html',
      js: 'application/javascript',
      css: 'text/css',
      png: 'image/png',
      jpg: 'image/jpeg',
      svg: 'image/svg+xml'
    };
    if (types[ext]) headers['Content-Type'] = types[ext];
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    return new Promise((resolve, reject) => {
      import('fs').then(fs => {
        fs.readFile(filePath, (err, data) => {
          if (err) {
            resolve(new Response('Not found', { status: 404 }));
          } else {
            resolve(new Response(data, { headers }));
          }
        });
      });
    });
  }
});

console.log('Serving on http://localhost:5501');
