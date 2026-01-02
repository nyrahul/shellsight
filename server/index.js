import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as tar from 'tar';
import { Readable } from 'stream';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import {
  passport,
  AUTH_CONFIG,
  setupOIDC,
  generateToken,
  verifyToken,
  requireAuth,
  getAvailableProviders,
  isAuthDisabled,
} from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// CORS configuration
app.use(cors({
  origin: AUTH_CONFIG.frontendUrl,
  credentials: true,
}));
app.use(express.json());

// Session configuration
app.use(session({
  secret: AUTH_CONFIG.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
}

// Setup OIDC (async)
setupOIDC().catch(console.error);

// S3 Configuration from environment variables
const S3_BUCKET = process.env.S3_BUCKET || 'shellsight-recordings';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ENDPOINT = process.env.S3_ENDPOINT || ''; // Custom endpoint for S3-compatible storage (e.g., RustFS, MinIO)
const S3_PREFIX = process.env.S3_PREFIX || ''; // Optional prefix/folder in bucket
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
    const duration = entries.reduce((sum, entry) => sum + entry.delay, 0);
    debug('Timing entries count:', entries.length, 'Total duration:', duration);
    debug('First 3 entries:', entries.slice(0, 3));
    return duration;
  } catch (error) {
    debug('Error parsing timing content:', error.message);
    return 0;
  }
}

// Build S3 prefix for a user (bucket/prefix/userEmail/)
function getUserS3Prefix(userEmail) {
  const basePrefix = S3_PREFIX ? (S3_PREFIX.endsWith('/') ? S3_PREFIX : S3_PREFIX + '/') : '';
  return `${basePrefix}${userEmail}/`;
}

// List all recording folders from S3 for a specific user
async function listRecordingFolders(userEmail) {
  const folders = new Set();
  let continuationToken = undefined;
  const userPrefix = getUserS3Prefix(userEmail);

  // List all objects and extract folder names from keys
  // This is more compatible with various S3-like implementations
  do {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: userPrefix,
      ContinuationToken: continuationToken,
    });

    debug('S3 ListObjectsV2 request:', { bucket: S3_BUCKET, prefix: userPrefix, userEmail });
    const response = await s3Client.send(command);
    debug('S3 ListObjectsV2 response - keyCount:', response.KeyCount, 'keys:', response.Contents?.map(c => c.Key));

    if (response.Contents) {
      for (const obj of response.Contents) {
        // Extract folder name from key like "SSNREC/user@email.com/folder/timing"
        let key = obj.Key;
        debug('Processing key:', key);

        // Remove user prefix
        if (key.startsWith(userPrefix)) {
          key = key.slice(userPrefix.length);
        }
        debug('After prefix removal:', key);

        // Remove leading slash if present
        key = key.replace(/^\//, '');
        const parts = key.split('/');
        debug('Parts:', parts, 'length:', parts.length);
        if (parts.length >= 2 && parts[0]) {
          debug('Adding folder:', parts[0]);
          folders.add(parts[0]);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return Array.from(folders);
}

// Check if a recording folder has both timing and typescript files
async function isValidRecording(userEmail, folderName) {
  const userPrefix = getUserS3Prefix(userEmail);
  const prefix = `${userPrefix}${folderName}/`;

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

// Get S3 key for a file in a recording folder for a specific user
function getS3Key(userEmail, folderName, fileName) {
  const userPrefix = getUserS3Prefix(userEmail);
  return `${userPrefix}${folderName}/${fileName}`;
}

// ============= Authentication Routes =============

// Get auth status and available providers
app.get('/auth/providers', (req, res) => {
  res.json({
    disabled: isAuthDisabled(),
    providers: getAvailableProviders(),
  });
});

// Get current user
app.get('/auth/user', (req, res) => {
  // If auth is disabled, return anonymous user
  if (isAuthDisabled()) {
    const anonymousUser = {
      id: 'anonymous',
      email: 'anonymous@localhost',
      name: 'Anonymous User',
      provider: 'none',
    };
    res.json({ user: anonymousUser, token: null, authDisabled: true });
    return;
  }

  // Check Passport session first
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.json({ user: req.user, token: generateToken(req.user) });
    return;
  }

  // Check JWT token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (decoded) {
      // Return the decoded user info from the token
      const user = {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        provider: decoded.id.split(':')[0] || 'unknown',
      };
      res.json({ user });
      return;
    }
  }

  res.json({ user: null });
});

// Logout
app.post('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy();
    res.json({ success: true });
  });
});

// Google OAuth
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `${AUTH_CONFIG.frontendUrl}/login?error=google_failed` }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`${AUTH_CONFIG.frontendUrl}/auth/callback?token=${token}`);
  }
);

// GitHub OAuth
app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: `${AUTH_CONFIG.frontendUrl}/login?error=github_failed` }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`${AUTH_CONFIG.frontendUrl}/auth/callback?token=${token}`);
  }
);

// Microsoft OAuth
app.get('/auth/microsoft', passport.authenticate('microsoft', { scope: ['user.read'] }));
app.get('/auth/microsoft/callback',
  passport.authenticate('microsoft', { failureRedirect: `${AUTH_CONFIG.frontendUrl}/login?error=microsoft_failed` }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`${AUTH_CONFIG.frontendUrl}/auth/callback?token=${token}`);
  }
);

// Generic OIDC
app.get('/auth/oidc', passport.authenticate('oidc'));
app.get('/auth/oidc/callback',
  passport.authenticate('oidc', { failureRedirect: `${AUTH_CONFIG.frontendUrl}/login?error=oidc_failed` }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`${AUTH_CONFIG.frontendUrl}/auth/callback?token=${token}`);
  }
);

// ============= API Routes =============

// Health check endpoint (returns S3 config for onboarding page)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', bucket: S3_BUCKET, endpoint: S3_ENDPOINT || 'AWS', prefix: S3_PREFIX });
});

// Version endpoint (returns app version from container image tag)
app.get('/api/version', (req, res) => {
  res.json({ version: process.env.APP_VERSION || 'dev' });
});

// Dashboard stats endpoint
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const days = parseInt(req.query.days) || 7;

    // Get all recordings for the user
    const allFolders = await listRecordingFolders(userEmail);

    // Parse folder names to extract workload info and timestamps
    const recordings = [];
    const workloads = { vms: new Set(), k8s: new Set() };

    for (const folder of allFolders) {
      const isValid = await isValidRecording(userEmail, folder);
      if (!isValid) continue;

      // Parse folder name: workloadName_timestamp
      const match = folder.match(/^(.+)_(\d{10,})$/);
      if (match) {
        const workloadName = match[1];
        const timestamp = parseInt(match[2], 10) * 1000; // Convert to ms

        recordings.push({ workloadName, timestamp });

        // Classify workload: contains @ = VM, otherwise K8s
        if (workloadName.includes('@')) {
          workloads.vms.add(workloadName.split('@')[1] || workloadName);
        } else {
          workloads.k8s.add(workloadName);
        }
      }
    }

    // Calculate recordings per day for the specified period
    const now = Date.now();
    const cutoff = now - (days * 24 * 60 * 60 * 1000);
    const recordingsByDay = {};

    // Initialize all days in the range
    for (let i = 0; i < days; i++) {
      const date = new Date(now - (i * 24 * 60 * 60 * 1000));
      const dateStr = date.toISOString().split('T')[0];
      recordingsByDay[dateStr] = 0;
    }

    // Count recordings per day
    for (const rec of recordings) {
      if (rec.timestamp >= cutoff) {
        const dateStr = new Date(rec.timestamp).toISOString().split('T')[0];
        if (recordingsByDay[dateStr] !== undefined) {
          recordingsByDay[dateStr]++;
        }
      }
    }

    // Convert to array sorted by date
    const dailyRecordings = Object.entries(recordingsByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      dailyRecordings,
      totalRecordings: recordings.length,
      vmCount: workloads.vms.size,
      k8sCount: workloads.k8s.size,
      vmHosts: Array.from(workloads.vms),
      k8sPods: Array.from(workloads.k8s),
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// S3 storage stats endpoint
app.get('/api/dashboard/storage', requireAuth, async (req, res) => {
  try {
    // Note: S3 doesn't provide bucket size directly, we'd need to iterate all objects
    // For now, return basic info. Full implementation would require ListObjectsV2 pagination
    res.json({
      bucket: S3_BUCKET,
      endpoint: S3_ENDPOINT || 'AWS S3',
      // Storage stats would require iterating all objects which can be expensive
      // This is a placeholder - actual implementation depends on S3 provider capabilities
      storageAvailable: true,
    });
  } catch (error) {
    console.error('Error getting storage stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// API to list all script folders from S3 for the logged-in user
app.get('/api/script-folders', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    debug('Listing folders from S3 bucket:', S3_BUCKET);
    debug('S3 endpoint:', S3_ENDPOINT || 'default AWS');
    debug('S3 prefix:', S3_PREFIX || '(none)');
    debug('User email:', userEmail);

    const allFolders = await listRecordingFolders(userEmail);
    debug('Found folders:', allFolders);

    // Filter to only valid recordings and get their durations
    const validFolders = [];
    for (const folder of allFolders) {
      const isValid = await isValidRecording(userEmail, folder);
      debug(`Folder ${folder} valid:`, isValid);
      if (isValid) {
        try {
          const timingKey = getS3Key(userEmail, folder, 'timing');
          const timingContent = await getS3ObjectAsString(timingKey);
          const duration = getRecordingDurationFromContent(timingContent);

          validFolders.push({
            name: folder,
            displayName: folder.replace(/^\./, ''),
            duration,
          });
        } catch (err) {
          debug(`Error getting duration for ${folder}:`, err.message);
          // Still include the folder but with 0 duration
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

// API to get script content (for reading typescript file) from S3
app.get('/api/script-content/:folder', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const typescriptKey = getS3Key(userEmail, req.params.folder, 'typescript');
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
app.get('/api/script-download/:folder', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const folderName = req.params.folder;
    const timingKey = getS3Key(userEmail, folderName, 'timing');
    const typescriptKey = getS3Key(userEmail, folderName, 'typescript');

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
// Batches small delays together to reduce overhead
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
    this.minDelayMs = 10; // Batch entries with delays smaller than this
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

    // Batch entries with small delays together
    let totalDelay = 0;
    let totalBytes = 0;
    const startIndex = this.currentIndex;

    while (this.currentIndex < this.timingEntries.length) {
      const entry = this.timingEntries[this.currentIndex];
      const delayMs = (entry.delay * 1000) / this.speed;

      // If this is the first entry or delay is small, batch it
      if (this.currentIndex === startIndex || delayMs < this.minDelayMs) {
        totalDelay += entry.delay;
        totalBytes += entry.bytes;
        this.currentIndex++;

        // If accumulated delay is significant, stop batching
        if ((totalDelay * 1000) / this.speed >= this.minDelayMs) {
          break;
        }
      } else {
        // Significant delay, don't batch
        break;
      }
    }

    const adjustedDelay = (totalDelay * 1000) / this.speed;

    this.timeoutId = setTimeout(() => {
      if (!this.isRunning) return;

      // Read batched bytes from typescript buffer
      try {
        const endOffset = this.fileOffset + totalBytes;
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
        const userEmail = data.userEmail;

        if (!userEmail) {
          ws.send(JSON.stringify({ type: 'error', message: 'User email is required for replay' }));
          return;
        }

        const timingKey = getS3Key(userEmail, folderName, 'timing');
        const typescriptKey = getS3Key(userEmail, folderName, 'typescript');

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

      if (data.action === 'ping') {
        // Respond to heartbeat ping
        ws.send(JSON.stringify({ type: 'pong' }));
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

// Catch-all route for SPA (must be after all API routes)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`WebSocket server running on ws://${HOST}:${PORT}`);
  console.log(`Frontend URL (CORS): ${AUTH_CONFIG.frontendUrl}`);
  console.log(`Reading recordings from S3 bucket: ${S3_BUCKET}`);
  if (S3_ENDPOINT) {
    console.log(`Using S3 endpoint: ${S3_ENDPOINT}`);
  }
  if (S3_PREFIX) {
    console.log(`Using S3 prefix: ${S3_PREFIX}`);
  }
  if (DEBUG) {
    console.log('Debug logging enabled');
  }
  if (isAuthDisabled()) {
    console.log('Authentication is DISABLED - running in anonymous mode');
  } else {
    const providers = getAvailableProviders();
    console.log(`Authentication enabled with ${providers.length} provider(s): ${providers.map(p => p.name).join(', ') || 'none configured'}`);
  }
});
