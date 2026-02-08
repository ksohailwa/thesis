import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEffortResponse extends Document {
  session?: Types.ObjectId;
  experiment?: Types.ObjectId;
  student: Types.ObjectId;
  taskType?: string;
  storyLabel?: 'A' | 'B';
  paragraphIndex?: number;
  position: 'mid' | 'end';
  score: number;
  ts: Date;
}

const EffortSchema = new Schema<IEffortResponse>({
  session: { type: Schema.Types.ObjectId, ref: 'ClassSession' },
  experiment: { type: Schema.Types.ObjectId, ref: 'Experiment' },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  taskType: { type: String },
  storyLabel: { type: String, enum: ['A', 'B'] },
  paragraphIndex: { type: Number },
  position: { type: String, enum: ['mid', 'end'], required: true },
  score: { type: Number, min: 1, max: 9, required: true },
  ts: { type: Date, default: () => new Date() },
});

export const EffortResponse = mongoose.model<IEffortResponse>('EffortResponse', EffortSchema);
