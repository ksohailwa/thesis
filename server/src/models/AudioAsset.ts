import mongoose, { Schema, Document, Types } from 'mongoose';

export type AudioAssetKind = 'story-full' | 'story-segment' | 'word';

export interface IAudioAsset extends Document {
  experiment: Types.ObjectId;
  kind: AudioAssetKind;
  label?: 'A' | 'B';
  storySet?: 'set1' | 'set2';
  key: string;
  word?: string;
  contentType: string;
  data: Buffer;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

const AudioAssetSchema = new Schema<IAudioAsset>(
  {
    experiment: { type: Schema.Types.ObjectId, ref: 'Experiment', required: true, index: true },
    kind: { type: String, enum: ['story-full', 'story-segment', 'word'], required: true, index: true },
    label: { type: String, enum: ['A', 'B'], required: false },
    storySet: { type: String, enum: ['set1', 'set2'], default: 'set1' },
    key: { type: String, required: true },
    word: { type: String, required: false, index: true },
    contentType: { type: String, default: 'audio/mpeg' },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true }
);

AudioAssetSchema.index({ experiment: 1, kind: 1, label: 1, storySet: 1, key: 1 });
AudioAssetSchema.index({ experiment: 1, kind: 1, word: 1 });

export const AudioAsset =
  mongoose.models.AudioAsset || mongoose.model<IAudioAsset>('AudioAsset', AudioAssetSchema);
