/**
 * Swagger UI for wallet API — /api-docs and /api-docs.json
 */
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const { buildOpenApiSpec } = require('./spec');

const FAVICON_SVG = fs.readFileSync(path.join(__dirname, 'favicon.svg'), 'utf8');
const SPEC_CACHE_BUST = 'v=4';

function mountApiDocs(app) {
  const specUrl = `/api-docs.json?${SPEC_CACHE_BUST}`;
  const opts = {
    customSiteTitle: 'PinkSurfing Wallet API',
    customfavIcon: '/api-docs/favicon.svg',
    customCss: `
      .swagger-ui .topbar { background-color: #1a1025; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info .title { color: #c084fc; }
    `,
    swaggerOptions: {
      url: specUrl,
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  };

  app.get('/api-docs/favicon.svg', (_req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(FAVICON_SVG);
  });

  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.send(buildOpenApiSpec());
  });

  app.use(
    '/api-docs',
    (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(undefined, opts),
  );
}

module.exports = { mountApiDocs, buildOpenApiSpec };
