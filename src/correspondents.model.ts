import { Document } from 'mongoose';

export interface correspondentsModel extends Document {
  _id: String;
  name?: String;
}
