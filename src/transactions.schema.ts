import * as moment from 'moment';
import { Schema } from 'mongoose';

export const transactionsSchema = new Schema(
  {
    _id: { required: true, type: String },
    request: { required: true, type: String },
    response: String,
    status: { default: '', type: String },
    updated_at: { default: moment().toDate(), type: Date },
  },
  { versionKey: false },
);
