import { Document } from 'mongoose';

export interface TransactionsModel extends Document {
  _id: String;
  request: String;
  response?: String;
  status?: String;
  updated_at?: Date;
}
