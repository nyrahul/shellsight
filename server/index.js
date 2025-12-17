import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readdirSync, statSync, readFileSync, existsSync, openSync, readSync, closeSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as tar from 'tar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Base directory for script recordings (configurable via SSNREC env variable)
const SSNREC_DIR = process.env.SSNREC || join(__dirname, '..', 'SSNREC');

// Parse timing file into array of {delay, bytes} entries
function parseTimingFile(timingPath) {
  const content = readFileSync(timingPath, 'utf-8');
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

// Calculate duration from timing file (sum of all delay values)
function getRecordingDuration(timingPath) {
  try {
    const entries = parseTimingFile(timingPath);
    return entries.reduce((sum, entry) => sum + entry.delay, 0);
  } catch (error) {
    return 0;
  }
}

// API to list all script folders
app.get('/api/script-folders', (req, res) => {
  try {
    if (!existsSync(SSNREC_DIR)) {
      return res.json({ folders: [], error: 'SSNREC directory not found' });
    }

    const entries = readdirSync(SSNREC_DIR);
    const folders = entries.filter(entry => {
      const entryPath = join(SSNREC_DIR, entry);
      if (!statSync(entryPath).isDirectory()) return false;

      // Check if both timing and typescript files exist
      const timingPath = join(entryPath, 'timing');
      const typescriptPath = join(entryPath, 'typescript');
      return existsSync(timingPath) && existsSync(typescriptPath);
    }).map(folder => {
      const timingPath = join(SSNREC_DIR, folder, 'timing');
      const duration = getRecordingDuration(timingPath);
      return {
        name: folder,
        displayName: folder.replace(/^\./, ''), // Remove leading dot for display
        duration, // Duration in seconds
      };
    });

    res.json({ folders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API to get script content (for reading typescript file)
app.get('/api/script-content/:folder', (req, res) => {
  try {
    const folderPath = join(SSNREC_DIR, req.params.folder);
    const typescriptPath = join(folderPath, 'typescript');

    if (!existsSync(typescriptPath)) {
      return res.status(404).json({ error: 'Script file not found' });
    }

    const content = readFileSync(typescriptPath, 'utf-8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API to download script recording as tgz
app.get('/api/script-download/:folder', (req, res) => {
  try {
    const folderName = req.params.folder;
    const folderPath = join(SSNREC_DIR, folderName);
    const timingPath = join(folderPath, 'timing');
    const typescriptPath = join(folderPath, 'typescript');

    if (!existsSync(timingPath) || !existsSync(typescriptPath)) {
      return res.status(404).json({ error: 'Script files not found' });
    }

    // Set headers for tgz download
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${folderName}.tgz"`);

    // Create tar.gz stream and pipe to response
    tar.create(
      {
        gzip: true,
        cwd: SSNREC_DIR,
        prefix: folderName
      },
      [join(folderName, 'timing'), join(folderName, 'typescript')]
    ).pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Find the offset after the "Script started on..." header line in typescript file
function getTypescriptHeaderOffset(typescriptPath) {
  try {
    const content = readFileSync(typescriptPath);
    // Find the first newline - header ends there
    const newlineIndex = content.indexOf(0x0a); // '\n'
    if (newlineIndex !== -1 && content.slice(0, 20).toString().startsWith('Script started')) {
      return newlineIndex + 1; // Skip past the newline
    }
    return 0; // No header found, start from beginning
  } catch (error) {
    return 0;
  }
}

// Custom replay class that reads timing/typescript files directly
class ScriptReplayer {
  constructor(ws, timingPath, typescriptPath, initialSpeed = 1) {
    this.ws = ws;
    this.timingEntries = parseTimingFile(timingPath);
    this.typescriptPath = typescriptPath;
    this.speed = initialSpeed;
    this.currentIndex = 0;
    this.fileOffset = getTypescriptHeaderOffset(typescriptPath); // Skip header
    this.isRunning = false;
    this.timeoutId = null;
    this.fd = null;
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.fd = openSync(this.typescriptPath, 'r');
    this.scheduleNext();
  }

  stop() {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.fd !== null) {
      closeSync(this.fd);
      this.fd = null;
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

      // Read bytes from typescript file
      const buffer = Buffer.alloc(entry.bytes);
      try {
        const bytesRead = readSync(this.fd, buffer, 0, entry.bytes, this.fileOffset);
        this.fileOffset += bytesRead;

        // Send data to client
        if (bytesRead > 0) {
          this.ws.send(JSON.stringify({
            type: 'output',
            data: buffer.slice(0, bytesRead).toString('utf-8')
          }));
        }
      } catch (err) {
        console.error('Error reading typescript file:', err);
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

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.action === 'replay') {
        const folderPath = join(SSNREC_DIR, data.folder);
        const timingPath = join(folderPath, 'timing');
        const typescriptPath = join(folderPath, 'typescript');

        if (!existsSync(timingPath) || !existsSync(typescriptPath)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Script files not found' }));
          return;
        }

        // Stop any existing replay
        if (currentReplayer) {
          currentReplayer.stop();
        }

        const speed = data.speed || 1;
        const duration = getRecordingDuration(timingPath);

        ws.send(JSON.stringify({
          type: 'start',
          message: `Starting replay at ${speed}x speed...`,
          duration,
          speed
        }));

        // Create and start custom replayer
        currentReplayer = new ScriptReplayer(ws, timingPath, typescriptPath, speed);
        currentReplayer.start();
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
  console.log(`Looking for script recordings in: ${SSNREC_DIR}`);
});
