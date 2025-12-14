import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Base directory for script recordings (configurable via SSNREC env variable)
const SSNREC_DIR = process.env.SSNREC || join(__dirname, '..', 'SSNREC');

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
    }).map(folder => ({
      name: folder,
      displayName: folder.replace(/^\./, ''), // Remove leading dot for display
    }));

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

// WebSocket connection for streaming scriptreplay output
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  let currentProcess = null;

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

        // Kill any existing process
        if (currentProcess) {
          currentProcess.kill();
        }

        const speed = data.speed || 1;
        ws.send(JSON.stringify({ type: 'start', message: `Starting replay at ${speed}x speed...` }));

        // Use scriptreplay command with --divisor for speed control
        // scriptreplay --timing=timing --divisor=N typescript
        const args = [
          '--timing=' + timingPath,
          typescriptPath
        ];
        if (speed > 1) {
          args.unshift('--divisor=' + speed);
        }

        currentProcess = spawn('scriptreplay', args, {
          env: { ...process.env, TERM: 'xterm-256color' }
        });

        currentProcess.stdout.on('data', (data) => {
          ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
        });

        currentProcess.stderr.on('data', (data) => {
          ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
        });

        currentProcess.on('close', (code) => {
          ws.send(JSON.stringify({ type: 'end', code }));
          currentProcess = null;
        });

        currentProcess.on('error', (error) => {
          ws.send(JSON.stringify({ type: 'error', message: error.message }));
          currentProcess = null;
        });
      }

      if (data.action === 'stop') {
        if (currentProcess) {
          currentProcess.kill();
          currentProcess = null;
          ws.send(JSON.stringify({ type: 'stopped', message: 'Replay stopped' }));
        }
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    if (currentProcess) {
      currentProcess.kill();
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
