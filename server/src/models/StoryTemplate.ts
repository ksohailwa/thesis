import mongoose, { Schema, Document, Types } from 'mongoose';
import type { Condition } from '../types';

export interface IStoryTemplate extends Document {
  owner: Types.ObjectId;
  title: string;
  language: string;
  difficulty: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  targetWords: string[];
  prompt: string;
  storyText?: string;
  ttsAudioUrl?: string;
  ttsSegments?: string[];
  condition: Condition;
  gapPolicy?: {
    occurrencesPerWord: number;
    randomize: boolean;
    distractors?: { count: number; strategy: 'frequency' | 'pos' | 'random' };
  };
  hintPolicy?: {
    cooldownMs: number;
    maxPerBlank: number;
    nearMatchThreshold: number;
    stages: { orthographicAt: number; phonemeAt: number; semanticAt: number; morphologyAt: number };
  };
  createdAt: Date;
  updatedAt: Date;
}

const StoryTemplateSchema = new Schema<IStoryTemplate>({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  language: { type: String, required: true },
  difficulty: { type: String, enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], required: true },
  targetWords: { type: [String], validate: (arr: string[]) => arr.length <= 10, required: true },
  prompt: { type: String, required: true },
  storyText: { type: String },
  ttsAudioUrl: { type: String },
  ttsSegments: { type: [String], default: [] },
  condition: { type: String, enum: ['self-generate', 'system-provided'], required: true },
  gapPolicy: {
    occurrencesPerWord: { type: Number, default: 1 },
    randomize: { type: Boolean, default: false },
    distractors: {
      count: { type: Number, default: 0 },
      strategy: { type: String, enum: ['frequency', 'pos', 'random'], default: 'random' },
    },
  },
  hintPolicy: {
    cooldownMs: { type: Number, default: 15000 },
    maxPerBlank: { type: Number, default: 3 },
    nearMatchThreshold: { type: Number, default: 0.9 },
    stages: {
      orthographicAt: { type: Number, default: 0 },
      phonemeAt: { type: Number, default: 3 },
      semanticAt: { type: Number, default: 6 },
      morphologyAt: { type: Number, default: 9 },
    },
  },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
});

StoryTemplateSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const StoryTemplate = mongoose.model<IStoryTemplate>('StoryTemplate', StoryTemplateSchema);
