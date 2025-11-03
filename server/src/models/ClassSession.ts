import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IClassSession extends Document {
  template: Types.ObjectId;
  code: string;
  status: 'draft' | 'live' | 'closed';
  scheduledAt?: Date;
  createdBy: Types.ObjectId;
  allowDelayedAfterHours: number;
  sentences?: string[];
  gapPlan?: Array<{ key: string; kind: 'target'|'distractor'; word?: string; sentenceIndex: number }>;
  createdAt: Date;
}

const ClassSessionSchema = new Schema<IClassSession>({
  template: { type: Schema.Types.ObjectId, ref: 'StoryTemplate', required: true },
  code: { type: String, unique: true, required: true, index: true },
  status: { type: String, enum: ['draft', 'live', 'closed'], default: 'draft' },
  scheduledAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  allowDelayedAfterHours: { type: Number, default: 24 },
  createdAt: { type: Date, default: () => new Date() },
  sentences: { type: [String], default: [] },
  gapPlan: { type: [{ key: String, kind: String, word: String, sentenceIndex: Number }], default: [] }
});

export const ClassSession = mongoose.model<IClassSession>('ClassSession', ClassSessionSchema);
