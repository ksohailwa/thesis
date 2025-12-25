import request from 'supertest';
import { app } from '../../app';
import mongoose from 'mongoose';

describe('Health Check API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('should return 200 OK when connected', async () => {
    // Mock readyState to be 1 (connected)
    jest.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

    const res = await request(app).get('/api/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.ok).toBe(true);
  });

  it('should return 503 when disconnected', async () => {
    // Mock readyState to be 0 (disconnected)
    jest.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0);

    const res = await request(app).get('/api/health');
    expect(res.statusCode).toEqual(503);
    expect(res.body.ok).toBe(false);
  });
});
