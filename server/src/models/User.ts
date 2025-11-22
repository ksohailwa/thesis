import mongoose, { Schema, Document } from 'mongoose';
import type { Role } from '../types';

export interface IUser extends Document {
  email?: string;
  username?: string; // for students
  passwordHash: string;
  role: Role;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, unique: true, sparse: true, index: true },
  username: { type: String, unique: true, sparse: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['teacher', 'student'], required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export const User = mongoose.model<IUser>('User', UserSchema);
