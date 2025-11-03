import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEffortResponse extends Document {
  session: Types.ObjectId;
  student: Types.ObjectId;
  taskType: string;
  position: 'mid' | 'end';
  score: number;
  ts: Date;
}

const EffortSchema = new Schema<IEffortResponse>({
  session: { type: Schema.Types.ObjectId, ref: 'ClassSession', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  taskType: { type: String, required: true },
  position: { type: String, enum: ['mid', 'end'], required: true },
  score: { type: Number, min: 1, max: 9, required: true },
  ts: { type: Date, default: () => new Date() }
});

export const EffortResponse = mongoose.model<IEffortResponse>('EffortResponse', EffortSchema);

