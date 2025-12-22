// Express app module (extracted for testing)
import express from 'express';
import cors from 'cors';
import { join } from 'path';
import * as tar from 'tar';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import {
  parseTimingContent,
  getRecordingDurationFromContent,
  getTypescriptHeaderOffset,
  getS3Key as getS3KeyUtil,
  extractFolderFromKey,
  streamToBuffer,
  streamToString,
} from './utils.js';

// S3 Configuration from environment variables
const S3_BUCKET = process.env.S3_BUCKET || 'shellsight-recordings';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ENDPOINT = process.env.S3_ENDPOINT || '';
const S3_PREFIX = process.env.S3_PREFIX || '';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';
const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

function debug(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

// Initialize S3 client
const s3ClientConfig = {
  region: S3_REGION,
};

if (S3_ACCESS_KEY && S3_SECRET_KEY) {
  s3ClientConfig.credentials = {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  };
}

if (S3_ENDPOINT) {
  s3ClientConfig.endpoint = S3_ENDPOINT;
  s3ClientConfig.forcePathStyle = true;
}

const s3Client = new S3Client(s3ClientConfig);

// Get object from S3
async function getS3Object(key) {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  const response = await s3Client.send(command);
  return response.Body;
}

async function getS3ObjectAsString(key) {
  const stream = await getS3Object(key);
  return streamToString(stream);
}

async function getS3ObjectAsBuffer(key) {
  const stream = await getS3Object(key);
  return streamToBuffer(stream);
}

function getS3Key(folderName, fileName) {
  return getS3KeyUtil(S3_PREFIX, folderName, fileName);
}

async function listRecordingFolders() {
  const folders = new Set();
  let continuationToken = undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: S3_PREFIX,
      ContinuationToken: continuationToken,
    });

    debug('S3 ListObjectsV2 request:', { bucket: S3_BUCKET, prefix: S3_PREFIX });
    const response = await s3Client.send(command);
    debug('S3 ListObjectsV2 response - keyCount:', response.KeyCount, 'keys:', response.Contents?.map(c => c.Key));

    if (response.Contents) {
      for (const obj of response.Contents) {
        const folder = extractFolderFromKey(obj.Key, S3_PREFIX);
        if (folder) {
          debug('Adding folder:', folder);
          folders.add(folder);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return Array.from(folders);
}

async function isValidRecording(folderName) {
  const s3Prefix = S3_PREFIX ? (S3_PREFIX.endsWith('/') ? S3_PREFIX : S3_PREFIX + '/') : '';
  const prefix = `${s3Prefix}${folderName}/`;

  const command = new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: prefix,
  });

  const response = await s3Client.send(command);
  const keys = (response.Contents || []).map(obj => obj.Key);

  const hasTimingFile = keys.some(key => key.endsWith('/timing'));
  const hasTypescriptFile = keys.some(key => key.endsWith('/typescript'));

  return hasTimingFile && hasTypescriptFile;
}

// Create Express app
export function createApp(options = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // API to list all script folders from S3
  app.get('/api/script-folders', async (req, res) => {
    try {
      debug('Listing folders from S3 bucket:', S3_BUCKET);
      debug('S3 endpoint:', S3_ENDPOINT || 'default AWS');
      debug('S3 prefix:', S3_PREFIX || '(none)');

      const allFolders = await listRecordingFolders();
      debug('Found folders:', allFolders);

      const validFolders = [];
      for (const folder of allFolders) {
        const isValid = await isValidRecording(folder);
        debug(`Folder ${folder} valid:`, isValid);
        if (isValid) {
          try {
            const timingKey = getS3Key(folder, 'timing');
            const timingContent = await getS3ObjectAsString(timingKey);
            const duration = getRecordingDurationFromContent(timingContent);

            validFolders.push({
              name: folder,
              displayName: folder.replace(/^\./, ''),
              duration,
            });
          } catch (err) {
            debug(`Error getting duration for ${folder}:`, err.message);
            validFolders.push({
              name: folder,
              displayName: folder.replace(/^\./, ''),
              duration: 0,
            });
          }
        }
      }

      debug('Returning valid folders:', validFolders.length);
      res.json({ folders: validFolders });
    } catch (error) {
      console.error('Error listing folders from S3:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API to get script content from S3
  app.get('/api/script-content/:folder', async (req, res) => {
    try {
      const typescriptKey = getS3Key(req.params.folder, 'typescript');
      const content = await getS3ObjectAsString(typescriptKey);
      res.json({ content });
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return res.status(404).json({ error: 'Script file not found' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // API to download script recording as tgz from S3
  app.get('/api/script-download/:folder', async (req, res) => {
    try {
      const folderName = req.params.folder;
      const timingKey = getS3Key(folderName, 'timing');
      const typescriptKey = getS3Key(folderName, 'typescript');

      const [timingBuffer, typescriptBuffer] = await Promise.all([
        getS3ObjectAsBuffer(timingKey),
        getS3ObjectAsBuffer(typescriptKey),
      ]);

      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', `attachment; filename="${folderName}.tgz"`);

      const { mkdtempSync, writeFileSync, rmSync, mkdirSync } = await import('fs');
      const { tmpdir } = await import('os');

      const tempDir = mkdtempSync(join(tmpdir(), 'shellsight-'));
      const folderDir = join(tempDir, folderName);
      mkdirSync(folderDir);

      writeFileSync(join(folderDir, 'timing'), timingBuffer);
      writeFileSync(join(folderDir, 'typescript'), typescriptBuffer);

      tar.create(
        {
          gzip: true,
          cwd: tempDir,
        },
        [folderName]
      ).pipe(res).on('finish', () => {
        rmSync(tempDir, { recursive: true, force: true });
      });
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return res.status(404).json({ error: 'Script files not found' });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', bucket: S3_BUCKET, endpoint: S3_ENDPOINT || 'AWS' });
  });

  return app;
}

// Export for testing
export {
  s3Client,
  getS3Object,
  getS3ObjectAsString,
  getS3ObjectAsBuffer,
  getS3Key,
  listRecordingFolders,
  isValidRecording,
  parseTimingContent,
  getRecordingDurationFromContent,
  getTypescriptHeaderOffset,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_PREFIX,
};
