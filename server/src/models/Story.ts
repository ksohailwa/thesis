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
  label: 'A'|'B'|'H'|'N';
  paragraphs: string[]; // 5 paragraphs
  targetOccurrences: IStoryOccurrence[]; // exactly 4 per word
  ttsAudioUrl?: string;
  ttsSegments?: string[];
  createdAt: Date;
}

const StorySchema = new Schema<IStory>({
  experiment: { type: Schema.Types.ObjectId, ref: 'Experiment', required: true },
  label: { type: String, enum: ['A','B','H','N'], required: true },
  paragraphs: { type: [String], default: [] },
  targetOccurrences: { type: [{ word: String, paragraphIndex: Number, sentenceIndex: Number, charStart: Number, charEnd: Number }], default: [] },
  ttsAudioUrl: { type: String },
  ttsSegments: { type: [String], default: [] },
  createdAt: { type: Date, default: () => new Date() }
});

StorySchema.index({ experiment: 1, label: 1 }, { unique: true });

export const Story = mongoose.model<IStory>('Story', StorySchema);
