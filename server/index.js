import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as tar from 'tar';
import { Readable } from 'stream';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// S3 Configuration from environment variables
const S3_BUCKET = process.env.S3_BUCKET || 'shellsight-recordings';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ENDPOINT = process.env.S3_ENDPOINT || ''; // Custom endpoint for S3-compatible storage (e.g., RustFS, MinIO)
const S3_PREFIX = process.env.S3_PREFIX || ''; // Optional prefix/folder in bucket
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';

// Initialize S3 client
const s3ClientConfig = {
  region: S3_REGION,
};

// Configure credentials
if (S3_ACCESS_KEY && S3_SECRET_KEY) {
  s3ClientConfig.credentials = {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  };
}

// Configure custom endpoint for S3-compatible storage (RustFS, MinIO, etc.)
if (S3_ENDPOINT) {
  s3ClientConfig.endpoint = S3_ENDPOINT;
  s3ClientConfig.forcePathStyle = true; // Required for most S3-compatible services
}

const s3Client = new S3Client(s3ClientConfig);

// Helper to convert S3 stream to buffer
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Helper to convert S3 stream to string
async function streamToString(stream) {
  const buffer = await streamToBuffer(stream);
  return buffer.toString('utf-8');
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

// Get object as string from S3
async function getS3ObjectAsString(key) {
  const stream = await getS3Object(key);
  return streamToString(stream);
}

// Get object as buffer from S3
async function getS3ObjectAsBuffer(key) {
  const stream = await getS3Object(key);
  return streamToBuffer(stream);
}

// Parse timing file content into array of {delay, bytes} entries
function parseTimingContent(content) {
  const lines = content.trim().split('\n');
  const entries = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) {
      const delay = parseFloat(parts[0]);
      const bytes = parseInt(parts[1], 10);
      if (!isNaN(delay) && !isNaN(bytes)) {
        entries.push({ delay, bytes });
      }
    }
  }

  return entries;
}

// Calculate duration from timing content (sum of all delay values)
function getRecordingDurationFromContent(timingContent) {
  try {
    const entries = parseTimingContent(timingContent);
    return entries.reduce((sum, entry) => sum + entry.delay, 0);
  } catch (error) {
    return 0;
  }
}

// List all recording folders from S3
async function listRecordingFolders() {
  const folders = new Set();
  let continuationToken = undefined;

  // List all objects and extract folder names from keys
  // This is more compatible with various S3-like implementations
  do {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: S3_PREFIX,
      ContinuationToken: continuationToken,
    });

    console.log('S3 ListObjectsV2 request:', { bucket: S3_BUCKET, prefix: S3_PREFIX });
    const response = await s3Client.send(command);
    console.log('S3 ListObjectsV2 response - keyCount:', response.KeyCount, 'keys:', response.Contents?.map(c => c.Key));

    if (response.Contents) {
      for (const obj of response.Contents) {
        // Extract folder name from key like "SSNREC/folder/timing"
        let key = obj.Key;
        console.log('Processing key:', key);

        // Remove prefix (handle with or without trailing slash)
        if (S3_PREFIX) {
          const prefixWithSlash = S3_PREFIX.endsWith('/') ? S3_PREFIX : S3_PREFIX + '/';
          if (key.startsWith(prefixWithSlash)) {
            key = key.slice(prefixWithSlash.length);
          } else if (key.startsWith(S3_PREFIX)) {
            key = key.slice(S3_PREFIX.length);
          }
          console.log('After prefix removal:', key);
        }

        // Remove leading slash if present
        key = key.replace(/^\//, '');
        const parts = key.split('/');
        console.log('Parts:', parts, 'length:', parts.length);
        if (parts.length >= 2 && parts[0]) {
          console.log('Adding folder:', parts[0]);
          folders.add(parts[0]);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return Array.from(folders);
}

// Check if a recording folder has both timing and typescript files
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

// Get S3 key for a file in a recording folder
function getS3Key(folderName, fileName) {
  if (S3_PREFIX) {
    const prefix = S3_PREFIX.endsWith('/') ? S3_PREFIX : S3_PREFIX + '/';
    return `${prefix}${folderName}/${fileName}`;
  }
  return `${folderName}/${fileName}`;
}

// Debug endpoint to list raw S3 contents
app.get('/api/debug-s3', async (req, res) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: S3_PREFIX,
    });
    const response = await s3Client.send(command);
    res.json({
      bucket: S3_BUCKET,
      endpoint: S3_ENDPOINT,
      prefix: S3_PREFIX,
      keyCount: response.KeyCount,
      contents: response.Contents || [],
      commonPrefixes: response.CommonPrefixes || [],
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      name: error.name,
      bucket: S3_BUCKET,
      endpoint: S3_ENDPOINT,
    });
  }
});

// API to list all script folders from S3
app.get('/api/script-folders', async (req, res) => {
  try {
    console.log('Listing folders from S3 bucket:', S3_BUCKET);
    console.log('S3 endpoint:', S3_ENDPOINT || 'default AWS');
    console.log('S3 prefix:', S3_PREFIX || '(none)');

    const allFolders = await listRecordingFolders();
    console.log('Found folders:', allFolders);

    // Filter to only valid recordings and get their durations
    const validFolders = [];
    for (const folder of allFolders) {
      const isValid = await isValidRecording(folder);
      console.log(`Folder ${folder} valid:`, isValid);
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
          console.error(`Error getting duration for ${folder}:`, err.message);
          // Still include the folder but with 0 duration
          validFolders.push({
            name: folder,
            displayName: folder.replace(/^\./, ''),
            duration: 0,
          });
        }
      }
    }

    console.log('Returning valid folders:', validFolders.length);
    res.json({ folders: validFolders });
  } catch (error) {
    console.error('Error listing folders from S3:', error);
    res.status(500).json({ error: error.message });
  }
});

// API to get script content (for reading typescript file) from S3
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

    // Get both files from S3
    const [timingBuffer, typescriptBuffer] = await Promise.all([
      getS3ObjectAsBuffer(timingKey),
      getS3ObjectAsBuffer(typescriptKey),
    ]);

    // Set headers for tgz download
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${folderName}.tgz"`);

    // Create temporary directory structure and tar it
    const { mkdtempSync, writeFileSync, rmSync, mkdirSync } = await import('fs');
    const { tmpdir } = await import('os');

    const tempDir = mkdtempSync(join(tmpdir(), 'shellsight-'));
    const folderDir = join(tempDir, folderName);
    mkdirSync(folderDir);

    writeFileSync(join(folderDir, 'timing'), timingBuffer);
    writeFileSync(join(folderDir, 'typescript'), typescriptBuffer);

    // Create tar.gz and pipe to response
    tar.create(
      {
        gzip: true,
        cwd: tempDir,
      },
      [folderName]
    ).pipe(res).on('finish', () => {
      // Clean up temp directory
      rmSync(tempDir, { recursive: true, force: true });
    });
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return res.status(404).json({ error: 'Script files not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Find the offset after the "Script started on..." header line in typescript content
function getTypescriptHeaderOffset(buffer) {
  // Find the first newline - header ends there
  const newlineIndex = buffer.indexOf(0x0a); // '\n'
  if (newlineIndex !== -1 && buffer.slice(0, 20).toString().startsWith('Script started')) {
    return newlineIndex + 1; // Skip past the newline
  }
  return 0; // No header found, start from beginning
}

// Custom replay class that works with S3 data (pre-fetched into memory)
class ScriptReplayer {
  constructor(ws, timingContent, typescriptBuffer, initialSpeed = 1) {
    this.ws = ws;
    this.timingEntries = parseTimingContent(timingContent);
    this.typescriptBuffer = typescriptBuffer;
    this.speed = initialSpeed;
    this.currentIndex = 0;
    this.fileOffset = getTypescriptHeaderOffset(typescriptBuffer); // Skip header
    this.isRunning = false;
    this.timeoutId = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNext();
  }

  stop() {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  scheduleNext() {
    if (!this.isRunning || this.currentIndex >= this.timingEntries.length) {
      // Replay finished
      if (this.isRunning) {
        this.ws.send(JSON.stringify({ type: 'end', code: 0 }));
        this.stop();
      }
      return;
    }

    const entry = this.timingEntries[this.currentIndex];
    const adjustedDelay = (entry.delay * 1000) / this.speed; // Convert to ms and apply speed

    this.timeoutId = setTimeout(() => {
      if (!this.isRunning) return;

      // Read bytes from typescript buffer
      try {
        const endOffset = this.fileOffset + entry.bytes;
        const data = this.typescriptBuffer.slice(this.fileOffset, endOffset);
        this.fileOffset = endOffset;

        // Send data to client
        if (data.length > 0) {
          this.ws.send(JSON.stringify({
            type: 'output',
            data: data.toString('utf-8')
          }));
        }
      } catch (err) {
        console.error('Error reading typescript buffer:', err);
      }

      this.currentIndex++;
      this.scheduleNext();
    }, adjustedDelay);
  }
}

// WebSocket connection for streaming replay output
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  let currentReplayer = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.action === 'replay') {
        const folderName = data.folder;
        const timingKey = getS3Key(folderName, 'timing');
        const typescriptKey = getS3Key(folderName, 'typescript');

        // Stop any existing replay
        if (currentReplayer) {
          currentReplayer.stop();
        }

        try {
          // Fetch both files from S3
          const [timingContent, typescriptBuffer] = await Promise.all([
            getS3ObjectAsString(timingKey),
            getS3ObjectAsBuffer(typescriptKey),
          ]);

          const speed = data.speed || 1;
          const duration = getRecordingDurationFromContent(timingContent);

          ws.send(JSON.stringify({
            type: 'start',
            message: `Starting replay at ${speed}x speed...`,
            duration,
            speed
          }));

          // Create and start custom replayer
          currentReplayer = new ScriptReplayer(ws, timingContent, typescriptBuffer, speed);
          currentReplayer.start();
        } catch (err) {
          if (err.name === 'NoSuchKey') {
            ws.send(JSON.stringify({ type: 'error', message: 'Script files not found in S3' }));
          } else {
            ws.send(JSON.stringify({ type: 'error', message: err.message }));
          }
        }
      }

      if (data.action === 'stop') {
        if (currentReplayer) {
          currentReplayer.stop();
          currentReplayer = null;
          ws.send(JSON.stringify({ type: 'stopped', message: 'Replay stopped' }));
        }
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    if (currentReplayer) {
      currentReplayer.stop();
    }
    console.log('WebSocket client disconnected');
  });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`WebSocket server running on ws://${HOST}:${PORT}`);
  console.log(`Reading recordings from S3 bucket: ${S3_BUCKET}`);
  if (S3_ENDPOINT) {
    console.log(`Using S3 endpoint: ${S3_ENDPOINT}`);
  }
  if (S3_PREFIX) {
    console.log(`Using S3 prefix: ${S3_PREFIX}`);
  }
});
