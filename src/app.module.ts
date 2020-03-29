import {
  CacheModule,
  Global,
  HttpModule,
  Module,
  Logger,
} from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';

import { AmqpProviders } from './amqp.providers';
import { AmqpService } from './amqp.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModels } from './db.models';
import { env } from './env.validations';

@Global()
@Module({
  controllers: [AppController],
  imports: [
    CacheModule.register({
      max: 1000 * 60,
      ttl: 600,
    }),
    HttpModule.register({ timeout: 1000 * 60 }),
    MongooseModule.forFeature([...DbModels]),
    MongooseModule.forRoot(env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }),
    ScheduleModule.forRoot(),
  ],
  providers: [...AmqpProviders, AmqpService, AppService, Logger],
})
export class AppModule {}
