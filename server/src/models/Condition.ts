import mongoose, { Schema, Document, Types } from 'mongoose';

export type ConditionType = 'with-hints' | 'without-hints';

export interface ICondition extends Document {
  experiment: Types.ObjectId;
  type: ConditionType;
  createdAt: Date;
}

const ConditionSchema = new Schema<ICondition>({
  experiment: { type: Schema.Types.ObjectId, ref: 'Experiment', required: true },
  type: { type: String, enum: ['with-hints', 'without-hints'], required: true },
  createdAt: { type: Date, default: () => new Date() },
});

ConditionSchema.index({ experiment: 1, type: 1 }, { unique: true });

export const Condition = mongoose.model<ICondition>('Condition', ConditionSchema);
