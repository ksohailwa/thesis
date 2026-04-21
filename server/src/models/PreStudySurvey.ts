import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPreStudySurvey extends Document {
  student: Types.ObjectId;
  experiment: Types.ObjectId;
  completedAt: Date;
  // Cognitive Offloading Scale (Barr et al. 2015)
  offloadingItems: number[]; // length 5, each 1-6
  offloadingScore: number; // average 1-6
  // Optional: AI engagement items (future use)
  aiEngagementItems?: number[]; // length 5, 1-6
  aiEngagementScore?: number; // average 1-6
  cronbachAlpha?: number; // computed when enough responses exist
}

const PreStudySurveySchema = new Schema<IPreStudySurvey>({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  experiment: { type: Schema.Types.ObjectId, ref: 'Experiment', required: true },
  completedAt: { type: Date, default: () => new Date() },
  offloadingItems: {
    type: [Number],
    validate: {
      validator: (v: number[]) => Array.isArray(v) && v.length === 5 && v.every((x) => x >= 1 && x <= 6),
      message: 'offloadingItems must be an array of 5 numbers (1-6)',
    },
    required: true,
  },
  offloadingScore: { type: Number, min: 1, max: 6, required: true },
  aiEngagementItems: {
    type: [Number],
    validate: {
      validator: (v: number[] | undefined) => !v || (Array.isArray(v) && v.length === 5 && v.every((x) => x >= 1 && x <= 6)),
      message: 'aiEngagementItems must be an array of 5 numbers (1-6)',
    },
    required: false,
  },
  aiEngagementScore: { type: Number, min: 1, max: 6, required: false },
  cronbachAlpha: { type: Number, required: false },
});

PreStudySurveySchema.index({ experiment: 1, student: 1 }, { unique: true });

export const PreStudySurvey =
  mongoose.models.PreStudySurvey || mongoose.model<IPreStudySurvey>('PreStudySurvey', PreStudySurveySchema);
