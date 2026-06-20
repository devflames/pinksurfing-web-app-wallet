import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { probeUpstream } from './upstream.util';

@Controller()
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  root() {
    return {
      service: 'pinksurfing-gateway',
      status: 'ok',
      note: 'This is a reverse proxy — use /health and paths under /api/app/* or /api/wallet/*',
      links: {
        health: '/health',
        upstreams: '/health/upstreams',
        appProxyInfo: '/api/app',
        walletProxyInfo: '/api/wallet',
        webShell: 'http://localhost:3000',
      },
    };
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'pinksurfing-gateway' };
  }

  @Get('health/upstreams')
  async upstreams() {
    const appApiUrl = this.config.get<string>('appApiUrl')!;
    const walletApiUrl = this.config.get<string>('walletApiUrl')!;
    const adminApiUrl = this.config.get<string>('adminApiUrl')!;

    const [raihan, wallet, admin] = await Promise.all([
      probeUpstream(appApiUrl),
      probeUpstream(walletApiUrl),
      probeUpstream(adminApiUrl),
    ]);

    const allOk = raihan.ok && wallet.ok;

    return {
      gateway: { status: 'ok', service: 'pinksurfing-gateway' },
      readyForLiveData: allOk,
      upstreams: {
        raihan: { label: 'Raihan mobileapi (APP_API_URL)', ...raihan },
        wallet: { label: 'Matt wallet (WALLET_API_URL)', ...wallet },
        admin: { label: 'Raihan admin (ADMIN_API_URL)', ...admin },
      },
      hint: allOk
        ? 'Backends reachable — live contracts/chat/wallet should work via gateway.'
        : 'Start official backends (see docs/LOCAL_STANDALONE_DEMO.md). Demo UI still works without them.',
    };
  }

  @Get(['api/app', 'api/app/'])
  appProxyInfo() {
    const target = this.config.get<string>('appApiUrl');
    return {
      proxy: '/api/app/*',
      target,
      note: 'GET /api/app alone is info only. Call a real route, e.g. /api/app/business/contracts',
      examples: [
        '/api/app/business/contracts',
        '/api/app/chat/contactList',
        '/api/app/rtc/token/agora/web-user-a/channel-name',
      ],
      upstreamCheck: '/health/upstreams',
    };
  }

  @Get(['api/wallet', 'api/wallet/'])
  walletProxyInfo() {
    const target = this.config.get<string>('walletApiUrl');
    return {
      proxy: '/api/wallet/*',
      target,
      note: 'GET /api/wallet alone is info only. Call a real route, e.g. /api/wallet/keyvault/health',
      examples: ['/api/wallet/keyvault/health', '/api/wallet/'],
      upstreamCheck: '/health/upstreams',
    };
  }
}
