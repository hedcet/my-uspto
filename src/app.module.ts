import { Global, HttpModule, Module, Logger } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';

import { AmqpProviders } from './amqp.providers';
import { AmqpService } from './amqp.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CorrespondentsService } from './correspondents.service';
import { DbModels } from './db.models';
import { env } from './env.validations';

@Global()
@Module({
  controllers: [AppController],
  imports: [
    HttpModule.register({ timeout: 1000 * 60 }),
    MongooseModule.forFeature([...DbModels]),
    MongooseModule.forRoot(env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }),
    ScheduleModule.forRoot(),
  ],
  providers: [
    ...AmqpProviders,
    AmqpService,
    AppService,
    CorrespondentsService,
    Logger,
  ],
})
export class AppModule {}
