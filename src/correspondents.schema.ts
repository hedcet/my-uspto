import { Schema } from 'mongoose';

export const CorrespondentsSchema = new Schema(
  {
    _id: { required: true, type: String },
    name: String,
  },
  { versionKey: false },
);
