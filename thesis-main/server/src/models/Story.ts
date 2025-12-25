import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IStoryOccurrence {
  word: string;
  paragraphIndex: number;
  sentenceIndex: number;
  charStart?: number;
  charEnd?: number;
}

export interface IStory extends Document {
  experiment: Types.ObjectId;
  label: 'A' | 'B';
  storySet?: 'set1' | 'set2';
  paragraphs: string[]; // exactly 5 paragraphs
  targetOccurrences: IStoryOccurrence[]; // exactly 5 per word (one per paragraph)
  noiseOccurrences?: IStoryOccurrence[];
  ttsAudioUrl?: string;
  ttsSegments?: string[];
  createdAt: Date;
}

const StorySchema = new Schema<IStory>({
  experiment: { type: Schema.Types.ObjectId, ref: 'Experiment', required: true },
  label: { type: String, enum: ['A', 'B'], required: true },
  storySet: { type: String, enum: ['set1', 'set2'], default: 'set1' },
  paragraphs: { type: [String], default: [] },
  targetOccurrences: {
    type: [
      {
        word: String,
        paragraphIndex: Number,
        sentenceIndex: Number,
        charStart: Number,
        charEnd: Number,
      },
    ],
    default: [],
  },
  noiseOccurrences: {
    type: [
      {
        word: String,
        paragraphIndex: Number,
        sentenceIndex: Number,
        charStart: Number,
        charEnd: Number,
      },
    ],
    default: [],
  },
  ttsAudioUrl: { type: String },
  ttsSegments: { type: [String], default: [] },
  createdAt: { type: Date, default: () => new Date() },
});

StorySchema.index({ experiment: 1, label: 1 }, { unique: true });

export const Story = mongoose.model<IStory>('Story', StorySchema);
