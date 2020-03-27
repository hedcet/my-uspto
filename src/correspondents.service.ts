import { HttpService, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { get } from 'lodash';
import { Model } from 'mongoose';

import { correspondentsModel } from './correspondents.model';
import { modelTokens } from './db.models';

@Injectable()
export class CorrespondentsService {
  constructor(
    @InjectModel(modelTokens.correspondents)
    private readonly correspondentsModel: Model<correspondentsModel>,
    private readonly httpService: HttpService,
    private readonly logger: Logger,
  ) {}

  @Cron('0 */10 * * * *')
  async update(query: { [key: string]: any } = { name: { $exists: false } }) {
    const correspondents = await this.correspondentsModel.find(query);

    for (const correspondent of correspondents) {
      try {
        const response = await this.httpService
          .post('https://ped.uspto.gov/api/queries', {
            df: 'appCustNumber',
            facet: true,
            facetField: ['corrAddrNameLineOne'],
            facetLimit: 1,
            fl: '',
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
          this.logger.log(
            `${correspondent.name || ''} => ${name}`,
            `CorrespondentsService/update/${correspondent._id}`,
          );

          await this.correspondentsModel.updateOne(
            { _id: correspondent._id },
            { $set: { name } },
          );
        }
      } catch (e) {
        this.logger.error(
          e,
          e.message,
          `CorrespondentsService/update/${correspondent._id}`,
        );

        continue;
      }
    }

    return true;
  }
}
