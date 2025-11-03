import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAssignment extends Document {
  experiment: Types.ObjectId;
  student: Types.ObjectId;
  condition: Types.ObjectId; // ref Condition
  story?: 'H'|'N';
  createdAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>({
  experiment: { type: Schema.Types.ObjectId, ref: 'Experiment', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  condition: { type: Schema.Types.ObjectId, ref: 'Condition', required: true },
  story: { type: String, enum: ['H','N'], required: false },
  createdAt: { type: Date, default: () => new Date() }
});

AssignmentSchema.index({ experiment: 1, student: 1 }, { unique: true });

export const Assignment = mongoose.model<IAssignment>('Assignment', AssignmentSchema);
