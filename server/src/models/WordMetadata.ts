import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWordMetadata extends Document {
  experiment: Types.ObjectId;
  word: string;
  definition: string;
  partOfSpeech: string;
  // For MCQ exercise - distractor definitions
  distractorDefinitions: string[];
  // For sentence exercise - common collocations/base words
  commonCollocations: string[];
  // Example sentences for reference
  exampleSentences: string[];
  // Syllable breakdown for hints
  syllables: string[];
  createdAt: Date;
}

const WordMetadataSchema = new Schema<IWordMetadata>({
  experiment: { type: Schema.Types.ObjectId, ref: 'Experiment', required: true },
  word: { type: String, required: true },
  definition: { type: String, required: true },
  partOfSpeech: { type: String, default: '' },
  distractorDefinitions: { type: [String], default: [] },
  commonCollocations: { type: [String], default: [] },
  exampleSentences: { type: [String], default: [] },
  syllables: { type: [String], default: [] },
  createdAt: { type: Date, default: () => new Date() },
});

// Unique word per experiment
WordMetadataSchema.index({ experiment: 1, word: 1 }, { unique: true });

export const WordMetadata = mongoose.model<IWordMetadata>('WordMetadata', WordMetadataSchema);
