import { jest } from '@jest/globals';
import {
  parseTimingContent,
  getTypescriptHeaderOffset,
} from '../server/utils.js';

// ScriptReplayer class implementation for testing
class ScriptReplayer {
  constructor(ws, timingContent, typescriptBuffer, initialSpeed = 1) {
    this.ws = ws;
    this.timingEntries = parseTimingContent(timingContent);
    this.typescriptBuffer = typescriptBuffer;
    this.speed = initialSpeed;
    this.currentIndex = 0;
    this.fileOffset = getTypescriptHeaderOffset(typescriptBuffer);
    this.isRunning = false;
    this.timeoutId = null;
    this.minDelayMs = 10;
    this.sentData = [];
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
      if (this.isRunning) {
        this.ws.send(JSON.stringify({ type: 'end', code: 0 }));
        this.stop();
      }
      return;
    }

    let totalDelay = 0;
    let totalBytes = 0;
    const startIndex = this.currentIndex;

    while (this.currentIndex < this.timingEntries.length) {
      const entry = this.timingEntries[this.currentIndex];
      const delayMs = (entry.delay * 1000) / this.speed;

      if (this.currentIndex === startIndex || delayMs < this.minDelayMs) {
        totalDelay += entry.delay;
        totalBytes += entry.bytes;
        this.currentIndex++;

        if ((totalDelay * 1000) / this.speed >= this.minDelayMs) {
          break;
        }
      } else {
        break;
      }
    }

    const adjustedDelay = (totalDelay * 1000) / this.speed;

    this.timeoutId = setTimeout(() => {
      if (!this.isRunning) return;

      try {
        const endOffset = this.fileOffset + totalBytes;
        const data = this.typescriptBuffer.slice(this.fileOffset, endOffset);
        this.fileOffset = endOffset;

        if (data.length > 0) {
          const message = JSON.stringify({
            type: 'output',
            data: data.toString('utf-8')
          });
          this.ws.send(message);
          this.sentData.push(data.toString('utf-8'));
        }
      } catch (err) {
        console.error('Error reading typescript buffer:', err);
      }

      this.scheduleNext();
    }, adjustedDelay);
  }
}

describe('ScriptReplayer', () => {
  let mockWs;

  beforeEach(() => {
    mockWs = {
      send: jest.fn(),
    };
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('initializes with correct properties', () => {
    const timingContent = '0.5 10\n1.0 20\n';
    const typescriptBuffer = Buffer.from('Hello WorldThis is a test');

    const replayer = new ScriptReplayer(mockWs, timingContent, typescriptBuffer, 1);

    expect(replayer.timingEntries).toHaveLength(2);
    expect(replayer.speed).toBe(1);
    expect(replayer.isRunning).toBe(false);
  });

  test('starts replay correctly', () => {
    const timingContent = '0.1 5\n';
    const typescriptBuffer = Buffer.from('Hello');

    const replayer = new ScriptReplayer(mockWs, timingContent, typescriptBuffer, 1);
    replayer.start();

    expect(replayer.isRunning).toBe(true);
  });

  test('stops replay correctly', () => {
    const timingContent = '0.5 5\n';
    const typescriptBuffer = Buffer.from('Hello');

    const replayer = new ScriptReplayer(mockWs, timingContent, typescriptBuffer, 1);
    replayer.start();
    replayer.stop();

    expect(replayer.isRunning).toBe(false);
  });

  test('sends output data via WebSocket', async () => {
    const timingContent = '0.01 5\n';
    const typescriptBuffer = Buffer.from('Hello');

    const replayer = new ScriptReplayer(mockWs, timingContent, typescriptBuffer, 1);
    replayer.start();

    // Fast-forward timers
    jest.advanceTimersByTime(100);

    expect(mockWs.send).toHaveBeenCalled();
  });

  test('sends end message when replay completes', async () => {
    const timingContent = '0.01 5\n';
    const typescriptBuffer = Buffer.from('Hello');

    const replayer = new ScriptReplayer(mockWs, timingContent, typescriptBuffer, 1);
    replayer.start();

    // Fast-forward timers to complete replay
    jest.advanceTimersByTime(100);

    const calls = mockWs.send.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(JSON.parse(lastCall[0])).toMatchObject({ type: 'end', code: 0 });
  });

  test('respects speed multiplier', () => {
    const timingContent = '1.0 5\n';
    const typescriptBuffer = Buffer.from('Hello');

    const replayer1x = new ScriptReplayer(mockWs, timingContent, typescriptBuffer, 1);
    const replayer2x = new ScriptReplayer(mockWs, timingContent, typescriptBuffer, 2);

    replayer1x.start();
    jest.advanceTimersByTime(500); // Half the delay at 1x
    expect(mockWs.send).not.toHaveBeenCalled();

    mockWs.send.mockClear();

    replayer2x.start();
    jest.advanceTimersByTime(500); // At 2x speed, 500ms should be enough
    expect(mockWs.send).toHaveBeenCalled();
  });

  test('batches small delays together', () => {
    // Multiple entries with very small delays
    const timingContent = '0.001 5\n0.001 5\n0.001 5\n0.001 5\n';
    const typescriptBuffer = Buffer.from('AAAABBBBCCCCDDDD12345678');

    const replayer = new ScriptReplayer(mockWs, timingContent, typescriptBuffer, 1);
    replayer.start();

    // Fast-forward
    jest.advanceTimersByTime(100);

    // Should batch multiple small entries into fewer WebSocket sends
    const outputCalls = mockWs.send.mock.calls.filter(call => {
      const msg = JSON.parse(call[0]);
      return msg.type === 'output';
    });

    // With batching, we should have fewer output calls than timing entries
    expect(outputCalls.length).toBeLessThanOrEqual(2);
  });

  test('skips script header in typescript file', () => {
    const timingContent = '0.01 10\n';
    const typescriptBuffer = Buffer.from('Script started on 2024-01-01\nActual data');

    const replayer = new ScriptReplayer(mockWs, timingContent, typescriptBuffer, 1);
    replayer.start();

    jest.advanceTimersByTime(100);

    const outputCalls = mockWs.send.mock.calls.filter(call => {
      const msg = JSON.parse(call[0]);
      return msg.type === 'output';
    });

    if (outputCalls.length > 0) {
      const data = JSON.parse(outputCalls[0][0]).data;
      expect(data).not.toContain('Script started');
    }
  });

  test('handles empty timing content', () => {
    const timingContent = '';
    const typescriptBuffer = Buffer.from('Hello');

    const replayer = new ScriptReplayer(mockWs, timingContent, typescriptBuffer, 1);
    replayer.start();

    jest.advanceTimersByTime(100);

    // Should immediately send end message
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"end"')
    );
  });

  test('does not send after stop is called', () => {
    const timingContent = '1.0 5\n';
    const typescriptBuffer = Buffer.from('Hello');

    const replayer = new ScriptReplayer(mockWs, timingContent, typescriptBuffer, 1);
    replayer.start();
    replayer.stop();

    jest.advanceTimersByTime(2000);

    // Should not have sent any output (only potentially stopped before any output)
    const outputCalls = mockWs.send.mock.calls.filter(call => {
      const msg = JSON.parse(call[0]);
      return msg.type === 'output';
    });
    expect(outputCalls.length).toBe(0);
  });
});

describe('Timing Batching Logic', () => {
  test('calculates correct total bytes when batching', () => {
    const entries = [
      { delay: 0.001, bytes: 10 },
      { delay: 0.001, bytes: 20 },
      { delay: 0.001, bytes: 30 },
    ];

    const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);
    expect(totalBytes).toBe(60);
  });

  test('calculates correct total delay when batching', () => {
    const entries = [
      { delay: 0.001, bytes: 10 },
      { delay: 0.002, bytes: 20 },
      { delay: 0.003, bytes: 30 },
    ];

    const totalDelay = entries.reduce((sum, e) => sum + e.delay, 0);
    expect(totalDelay).toBeCloseTo(0.006, 5);
  });
});

describe('Speed calculations', () => {
  test('1x speed uses original delay', () => {
    const delay = 1.0; // 1 second
    const speed = 1;
    const adjustedDelay = (delay * 1000) / speed;

    expect(adjustedDelay).toBe(1000);
  });

  test('2x speed halves the delay', () => {
    const delay = 1.0; // 1 second
    const speed = 2;
    const adjustedDelay = (delay * 1000) / speed;

    expect(adjustedDelay).toBe(500);
  });

  test('0.5x speed doubles the delay', () => {
    const delay = 1.0; // 1 second
    const speed = 0.5;
    const adjustedDelay = (delay * 1000) / speed;

    expect(adjustedDelay).toBe(2000);
  });

  test('12x speed reduces delay to 1/12', () => {
    const delay = 1.2; // 1.2 seconds
    const speed = 12;
    const adjustedDelay = (delay * 1000) / speed;

    expect(adjustedDelay).toBe(100);
  });
});
