/**
 * Swagger UI for Matt wallet API — /api-docs and /api-docs.json
 */
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const { buildOpenApiSpec } = require('./spec');

const FAVICON_SVG = fs.readFileSync(path.join(__dirname, 'favicon.svg'), 'utf8');

function mountApiDocs(app) {
  const spec = buildOpenApiSpec();
  const opts = {
    customSiteTitle: 'PinkSurfing Wallet API',
    customfavIcon: '/api-docs/favicon.svg',
    customCss: `
      .swagger-ui .topbar { background-color: #1a1025; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info .title { color: #c084fc; }
    `,
    swaggerOptions: {
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
    res.send(spec);
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec, opts));
}

module.exports = { mountApiDocs, buildOpenApiSpec };
