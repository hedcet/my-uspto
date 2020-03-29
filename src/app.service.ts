import { HttpService, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { compact, find, get, groupBy, omit } from 'lodash';
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
    return await this.response(transaction._id);
  }

  @Cron('0 */10 * * * *')
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
              `${transaction._id}|${json.status}|${json.statusText}`,
              'AppService/transactionsLoop',
            );

            if (30 < json.statusText.length)
              json.statusText = json.statusText.substr(0, 30);

            await this.transactionsModel.updateOne(
              { _id: transaction._id },
              {
                $set: {
                  response: JSON.stringify(
                    omit(json, ['readyState', 'responseText']),
                  ),
                  status: json.status == 200 ? 'success' : 'failed',
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

  async response(_id: String = '') {
    let transaction = await this.transactionsModel.findOne({ _id });
    if (!transaction) return transaction;
    transaction = transaction.toObject();

    if (transaction.request && isJSON(transaction.request))
      transaction.request = JSON.parse(transaction.request);

    if (transaction.response && isJSON(transaction.response)) {
      transaction.response = JSON.parse(transaction.response);

      const $in = compact(
        get(transaction, 'response.responseJSON.responseObject', []).map(app =>
          (app.patronIdentifier || '').replace(/[^0-9]+/g, ''),
        ),
      );

      if ($in.length) {
        const correspondents = await this.correspondentsModel.find({
          _id: { $in },
        });

        for (const app of transaction.response.responseJSON.responseObject) {
          const correspondent = find(correspondents, {
            _id: (app.patronIdentifier || '').replace(/[^0-9]+/g, ''),
          });

          if (correspondent) {
            if (correspondent.name) app.correspondentName = correspondent.name;
          } else await new this.correspondentsModel({ _id }).save();
        }
      }
    }

    if (!transaction.status)
      transaction.queue_index =
        (await this.transactionsModel.countDocuments({
          status: '',
          updated_at: { $lt: transaction.updated_at },
        })) + 1;

    return transaction;
  }

  @Cron('0 */10 * * * *')
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

  async correspondent(_id: String = '') {
    return await this.correspondentsModel.findOne({ _id });
  }
}
