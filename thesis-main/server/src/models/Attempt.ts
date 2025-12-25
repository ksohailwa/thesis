import mongoose, { Schema, Document, Types } from 'mongoose';
import type { TaskType } from '../types';

interface IAttemptItem {
  text: string;
  timestamp: Date;
  correctnessByPosition?: boolean[];
}

export interface IAttempt extends Document {
  session: Types.ObjectId; // legacy: ClassSession or Experiment in v2
  experiment?: Types.ObjectId; // v2 reference (optional)
  student: Types.ObjectId;
  storyTemplate: Types.ObjectId; // legacy template reference
  story?: Types.ObjectId; // v2 story reference
  taskType: TaskType;
  targetWord: string; // alias for v2 'word'
  // Phase labels for occurrence tracking:
  // - baseline (1st occurrence): Prior knowledge assessment
  // - learning (2nd occurrence): First practice attempt
  // - reinforcement (3rd occurrence): Second practice attempt
  // - recall (4th occurrence): Immediate recall assessment
  phase?: 'baseline' | 'learning' | 'reinforcement' | 'recall';
  // legacy condition stored template condition; v2 uses abCondition
  condition: string;
  abCondition?: 'with-hints' | 'without-hints';
  attempts: IAttemptItem[];
  revealed: boolean;
  hintCount: number;
  finalText: string;
  score: number;
  latencyMsFirst?: number;
  totalTimeMs?: number;
  createdAt: Date;
}

const AttemptSchema = new Schema<IAttempt>({
  session: { type: Schema.Types.ObjectId, ref: 'ClassSession', required: true },
  experiment: { type: Schema.Types.ObjectId, ref: 'Experiment' },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  storyTemplate: { type: Schema.Types.ObjectId, ref: 'StoryTemplate' },
  story: { type: Schema.Types.ObjectId, ref: 'Story' },
  taskType: {
    type: String,
    enum: ['gap-fill', 'immediate-recall', 'delayed-recall'],
    required: true,
  },
  targetWord: { type: String, required: true },
  phase: {
    type: String,
    enum: ['baseline', 'learning', 'reinforcement', 'recall'],
    default: undefined,
  },
  condition: { type: String, required: true },
  abCondition: { type: String, enum: ['with-hints', 'without-hints'], default: undefined },
  attempts: [
    {
      text: String,
      timestamp: { type: Date, default: () => new Date() },
      correctnessByPosition: [Boolean],
    },
  ],
  revealed: { type: Boolean, default: false },
  hintCount: { type: Number, default: 0 },
  finalText: { type: String, default: '' },
  score: { type: Number, default: 0 },
  latencyMsFirst: Number,
  totalTimeMs: Number,
  createdAt: { type: Date, default: () => new Date() },
});
// Ensure one attempt per (session, student, template, task, word, phase)
AttemptSchema.index(
  { session: 1, student: 1, storyTemplate: 1, taskType: 1, targetWord: 1, phase: 1 },
  { unique: true }
);
// Performance indexes for common queries
AttemptSchema.index({ student: 1, createdAt: -1 }); // Student's recent attempts
AttemptSchema.index({ experiment: 1, student: 1 }); // Experiment analytics per student
AttemptSchema.index({ session: 1, taskType: 1 }); // Session analytics by task type
AttemptSchema.index({ targetWord: 1, score: 1 }); // Word difficulty analysis

export const Attempt = mongoose.model<IAttempt>('Attempt', AttemptSchema);
