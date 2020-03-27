import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';

import { AmqpService } from './amqp.service';
import { correspondentsModel } from './correspondents.model';
import { modelTokens } from './db.models';
import { autoIncrementString } from './functions';
import { RequestDto } from './request.dto';
import { transactionsModel } from './transactions.model';

@Injectable()
export class AppService {
  constructor(
    private readonly amqpService: AmqpService,
    @InjectModel(modelTokens.correspondents)
    private readonly correspondentsModel: Model<correspondentsModel>,
    private readonly logger: Logger,
    @InjectModel(modelTokens.transactions)
    private readonly transactionsModel: Model<transactionsModel>,
  ) {}

  async request(payload: RequestDto = {}) {
    const doc = await new this.transactionsModel({
      _id: autoIncrementString(),
      request: JSON.stringify(payload),
    }).save();

    // trigger

    return doc;
  }
}
