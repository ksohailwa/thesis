import mongoose, { Schema, Types } from 'mongoose';

export interface IExperiment {
  _id: Types.ObjectId;
  owner?: string;
  classCode: string; // join code
  code?: string; // alias for classCode
  title: string;
  description?: string;
  level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'; // alias
  cefr?: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  targetWords: string[];
  randomSeed?: string;
  seed?: string;
  assignedCondition?: 'with-hints' | 'without-hints';
  status?: 'draft' | 'live' | 'closed' | 'archived';
  // Single story per condition: story1 (with hints) and story2 (without hints)
  stories?: {
    story1?: { level?: string; targetWords: string[] };
    story2?: { level?: string; targetWords: string[] };
  };
  storyRefs?: { story1?: Types.ObjectId; story2?: Types.ObjectId };
}

const ExperimentSchema = new Schema<IExperiment>(
  {
    owner: { type: String, index: true },
    classCode: { type: String, required: true, index: true, unique: true },
    code: { type: String, index: true, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    level: { type: String },
    cefr: { type: String },
    targetWords: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 5,
        message: 'Target words must be between 0 and 5',
      },
    },
    randomSeed: { type: String },
    seed: { type: String },
    assignedCondition: { type: String, enum: ['with-hints', 'without-hints'], required: false },
    status: { type: String, enum: ['draft', 'live', 'closed', 'archived'], default: 'draft' },
    stories: {
      story1: { level: { type: String }, targetWords: { type: [String], default: [] } },
      story2: { level: { type: String }, targetWords: { type: [String], default: [] } },
    },
    storyRefs: {
      story1: { type: Schema.Types.ObjectId, ref: 'Story' },
      story2: { type: Schema.Types.ObjectId, ref: 'Story' },
    },
  },
  { timestamps: true }
);

export const Experiment =
  mongoose.models.Experiment || mongoose.model<IExperiment>('Experiment', ExperimentSchema);
