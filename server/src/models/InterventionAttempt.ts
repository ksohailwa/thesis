import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMCQAttempt {
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timestamp: Date;
}

export interface IJumbleAttempt {
  arrangement: string;
  isCorrect: boolean;
  timestamp: Date;
}

export interface ISentenceAttempt {
  sentence: string;
  usedTargetWord: boolean;
  usedBaseWord: boolean;
  baseWord: string;
  isValid: boolean;
  feedback: string;
  timestamp: Date;
}

export interface IInterventionAttempt extends Document {
  experiment: Types.ObjectId;
  student: Types.ObjectId;
  story: Types.ObjectId;
  targetWord: string;
  occurrenceIndex: number;
  paragraphIndex: number;

  // Exercise 1: MCQ/Definition Match
  mcqAttempts: IMCQAttempt[];
  mcqCompleted: boolean;

  // Exercise 2: Jumbled Spelling
  jumbleAttempts: IJumbleAttempt[];
  jumbleCompleted: boolean;

  // Exercise 3: Sentence Making
  sentenceAttempts: ISentenceAttempt[];
  sentenceCompleted: boolean;

  // Overall status
  allExercisesCompleted: boolean;
  completedAt: Date | null;
  totalTimeMs: number;
  startedAt: Date;
  createdAt: Date;
}

const InterventionAttemptSchema = new Schema<IInterventionAttempt>({
  experiment: { type: Schema.Types.ObjectId, ref: 'Experiment', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  story: { type: Schema.Types.ObjectId, ref: 'Story', required: true },
  targetWord: { type: String, required: true },
  occurrenceIndex: { type: Number, required: true },
  paragraphIndex: { type: Number, required: true },

  mcqAttempts: [
    {
      selectedAnswer: String,
      correctAnswer: String,
      isCorrect: Boolean,
      timestamp: { type: Date, default: () => new Date() },
    },
  ],
  mcqCompleted: { type: Boolean, default: false },

  jumbleAttempts: [
    {
      arrangement: String,
      isCorrect: Boolean,
      timestamp: { type: Date, default: () => new Date() },
    },
  ],
  jumbleCompleted: { type: Boolean, default: false },

  sentenceAttempts: [
    {
      sentence: String,
      usedTargetWord: Boolean,
      usedBaseWord: Boolean,
      baseWord: String,
      isValid: Boolean,
      feedback: String,
      timestamp: { type: Date, default: () => new Date() },
    },
  ],
  sentenceCompleted: { type: Boolean, default: false },

  allExercisesCompleted: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
  totalTimeMs: { type: Number, default: 0 },
  startedAt: { type: Date, default: () => new Date() },
  createdAt: { type: Date, default: () => new Date() },
});

// One intervention per word occurrence per student
InterventionAttemptSchema.index(
  { experiment: 1, student: 1, story: 1, targetWord: 1, occurrenceIndex: 1 },
  { unique: true }
);
// Performance indexes
InterventionAttemptSchema.index({ student: 1, createdAt: -1 });
InterventionAttemptSchema.index({ experiment: 1, allExercisesCompleted: 1 });

export const InterventionAttempt = mongoose.model<IInterventionAttempt>(
  'InterventionAttempt',
  InterventionAttemptSchema
);
