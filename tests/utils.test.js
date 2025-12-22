import {
  parseTimingContent,
  getRecordingDurationFromContent,
  getTypescriptHeaderOffset,
  getS3Key,
  extractFolderFromKey,
  formatDuration,
} from '../server/utils.js';

describe('parseTimingContent', () => {
  test('parses valid timing content', () => {
    const content = `0.175395 112
6.807959 1
1.083220 4`;
    const entries = parseTimingContent(content);

    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ delay: 0.175395, bytes: 112 });
    expect(entries[1]).toEqual({ delay: 6.807959, bytes: 1 });
    expect(entries[2]).toEqual({ delay: 1.08322, bytes: 4 });
  });

  test('handles empty content', () => {
    const entries = parseTimingContent('');
    expect(entries).toHaveLength(0);
  });

  test('handles whitespace-only content', () => {
    const entries = parseTimingContent('   \n\n   ');
    expect(entries).toHaveLength(0);
  });

  test('skips invalid lines', () => {
    const content = `0.175395 112
invalid line
6.807959 1
not a number here`;
    const entries = parseTimingContent(content);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ delay: 0.175395, bytes: 112 });
    expect(entries[1]).toEqual({ delay: 6.807959, bytes: 1 });
  });

  test('handles extra whitespace in lines', () => {
    const content = `  0.175395   112
    6.807959    1   `;
    const entries = parseTimingContent(content);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ delay: 0.175395, bytes: 112 });
    expect(entries[1]).toEqual({ delay: 6.807959, bytes: 1 });
  });

  test('parses large timing file', () => {
    const lines = [];
    for (let i = 0; i < 10000; i++) {
      lines.push(`0.001 ${i}`);
    }
    const content = lines.join('\n');
    const entries = parseTimingContent(content);

    expect(entries).toHaveLength(10000);
  });

  test('handles very small delay values', () => {
    const content = `0.000001 1
0.000000 1`;
    const entries = parseTimingContent(content);

    expect(entries).toHaveLength(2);
    expect(entries[0].delay).toBe(0.000001);
    expect(entries[1].delay).toBe(0);
  });
});

describe('getRecordingDurationFromContent', () => {
  test('calculates duration from timing content', () => {
    const content = `0.175395 112
6.807959 1
1.083220 4`;
    const duration = getRecordingDurationFromContent(content);

    expect(duration).toBeCloseTo(8.066574, 5);
  });

  test('returns 0 for empty content', () => {
    const duration = getRecordingDurationFromContent('');
    expect(duration).toBe(0);
  });

  test('returns 0 for invalid content', () => {
    const duration = getRecordingDurationFromContent('not valid timing data');
    expect(duration).toBe(0);
  });

  test('handles large timing files', () => {
    const lines = [];
    for (let i = 0; i < 1000; i++) {
      lines.push(`0.001 1`);
    }
    const content = lines.join('\n');
    const duration = getRecordingDurationFromContent(content);

    expect(duration).toBeCloseTo(1.0, 2);
  });
});

describe('getTypescriptHeaderOffset', () => {
  test('finds offset after Script started header', () => {
    const buffer = Buffer.from('Script started on 2024-01-01\nactual content here');
    const offset = getTypescriptHeaderOffset(buffer);

    expect(offset).toBe(29); // Length of header line + 1 for newline
  });

  test('returns 0 when no header present', () => {
    const buffer = Buffer.from('actual content here\nmore content');
    const offset = getTypescriptHeaderOffset(buffer);

    expect(offset).toBe(0);
  });

  test('returns 0 for empty buffer', () => {
    const buffer = Buffer.from('');
    const offset = getTypescriptHeaderOffset(buffer);

    expect(offset).toBe(0);
  });

  test('handles buffer with only header', () => {
    const buffer = Buffer.from('Script started on 2024-01-01\n');
    const offset = getTypescriptHeaderOffset(buffer);

    expect(offset).toBe(29);
  });
});

describe('getS3Key', () => {
  test('constructs key without prefix', () => {
    const key = getS3Key('', 'folder1', 'timing');
    expect(key).toBe('folder1/timing');
  });

  test('constructs key with prefix (no trailing slash)', () => {
    const key = getS3Key('SSNREC', 'folder1', 'timing');
    expect(key).toBe('SSNREC/folder1/timing');
  });

  test('constructs key with prefix (with trailing slash)', () => {
    const key = getS3Key('SSNREC/', 'folder1', 'timing');
    expect(key).toBe('SSNREC/folder1/timing');
  });

  test('handles nested prefix', () => {
    const key = getS3Key('data/recordings', 'folder1', 'typescript');
    expect(key).toBe('data/recordings/folder1/typescript');
  });
});

describe('extractFolderFromKey', () => {
  test('extracts folder from key without prefix', () => {
    const folder = extractFolderFromKey('folder1/timing', '');
    expect(folder).toBe('folder1');
  });

  test('extracts folder from key with prefix (no trailing slash)', () => {
    const folder = extractFolderFromKey('SSNREC/folder1/timing', 'SSNREC');
    expect(folder).toBe('folder1');
  });

  test('extracts folder from key with prefix (with trailing slash)', () => {
    const folder = extractFolderFromKey('SSNREC/folder1/timing', 'SSNREC/');
    expect(folder).toBe('folder1');
  });

  test('returns null for key without folder structure', () => {
    const folder = extractFolderFromKey('justfile', '');
    expect(folder).toBeNull();
  });

  test('handles nested prefix', () => {
    const folder = extractFolderFromKey('data/recordings/folder1/timing', 'data/recordings');
    expect(folder).toBe('folder1');
  });

  test('handles key with leading slash after prefix removal', () => {
    const folder = extractFolderFromKey('SSNREC//folder1/timing', 'SSNREC');
    expect(folder).toBe('folder1');
  });
});

describe('formatDuration', () => {
  test('formats seconds only', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  test('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2m 5s');
  });

  test('formats zero', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  test('handles fractional seconds', () => {
    expect(formatDuration(45.7)).toBe('45s');
  });

  test('formats exactly one minute', () => {
    expect(formatDuration(60)).toBe('1m 0s');
  });

  test('formats large duration', () => {
    expect(formatDuration(3661)).toBe('61m 1s');
  });
});
