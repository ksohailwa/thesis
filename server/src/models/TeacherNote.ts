import mongoose, { Schema, Document } from 'mongoose';

export interface ITeacherNote extends Document {
  word: string;
  cefr: string;
  note: string;
  author: mongoose.Types.ObjectId;
  helpful: number;
  createdAt: Date;
}

const NoteSchema = new Schema<ITeacherNote>({
  word: { type: String, required: true, index: true },
  cefr: { type: String, required: true },
  note: { type: String, required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  helpful: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

NoteSchema.index({ word: 1, cefr: 1, helpful: -1 });

export const TeacherNote = mongoose.model<ITeacherNote>('TeacherNote', NoteSchema);
