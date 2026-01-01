// Express app module (extracted for testing)
import express from 'express';
import cors from 'cors';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
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
const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

// Storage config file path
const CONFIG_DIR = process.env.CONFIG_DIR || join(process.cwd(), 'data');
const STORAGE_CONFIG_FILE = join(CONFIG_DIR, 'storage-config.json');

function debug(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

// Load stored credentials (file takes precedence over env vars)
function loadStoredCredentials() {
  try {
    if (existsSync(STORAGE_CONFIG_FILE)) {
      const data = JSON.parse(readFileSync(STORAGE_CONFIG_FILE, 'utf-8'));
      return {
        accessKey: data.s3AccessKey || '',
        secretKey: data.s3SecretKey || '',
      };
    }
  } catch (err) {
    debug('Error loading stored credentials:', err.message);
  }
  // Fall back to environment variables
  return {
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
  };
}

// Save credentials to file
function saveStoredCredentials(accessKey, secretKey) {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // Load existing config to preserve secret if not provided
    let existingConfig = {};
    if (existsSync(STORAGE_CONFIG_FILE)) {
      existingConfig = JSON.parse(readFileSync(STORAGE_CONFIG_FILE, 'utf-8'));
    }

    const config = {
      s3AccessKey: accessKey,
      s3SecretKey: secretKey || existingConfig.s3SecretKey || '',
      updatedAt: new Date().toISOString(),
    };

    writeFileSync(STORAGE_CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (err) {
    debug('Error saving credentials:', err.message);
    return false;
  }
}

// Get current S3 credentials
let currentCredentials = loadStoredCredentials();

// Initialize S3 client
function createS3Client() {
  const config = {
    region: S3_REGION,
  };

  const creds = loadStoredCredentials();
  if (creds.accessKey && creds.secretKey) {
    config.credentials = {
      accessKeyId: creds.accessKey,
      secretAccessKey: creds.secretKey,
    };
  }

  if (S3_ENDPOINT) {
    config.endpoint = S3_ENDPOINT;
    config.forcePathStyle = true;
  }

  return new S3Client(config);
}

let s3Client = createS3Client();

// Reinitialize S3 client with new credentials
function reinitializeS3Client() {
  currentCredentials = loadStoredCredentials();
  s3Client = createS3Client();
  debug('S3 client reinitialized');
}

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

  // Get storage configuration
  app.get('/api/storage-config', (req, res) => {
    const creds = loadStoredCredentials();
    res.json({
      s3Endpoint: S3_ENDPOINT,
      s3Bucket: S3_BUCKET,
      s3AccessKey: creds.accessKey,
      // Never return the secret key
      hasCredentials: !!(creds.accessKey && creds.secretKey),
    });
  });

  // Save storage credentials
  app.post('/api/storage-config', (req, res) => {
    const { s3AccessKey, s3SecretKey } = req.body;

    if (!s3AccessKey) {
      return res.status(400).json({ error: 'Access key is required' });
    }

    // If secret key not provided, we keep the existing one
    const success = saveStoredCredentials(s3AccessKey, s3SecretKey);

    if (success) {
      reinitializeS3Client();
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to save credentials' });
    }
  });

  // Test S3 connection
  app.get('/api/storage-test', async (req, res) => {
    try {
      const command = new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        MaxKeys: 1,
      });
      await s3Client.send(command);
      res.json({ success: true, message: `Connected to bucket: ${S3_BUCKET}` });
    } catch (error) {
      debug('S3 connection test failed:', error.message);
      res.status(400).json({ success: false, error: error.message });
    }
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
