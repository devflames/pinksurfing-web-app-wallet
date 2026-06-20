import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import type { RequestHandler } from 'http-proxy-middleware';

@Injectable()
export class ProxyService {
  constructor(private readonly config: ConfigService) {}

  createAppProxy(): RequestHandler {
    return createProxyMiddleware({
      target: this.config.get<string>('appApiUrl'),
      changeOrigin: true,
      pathRewrite: { '^/api/app': '' },
      on: {
        proxyReq: (proxyReq, req) => {
          fixRequestBody(proxyReq, req);
          const auth = req.headers.authorization;
          if (auth) proxyReq.setHeader('Authorization', auth);
          for (const h of ['x-auth-address', 'x-auth-timestamp', 'x-auth-signature'] as const) {
            const v = req.headers[h];
            if (typeof v === 'string') proxyReq.setHeader(h, v);
          }
        },
      },
    });
  }

  createWalletProxy(): RequestHandler {
    return createProxyMiddleware({
      target: this.config.get<string>('walletApiUrl'),
      changeOrigin: true,
      pathRewrite: { '^/api/wallet': '' },
      on: {
        proxyReq: (proxyReq, req) => {
          fixRequestBody(proxyReq, req);
          const auth = req.headers.authorization;
          if (auth) proxyReq.setHeader('Authorization', auth);
          for (const h of ['x-auth-address', 'x-auth-timestamp', 'x-auth-signature'] as const) {
            const v = req.headers[h];
            if (typeof v === 'string') proxyReq.setHeader(h, v);
          }
        },
      },
    });
  }

  createAdminProxy(): RequestHandler {
    return createProxyMiddleware({
      target: this.config.get<string>('adminApiUrl'),
      changeOrigin: true,
      pathRewrite: { '^/api/admin': '' },
      on: {
        proxyReq: (proxyReq, req) => {
          fixRequestBody(proxyReq, req);
          const auth = req.headers.authorization;
          if (auth) proxyReq.setHeader('Authorization', auth);
          for (const h of ['x-auth-address', 'x-auth-timestamp', 'x-auth-signature'] as const) {
            const v = req.headers[h];
            if (typeof v === 'string') proxyReq.setHeader(h, v);
          }
        },
      },
    });
  }
}
