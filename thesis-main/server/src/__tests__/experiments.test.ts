import request from 'supertest';
import { app } from '../index';

const PRIMARY_TEACHER = 'teacher@test.com';
const SECOND_TEACHER = 'teacher2@test.com';
const PASSWORD = 'test123';

async function ensureTeacher(email: string) {
  const signup = await request(app)
    .post('/api/auth/signup')
    .send({ email, password: PASSWORD, role: 'teacher' });
  if (signup.status !== 200 && signup.status !== 409) {
    throw new Error(`Unable to seed teacher account (${email}): status ${signup.status}`);
  }
  const login = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  expect(login.status).toBe(200);
  return login.body.accessToken;
}

describe('Experiment Story Flow', () => {
  let authToken: string;
  let experimentId: string;

  beforeAll(async () => {
    authToken = await ensureTeacher(PRIMARY_TEACHER);
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
    const otherToken = await ensureTeacher(SECOND_TEACHER);
    const res = await request(app)
      .post(`/api/experiments/${experimentId}/story-words`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ story: 'story1', targetWords: ['intruder'] });
    expect(res.status).toBe(403);
  });
});
