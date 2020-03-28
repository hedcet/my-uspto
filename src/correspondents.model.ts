import { Document } from 'mongoose';

export interface CorrespondentsModel extends Document {
  _id: String;
  name?: String;
}
