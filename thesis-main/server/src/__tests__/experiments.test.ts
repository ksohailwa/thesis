import request from 'supertest';
import { app } from '../app';
import { connectDB } from '../db';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Experiment } from '../models/Experiment';
import { signAccessToken } from '../utils/jwt';

const PRIMARY_TEACHER = 'teacher@test.com';
const SECONDARY_TEACHER = 'other@test.com';

async function ensureTeacher(email: string) {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      passwordHash: 'dummy',
      role: 'teacher',
    });
  }
  return signAccessToken({
    sub: String(user._id),
    email: user.email,
    role: user.role,
  });
}

describe('Experiment Story Flow', () => {
  let authToken: string;
  let experimentId: string;

  beforeAll(async () => {
    await connectDB();
    authToken = await ensureTeacher(PRIMARY_TEACHER);
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: [PRIMARY_TEACHER, SECONDARY_TEACHER] } });
    await Experiment.deleteMany({});
    await mongoose.connection.close();
  });

  it('creates a new experiment for the logged-in teacher', async () => {
    const res = await request(app)
      .post('/api/experiments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Test Experiment', level: 'B1' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('classCode');
    experimentId = res.body.id;
  });

  it('returns ownership metadata for verification', async () => {
    const res = await request(app)
      .get(`/api/experiments/${experimentId}/owner`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      experimentId,
      isOwner: true,
      ownerId: expect.any(String),
    });
  });

  it('fetches word suggestions', async () => {
    const res = await request(app)
      .post(`/api/experiments/${experimentId}/word-suggestions`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ story: 'story1' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('saves story words for the owner', async () => {
    const res = await request(app)
      .post(`/api/experiments/${experimentId}/story-words`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ story: 'story1', targetWords: ['test', 'example', 'story'] });
    expect(res.status).toBe(200);
  });

  it('denies story-word access to other teachers (ownership enforcement)', async () => {
    const otherToken = await ensureTeacher(SECONDARY_TEACHER);
    const res = await request(app)
      .post(`/api/experiments/${experimentId}/story-words`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ story: 'story1', targetWords: ['intruder'] });
    expect(res.status).toBe(403);
  });
});
