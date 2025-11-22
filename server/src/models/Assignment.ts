import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAssignment extends Document {
  experiment: Types.ObjectId;
  student: Types.ObjectId;
  condition: Types.ObjectId; // ref Condition
  // For two-story-per-test experiments, link both stories under one assignment
  story1?: Types.ObjectId; // ref Story
  story2?: Types.ObjectId; // ref Story
  // Legacy single-story flag (kept for compatibility)
  story?: 'H' | 'N';
  createdAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>({
  experiment: { type: Schema.Types.ObjectId, ref: 'Experiment', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  condition: { type: Schema.Types.ObjectId, ref: 'Condition', required: true },
  story1: { type: Schema.Types.ObjectId, ref: 'Story', required: false },
  story2: { type: Schema.Types.ObjectId, ref: 'Story', required: false },
  story: { type: String, enum: ['H', 'N'], required: false },
  createdAt: { type: Date, default: () => new Date() },
});

AssignmentSchema.index({ experiment: 1, student: 1 }, { unique: true });

// Performance indexes
AssignmentSchema.index({ condition: 1, experiment: 1 }); // Group by condition for A/B testing

export const Assignment = mongoose.model<IAssignment>('Assignment', AssignmentSchema);
