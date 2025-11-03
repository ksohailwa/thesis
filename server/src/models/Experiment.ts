import mongoose, { Schema, Types } from 'mongoose';

export interface IExperiment {
  _id: Types.ObjectId;
  owner?: Types.ObjectId;
  classCode: string; // join code
  code?: string; // alias for classCode
  title: string;
  description?: string;
  level?: 'A1'|'A2'|'B1'|'B2'|'C1'|'C2'; // alias
  cefr?: 'A2'|'B1'|'B2'|'C1'|'C2';
  targetWords: string[];
  randomSeed?: string;
  seed?: string;
  assignedCondition?: 'with-hints'|'without-hints';
  status?: 'draft'|'live'|'closed';
  stories?: { H?: Types.ObjectId; N?: Types.ObjectId };
}

const ExperimentSchema = new Schema<IExperiment>({
  owner: { type: Schema.Types.ObjectId, ref: 'User' },
  classCode: { type: String, required: true, index: true, unique: true },
  code: { type: String, index: true, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  level: { type: String },
  cefr: { type: String },
  targetWords: { type: [String], default: [] },
  randomSeed: { type: String },
  seed: { type: String },
  assignedCondition: { type: String, enum: ['with-hints','without-hints'], required: false }
  , status: { type: String, enum: ['draft','live','closed'], default: 'draft' },
  stories: { H: { type: Schema.Types.ObjectId, ref: 'Story' }, N: { type: Schema.Types.ObjectId, ref: 'Story' } }
}, { timestamps: true });

export const Experiment = mongoose.models.Experiment || mongoose.model<IExperiment>('Experiment', ExperimentSchema);
