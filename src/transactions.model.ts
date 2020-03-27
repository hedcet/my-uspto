import { Document } from 'mongoose';

export interface transactionsModel extends Document {
  _id: String;
  request: String;
  response?: String;
  status?: String;
  updated_at?: Date;
}
