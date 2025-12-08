import { Schema, model, Document } from 'mongoose';

export interface IStudentFeedback extends Document {
  experiment: Schema.Types.ObjectId;
  student: Schema.Types.ObjectId;
  difficulty: number;
  enjoyment: number;
  effort: 'low' | 'medium' | 'high';
  comment?: string;
  createdAt: Date;
}

const StudentFeedbackSchema = new Schema<IStudentFeedback>({
  experiment: { type: Schema.Types.ObjectId, ref: 'Experiment', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // Assuming 'User' is the student model
  difficulty: { type: Number, required: true, min: 1, max: 5 },
  enjoyment: { type: Number, required: true, min: 1, max: 5 },
  effort: { type: String, enum: ['low', 'medium', 'high'], required: true },
  comment: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true }); // Automatically adds createdAt and updatedAt

export const StudentFeedback = model<IStudentFeedback>('StudentFeedback', StudentFeedbackSchema);
