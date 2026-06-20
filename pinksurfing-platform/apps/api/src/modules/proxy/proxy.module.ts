import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ProxyService } from './proxy.service';

@Module({
  providers: [ProxyService],
  exports: [ProxyService],
})
export class ProxyModule implements NestModule {
  constructor(private readonly proxy: ProxyService) {}

  configure(consumer: MiddlewareConsumer) {
    const all = RequestMethod.ALL;
    consumer.apply(this.proxy.createAppProxy()).forRoutes({ path: 'api/app/*path', method: all });
    consumer.apply(this.proxy.createWalletProxy()).forRoutes({ path: 'api/wallet/*path', method: all });
    consumer.apply(this.proxy.createAdminProxy()).forRoutes({ path: 'api/admin/*path', method: all });
  }
}
