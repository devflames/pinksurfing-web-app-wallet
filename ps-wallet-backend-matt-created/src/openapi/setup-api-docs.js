/**
 * Swagger UI for Matt wallet API — /api-docs and /api-docs.json
 */
const swaggerUi = require('swagger-ui-express');
const { buildOpenApiSpec } = require('./spec');

function mountApiDocs(app) {
  const spec = buildOpenApiSpec();
  const opts = {
    customSiteTitle: 'PinkSurfing Wallet API',
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

  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(spec);
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec, opts));
}

module.exports = { mountApiDocs, buildOpenApiSpec };
