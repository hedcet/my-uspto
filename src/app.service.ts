import { HttpService, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { get, groupBy, omit } from 'lodash';
import * as moment from 'moment';
import { Model } from 'mongoose';
import { isJSON } from 'validator';

import { AmqpService } from './amqp.service';
import { CorrespondentsModel } from './correspondents.model';
import { modelTokens } from './db.models';
import { env } from './env.validations';
import { autoIncrementString } from './functions';
import { RequestDto } from './request.dto';
import { TransactionsModel } from './transactions.model';

@Injectable()
export class AppService {
  constructor(
    private readonly amqpService: AmqpService,
    @InjectModel(modelTokens.correspondents)
    private readonly correspondentsModel: Model<CorrespondentsModel>,
    private readonly httpService: HttpService,
    private readonly logger: Logger,
    @InjectModel(modelTokens.transactions)
    private readonly transactionsModel: Model<TransactionsModel>,
  ) {}

  async request(payload: RequestDto = {}) {
    const transaction = await new this.transactionsModel({
      _id: autoIncrementString(),
      request: JSON.stringify(payload),
    }).save();
    this.transactionsLoop();
    return transaction;
  }

  @Cron('0 0 0 * * *')
  async transactionsLoop() {
    const transactions = groupBy(
      await this.transactionsModel.find(
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
      transaction => transaction.status || '',
    );

    for (const transaction of transactions[''] || []) {
      this.logger.log(transaction._id, 'AppService/transactionsLoop');

      await this.transactionsModel.updateOne(
        { _id: transaction._id },
        { $set: { status: 'processing', updated_at: moment().toDate() } },
      );

      this.amqpService
        .request(
          {},
          { sendOpts: { headers: { payload: transaction.request } } },
        )
        .then(async response => {
          const content = response.content.toString();

          if (isJSON(content)) {
            const json = JSON.parse(content);

            this.logger.log(
              `${transaction._id}|${json.status}`,
              'AppService/transactionsLoop',
            );

            await this.transactionsModel.updateOne(
              { _id: transaction._id },
              {
                $set: {
                  response: JSON.stringify(
                    omit(json, ['readyState', 'responseText']),
                  ),
                  status: json.status ? 'success' : 'failed',
                  updated_at: moment().toDate(),
                },
              },
            );
          } else {
            this.logger.error(
              content,
              transaction._id,
              'AppService/transactionsLoop',
            );

            await this.transactionsModel.updateOne(
              { _id: transaction._id },
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

          this.transactionsLoop();
        })
        .catch(async e => {
          this.logger.error(e, transaction._id, 'AppService/transactionsLoop');

          await this.transactionsModel.updateOne(
            { _id: transaction._id },
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

          this.transactionsLoop();
        });
    }

    const transactionsModelStats = await this.transactionsModel.collection.stats();

    if (128 * 1024 * 1024 < transactionsModelStats.storageSize)
      await this.transactionsModel.deleteMany({
        status: { $in: ['success', 'failed'] },
        updated_at: {
          $lt: moment()
            .subtract(7, 'days')
            .toDate(),
        },
      });
  }

  @Cron('0 0 0 * * *')
  async correspondentsLoop() {
    for (const correspondent of await this.correspondentsModel.find({
      name: { $exists: false },
    })) {
      try {
        this.logger.log(correspondent._id, 'AppService/correspondentsLoop');

        const response = await this.httpService
          .post('https://ped.uspto.gov/api/queries', {
            df: 'appCustNumber',
            facet: true,
            facetField: ['corrAddrNameLineOne'],
            facetLimit: 1,
            fl: '*',
            fq: [],
            mm: '0%',
            qf: 'appCustNumber corrAddrCustNo',
            searchText: `appCustNumber:(${correspondent._id})`,
            sort: 'appStatusDate desc',
            start: 0,
          })
          .toPromise();

        const name = get(
          response.data,
          'queryResults.searchResponse.facet_counts.facet_fields.corrAddrNameLineOne[0]',
          '',
        );

        if (
          3 <= name.replace(/\s+/g, '').length &&
          correspondent.name !== name
        ) {
          this.logger.log(name, 'AppService/correspondentsLoop');

          await this.correspondentsModel.updateOne(
            { _id: correspondent._id },
            { $set: { name } },
          );
        }
      } catch (e) {
        this.logger.error(e, e.message, 'AppService/correspondentsLoop');
      }
    }

    return true;
  }
}
