import mongoose, { Schema, Document } from 'mongoose';
import type { Role } from '../types';

export interface IUser extends Document {
  email?: string;
  username?: string; // for students
  passwordHash: string;
  role: Role;
  consentAt?: Date;
  consentVersion?: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, unique: true, sparse: true, index: true },
  username: { type: String, unique: true, sparse: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['teacher', 'student'], required: true },
  consentAt: { type: Date, required: false },
  consentVersion: { type: String, required: false },
  createdAt: { type: Date, default: () => new Date() },
});

export const User = mongoose.model<IUser>('User', UserSchema);
