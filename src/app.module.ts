import { CacheModule, Global, Module, Logger } from '@nestjs/common';

import { amqpProviders } from './amqp.providers';
import { AmqpService } from './amqp.service';
import { AppController } from './app.controller';

@Global()
@Module({
  controllers: [AppController],
  providers: [...amqpProviders, AmqpService, Logger],
})
export class AppModule {}
