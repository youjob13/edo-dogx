import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr/node';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './main.server';

export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');
  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  // Proxy auth and API requests to the BFF gateway before Angular handles anything.
  // /api/auth is rewritten to /auth for gateway auth routes, while the rest of
  // /api/* is forwarded as-is because gateway API routes are registered with /api.
  const apiTarget = (process.env['API_BASE_URL'] ?? 'http://localhost:3000').replace(/\/api\/?$/, '');
  server.use(
    '/api/auth',
    createProxyMiddleware({
      target: apiTarget,
      changeOrigin: true,
      pathRewrite: (path) => `/auth${path}`,
    }),
  );
  server.use(
    '/api',
    createProxyMiddleware({
      target: apiTarget,
      changeOrigin: true,
      pathRewrite: (path) => `/api${path}`,
    }),
  );

  server.get(
    '*.*',
    express.static(browserDistFolder, { maxAge: '1y' }),
  );

  server.get('*', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;
  const server = app();
  server.listen(port, () => {
    console.log(
      `Angular SSR server listening on http://localhost:${port}`,
    );
  });
}

run();
