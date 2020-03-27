import { Schema } from 'mongoose';

export const correspondentsSchema = new Schema(
  {
    _id: { required: true, type: String },
    name: String,
  },
  { versionKey: false },
);
