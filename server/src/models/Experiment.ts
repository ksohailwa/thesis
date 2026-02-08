import mongoose, { Schema, Types } from 'mongoose';

// Word selection structure for the new word selection system
export interface IWordSelection {
  targetCurrent: string[];  // 4 words from current level
  targetHigher: string[];   // 4 words from higher level
  targetLower: string[];    // 2 words from lower level
  noiseCurrent: string[];   // 1 word from current level
  noiseHigher: string[];    // 1 word from higher level
  noiseLower: string[];     // 1 word from lower level
}

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
  noiseWords?: string[]; // shared noise words for both stories
  randomSeed?: string;
  seed?: string;
  assignedCondition?: 'with-hints' | 'without-hints';
  status?: 'draft' | 'live' | 'closed' | 'archived';
  storiesConfirmed?: boolean; // true when teacher has approved the stories
  wordSelection?: IWordSelection; // full word selection state
  // Single story per condition: story1 (with hints) and story2 (without hints)
  stories?: {
    story1?: { level?: string; targetWords: string[]; noiseWords?: string[] };
    story2?: { level?: string; targetWords: string[]; noiseWords?: string[] };
  };
  storyRefs?: { story1?: Types.ObjectId; story2?: Types.ObjectId };
}

const WordSelectionSchema = new Schema<IWordSelection>(
  {
    targetCurrent: { type: [String], default: [] },
    targetHigher: { type: [String], default: [] },
    targetLower: { type: [String], default: [] },
    noiseCurrent: { type: [String], default: [] },
    noiseHigher: { type: [String], default: [] },
    noiseLower: { type: [String], default: [] },
  },
  { _id: false }
);

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
        validator: (v: string[]) => v.length <= 10,
        message: 'Target words must be between 0 and 10',
      },
    },
    noiseWords: { type: [String], default: [] },
    randomSeed: { type: String },
    seed: { type: String },
    assignedCondition: { type: String, enum: ['with-hints', 'without-hints'], required: false },
    status: { type: String, enum: ['draft', 'live', 'closed', 'archived'], default: 'draft' },
    storiesConfirmed: { type: Boolean, default: false },
    wordSelection: { type: WordSelectionSchema },
    stories: {
      story1: { level: { type: String }, targetWords: { type: [String], default: [] }, noiseWords: { type: [String], default: [] } },
      story2: { level: { type: String }, targetWords: { type: [String], default: [] }, noiseWords: { type: [String], default: [] } },
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
