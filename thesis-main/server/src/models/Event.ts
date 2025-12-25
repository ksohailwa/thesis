import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEvent extends Document {
  session: Types.ObjectId;
  experiment?: Types.ObjectId;
  student: Types.ObjectId;
  taskType: string;
  targetWord?: string;
  type:
    | 'audio_play'
    | 'audio_pause'
    | 'audio_skip'
    | 'key'
    | 'hint_request'
    | 'reveal'
    | 'focus'
    | 'blur'
    | 'effort';
  payload: unknown;
  ts: Date;
}

const EventSchema = new Schema<IEvent>({
  session: { type: Schema.Types.ObjectId, ref: 'ClassSession', required: true },
  experiment: { type: Schema.Types.ObjectId, ref: 'Experiment', required: false },
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  taskType: { type: String, required: true },
  targetWord: { type: String },
  type: { type: String, required: true },
  payload: { type: Schema.Types.Mixed },
  ts: { type: Date, default: () => new Date() },
});

// Performance indexes for event queries
EventSchema.index({ session: 1, ts: 1 }); // Session events ordered by time
EventSchema.index({ student: 1, type: 1 }); // Student events by type
EventSchema.index({ session: 1, type: 1 }); // Session analytics by event type
EventSchema.index({ experiment: 1, ts: 1 });

export const Event = mongoose.model<IEvent>('Event', EventSchema);
