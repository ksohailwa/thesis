import mongoose, { Schema, Document } from 'mongoose';

export interface IExperimentTemplate extends Document {
  name: string;
  description: string;
  cefr: string;
  story1Words: string[];
  story2Words: string[];
  isPublic: boolean;
  createdBy: mongoose.Types.ObjectId;
  usageCount: number;
  rating: number;
  tags: string[];
}

const TemplateSchema = new Schema<IExperimentTemplate>(
  {
    name: { type: String, required: true },
    description: { type: String },
    cefr: { type: String, required: true },
    story1Words: [String],
    story2Words: [String],
    isPublic: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    usageCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    tags: [String],
  },
  { timestamps: true }
);

TemplateSchema.index({ isPublic: 1, cefr: 1 });
TemplateSchema.index({ usageCount: -1, rating: -1 });

export const ExperimentTemplate = mongoose.model<IExperimentTemplate>('ExperimentTemplate', TemplateSchema);
