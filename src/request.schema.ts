import moment from 'moment';
import { Schema } from 'mongoose';

export const RequestSchema = new Schema(
  {
    _id: { required: true, type: String },
    request: { required: true, type: String },
    response: String,
    status: { default: '', type: String },
    updated_at: { default: moment().toDate(), index: true, type: Date },
  },
  { versionKey: false },
);
