import { Global, Module, Logger } from '@nestjs/common';
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
    MongooseModule.forRoot(env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }),
    MongooseModule.forFeature([...DbModels]),
    ScheduleModule.forRoot(),
  ],
  providers: [...AmqpProviders, AmqpService, AppService, Logger],
})
export class AppModule {}
