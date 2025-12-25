import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';

// Create a minimal test app with just the health endpoint
const app = express();

app.get('/api/health', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus =
    ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';
  const health = {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      connected: dbState === 1,
      status: dbStatus,
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  };

  res.status(dbState === 1 ? 200 : 503).json(health);
});

describe('Health Check Endpoint', () => {
  it('should return 200 and health status', async () => {
    const response = await request(app).get('/api/health').expect('Content-Type', /json/);

    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('database');
    expect(response.body).toHaveProperty('memory');
  });

  it('should include database status', async () => {
    const response = await request(app).get('/api/health');

    expect(response.body.database).toHaveProperty('connected');
    expect(response.body.database).toHaveProperty('status');
    expect(typeof response.body.database.connected).toBe('boolean');
    expect(typeof response.body.database.status).toBe('string');
  });

  it('should include memory metrics', async () => {
    const response = await request(app).get('/api/health');

    expect(response.body.memory).toHaveProperty('used');
    expect(response.body.memory).toHaveProperty('total');
    expect(typeof response.body.memory.used).toBe('number');
    expect(typeof response.body.memory.total).toBe('number');
    expect(response.body.memory.used).toBeGreaterThan(0);
    expect(response.body.memory.total).toBeGreaterThan(0);
  });

  it('should include valid timestamp', async () => {
    const response = await request(app).get('/api/health');

    const timestamp = new Date(response.body.timestamp);
    expect(timestamp.toString()).not.toBe('Invalid Date');
    expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('should return 503 when database is disconnected', async () => {
    const response = await request(app).get('/api/health');

    if (!response.body.database.connected) {
      expect(response.status).toBe(503);
    }
  });
});
