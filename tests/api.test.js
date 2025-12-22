import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock S3 client before importing app
const mockSend = jest.fn();
jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  ListObjectsV2Command: jest.fn().mockImplementation((params) => params),
  GetObjectCommand: jest.fn().mockImplementation((params) => params),
}));

// Import after mocking
const { createApp } = await import('../server/app.js');

describe('API Endpoints', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    mockSend.mockReset();
  });

  describe('GET /api/health', () => {
    test('returns health status', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('bucket');
    });
  });

  describe('GET /api/script-folders', () => {
    test('returns empty list when no folders exist', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [],
        KeyCount: 0,
      });

      const res = await request(app).get('/api/script-folders');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('folders');
      expect(res.body.folders).toEqual([]);
    });

    test('returns folders with valid recordings', async () => {
      // First call: list all objects
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'recording1/timing' },
          { Key: 'recording1/typescript' },
        ],
        KeyCount: 2,
      });

      // Second call: check valid recording
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'recording1/timing' },
          { Key: 'recording1/typescript' },
        ],
      });

      // Third call: get timing content
      mockSend.mockResolvedValueOnce({
        Body: {
          [Symbol.asyncIterator]: async function* () {
            yield Buffer.from('0.5 100\n1.0 200\n');
          },
        },
      });

      const res = await request(app).get('/api/script-folders');

      expect(res.status).toBe(200);
      expect(res.body.folders).toHaveLength(1);
      expect(res.body.folders[0]).toMatchObject({
        name: 'recording1',
        displayName: 'recording1',
      });
      expect(res.body.folders[0].duration).toBeCloseTo(1.5, 1);
    });

    test('handles S3 errors gracefully', async () => {
      mockSend.mockRejectedValueOnce(new Error('S3 connection failed'));

      const res = await request(app).get('/api/script-folders');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    test('filters out invalid recordings (missing timing)', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'valid/timing' },
          { Key: 'valid/typescript' },
          { Key: 'invalid/typescript' }, // Missing timing
        ],
        KeyCount: 3,
      });

      // Check valid recording
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'valid/timing' },
          { Key: 'valid/typescript' },
        ],
      });

      // Check invalid recording
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'invalid/typescript' },
        ],
      });

      // Get timing for valid
      mockSend.mockResolvedValueOnce({
        Body: {
          [Symbol.asyncIterator]: async function* () {
            yield Buffer.from('0.5 100\n');
          },
        },
      });

      const res = await request(app).get('/api/script-folders');

      expect(res.status).toBe(200);
      expect(res.body.folders).toHaveLength(1);
      expect(res.body.folders[0].name).toBe('valid');
    });
  });

  describe('GET /api/script-content/:folder', () => {
    test('returns script content', async () => {
      const mockContent = 'Script started on 2024-01-01\n$ ls -la\ntotal 0';
      mockSend.mockResolvedValueOnce({
        Body: {
          [Symbol.asyncIterator]: async function* () {
            yield Buffer.from(mockContent);
          },
        },
      });

      const res = await request(app).get('/api/script-content/recording1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('content', mockContent);
    });

    test('returns 404 for non-existent recording', async () => {
      const error = new Error('Not found');
      error.name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(error);

      const res = await request(app).get('/api/script-content/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Script file not found');
    });

    test('returns 500 for other errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Internal error'));

      const res = await request(app).get('/api/script-content/recording1');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/script-download/:folder', () => {
    test('returns 404 for non-existent recording', async () => {
      const error = new Error('Not found');
      error.name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(error);

      const res = await request(app).get('/api/script-download/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Script files not found');
    });
  });
});

describe('API Edge Cases', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    mockSend.mockReset();
  });

  test('handles folder names with special characters', async () => {
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'test-folder_123/timing' },
        { Key: 'test-folder_123/typescript' },
      ],
      KeyCount: 2,
    });

    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'test-folder_123/timing' },
        { Key: 'test-folder_123/typescript' },
      ],
    });

    mockSend.mockResolvedValueOnce({
      Body: {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('0.1 10\n');
        },
      },
    });

    const res = await request(app).get('/api/script-folders');

    expect(res.status).toBe(200);
    expect(res.body.folders[0].name).toBe('test-folder_123');
  });

  test('handles pagination in S3 listing', async () => {
    // First page - list all objects
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'folder1/timing' },
        { Key: 'folder1/typescript' },
      ],
      KeyCount: 2,
      NextContinuationToken: 'token123',
    });

    // Second page - list all objects (continuation)
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'folder2/timing' },
        { Key: 'folder2/typescript' },
      ],
      KeyCount: 2,
    });

    // Validation call for folder1
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'folder1/timing' },
        { Key: 'folder1/typescript' },
      ],
    });

    // Timing content for folder1
    mockSend.mockResolvedValueOnce({
      Body: {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('0.1 10\n');
        },
      },
    });

    // Validation call for folder2
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'folder2/timing' },
        { Key: 'folder2/typescript' },
      ],
    });

    // Timing content for folder2
    mockSend.mockResolvedValueOnce({
      Body: {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('0.2 20\n');
        },
      },
    });

    const res = await request(app).get('/api/script-folders');

    expect(res.status).toBe(200);
    expect(res.body.folders).toHaveLength(2);
  });

  test('handles empty timing file gracefully', async () => {
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'empty/timing' },
        { Key: 'empty/typescript' },
      ],
      KeyCount: 2,
    });

    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'empty/timing' },
        { Key: 'empty/typescript' },
      ],
    });

    mockSend.mockResolvedValueOnce({
      Body: {
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('');
        },
      },
    });

    const res = await request(app).get('/api/script-folders');

    expect(res.status).toBe(200);
    expect(res.body.folders[0].duration).toBe(0);
  });
});
