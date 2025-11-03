import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEvent extends Document {
  session: Types.ObjectId;
  student: Types.ObjectId;
  taskType: string;
  targetWord?: string;
  type: 'audio_play'|'audio_pause'|'audio_skip'|'key'|'hint_request'|'reveal'|'focus'|'blur'|'effort';
  payload: any;
  ts: Date;
}

const EventSchema = new Schema<IEvent>({
  session: { type: Schema.Types.ObjectId, ref: 'ClassSession', required: true },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  taskType: { type: String, required: true },
  targetWord: { type: String },
  type: { type: String, required: true },
  payload: { type: Schema.Types.Mixed },
  ts: { type: Date, default: () => new Date() }
});

export const Event = mongoose.model<IEvent>('Event', EventSchema);

