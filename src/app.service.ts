import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { groupBy, omit } from 'lodash';
import moment from 'moment';
import { Model } from 'mongoose';
import { isJSON } from 'validator';

import { AmqpService } from './amqp.service';
import { modelTokens } from './db.models';
import { env } from './env.validations';
import { autoIncrementString } from './functions';
import { RequestDto } from './request.dto';
import { RequestModel } from './request.model';

@Injectable()
export class AppService {
  constructor(
    private readonly amqpService: AmqpService,
    private readonly logger: Logger,
    @InjectModel(modelTokens.request)
    private readonly requestModel: Model<RequestModel>,
  ) { }

  async request(payload: RequestDto = {}) {
    const request = await new this.requestModel({
      _id: autoIncrementString(),
      request: JSON.stringify(payload),
    }).save();
    this.requestHandler();
    return await this.response(request._id);
  }

  @Cron('0 */15 * * * *')
  async requestHandler() {
    const requests = groupBy(
      await this.requestModel.find(
        {
          $or: [
            { status: '' },
            { status: 'processing' },
            { status: { $exists: false } },
          ],
        },
        { _id: 1, request: 1 },
        { limit: env.AMQP_INSTANCE_LIMIT, sort: { _id: 'asc' } },
      ),
      request => request.status || '',
    );

    for await (const request of requests[''] || []) {
      this.logger.log(request._id, 'AppService/requestHandler');

      await this.requestModel.updateOne(
        { _id: request._id },
        { $set: { status: 'processing', updated_at: moment().toDate() } },
      );

      this.amqpService
        .request(request.request)
        .then(async response => {
          const content = response.content.toString();

          if (isJSON(content)) {
            const json = JSON.parse(content);

            this.logger.log(
              `${request._id}|${json.status}|${json.statusText}`,
              'AppService/requestHandler',
            );

            await this.requestModel.updateOne(
              { _id: request._id },
              {
                $set: {
                  response: JSON.stringify(
                    omit(json, ['readyState', 'responseText']),
                  ),
                  status: json.status === 200 ? 'success' : 'failed',
                  updated_at: moment().toDate(),
                },
              },
            );
          } else {
            this.logger.error(
              content,
              request._id,
              'AppService/requestHandler',
            );

            await this.requestModel.updateOne(
              { _id: request._id },
              {
                $set: {
                  response: JSON.stringify({
                    status: '500',
                    statusText: 'invalid JSON response',
                  }),
                  status: 'failed',
                  updated_at: moment().toDate(),
                },
              },
            );
          }

          this.requestHandler();
        })
        .catch(async e => {
          this.logger.error(e, request._id, 'AppService/requestHandler');

          await this.requestModel.updateOne(
            { _id: request._id },
            {
              $set: {
                response: JSON.stringify({
                  status: '500',
                  statusText: e.message || 'unknown',
                }),
                status: 'failed',
                updated_at: moment().toDate(),
              },
            },
          );

          this.requestHandler();
        });
    }

    if (
      384 * 1024 * 1024 <
      (await this.requestModel.collection.stats()).size
    )
      await this.requestModel.deleteMany({
        status: { $in: ['failed', 'success'] },
        updated_at: {
          $lt: moment()
            .subtract(1, 'minutes')
            .toDate(),
        },
      });
  }

  async response(_id: String = '') {
    const request = await this.requestModel.findOne({ _id });
    if (!request) return;

    const response: any = request.toObject();

    if (isJSON(response.request || ''))
      response.request = JSON.parse(response.request);

    if (isJSON(response.response || ''))
      response.response = JSON.parse(response.response);

    if (!response.status)
      response.queue_index =
        (await this.requestModel.countDocuments({
          status: '',
          updated_at: { $lt: response.updated_at },
        })) + 1;

    return response;
  }
}
