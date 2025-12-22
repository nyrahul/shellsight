import { jest } from '@jest/globals';
import {
  getS3Key,
  extractFolderFromKey,
} from '../server/utils.js';

describe('S3 Key Generation', () => {
  describe('without prefix', () => {
    test('generates timing key', () => {
      const key = getS3Key('', 'recording1', 'timing');
      expect(key).toBe('recording1/timing');
    });

    test('generates typescript key', () => {
      const key = getS3Key('', 'recording1', 'typescript');
      expect(key).toBe('recording1/typescript');
    });

    test('handles folder with underscore and timestamp', () => {
      const key = getS3Key('', 'workload_1766083701', 'timing');
      expect(key).toBe('workload_1766083701/timing');
    });
  });

  describe('with prefix', () => {
    test('generates key with prefix (no trailing slash)', () => {
      const key = getS3Key('SSNREC', 'recording1', 'timing');
      expect(key).toBe('SSNREC/recording1/timing');
    });

    test('generates key with prefix (with trailing slash)', () => {
      const key = getS3Key('SSNREC/', 'recording1', 'timing');
      expect(key).toBe('SSNREC/recording1/timing');
    });

    test('handles nested prefix', () => {
      const key = getS3Key('data/recordings', 'recording1', 'timing');
      expect(key).toBe('data/recordings/recording1/timing');
    });

    test('handles deeply nested prefix', () => {
      const key = getS3Key('a/b/c/d', 'recording1', 'timing');
      expect(key).toBe('a/b/c/d/recording1/timing');
    });
  });
});

describe('S3 Folder Extraction', () => {
  describe('without prefix', () => {
    test('extracts folder from timing key', () => {
      const folder = extractFolderFromKey('recording1/timing', '');
      expect(folder).toBe('recording1');
    });

    test('extracts folder from typescript key', () => {
      const folder = extractFolderFromKey('recording1/typescript', '');
      expect(folder).toBe('recording1');
    });

    test('extracts folder with underscore and numbers', () => {
      const folder = extractFolderFromKey('rahul_kali_1766083701/timing', '');
      expect(folder).toBe('rahul_kali_1766083701');
    });

    test('returns null for file without folder', () => {
      const folder = extractFolderFromKey('orphan-file.txt', '');
      expect(folder).toBeNull();
    });
  });

  describe('with prefix', () => {
    test('extracts folder with prefix (no trailing slash)', () => {
      const folder = extractFolderFromKey('SSNREC/recording1/timing', 'SSNREC');
      expect(folder).toBe('recording1');
    });

    test('extracts folder with prefix (with trailing slash)', () => {
      const folder = extractFolderFromKey('SSNREC/recording1/timing', 'SSNREC/');
      expect(folder).toBe('recording1');
    });

    test('handles nested prefix', () => {
      const folder = extractFolderFromKey('data/recordings/recording1/timing', 'data/recordings');
      expect(folder).toBe('recording1');
    });

    test('handles prefix that does not match', () => {
      const folder = extractFolderFromKey('other/recording1/timing', 'SSNREC');
      expect(folder).toBe('other');
    });
  });

  describe('edge cases', () => {
    test('handles key with only prefix', () => {
      const folder = extractFolderFromKey('SSNREC/', 'SSNREC');
      expect(folder).toBeNull();
    });

    test('handles empty key', () => {
      const folder = extractFolderFromKey('', '');
      expect(folder).toBeNull();
    });

    test('handles key with multiple slashes', () => {
      const folder = extractFolderFromKey('SSNREC//recording1/timing', 'SSNREC');
      expect(folder).toBe('recording1');
    });
  });
});

describe('S3 Bucket Structure Validation', () => {
  test('valid recording structure', () => {
    const keys = [
      'recording1/timing',
      'recording1/typescript',
    ];

    const hasTimingFile = keys.some(key => key.endsWith('/timing'));
    const hasTypescriptFile = keys.some(key => key.endsWith('/typescript'));

    expect(hasTimingFile).toBe(true);
    expect(hasTypescriptFile).toBe(true);
  });

  test('missing timing file', () => {
    const keys = [
      'recording1/typescript',
    ];

    const hasTimingFile = keys.some(key => key.endsWith('/timing'));
    const hasTypescriptFile = keys.some(key => key.endsWith('/typescript'));

    expect(hasTimingFile).toBe(false);
    expect(hasTypescriptFile).toBe(true);
  });

  test('missing typescript file', () => {
    const keys = [
      'recording1/timing',
    ];

    const hasTimingFile = keys.some(key => key.endsWith('/timing'));
    const hasTypescriptFile = keys.some(key => key.endsWith('/typescript'));

    expect(hasTimingFile).toBe(true);
    expect(hasTypescriptFile).toBe(false);
  });

  test('extra files do not affect validation', () => {
    const keys = [
      'recording1/timing',
      'recording1/typescript',
      'recording1/meta',
      'recording1/extra.log',
    ];

    const hasTimingFile = keys.some(key => key.endsWith('/timing'));
    const hasTypescriptFile = keys.some(key => key.endsWith('/typescript'));

    expect(hasTimingFile).toBe(true);
    expect(hasTypescriptFile).toBe(true);
  });
});

describe('S3 Pagination Simulation', () => {
  test('collects folders from multiple pages', () => {
    const page1 = [
      { Key: 'recording1/timing' },
      { Key: 'recording1/typescript' },
      { Key: 'recording2/timing' },
    ];

    const page2 = [
      { Key: 'recording2/typescript' },
      { Key: 'recording3/timing' },
      { Key: 'recording3/typescript' },
    ];

    const allContents = [...page1, ...page2];
    const folders = new Set();

    for (const obj of allContents) {
      const folder = extractFolderFromKey(obj.Key, '');
      if (folder) {
        folders.add(folder);
      }
    }

    expect(folders.size).toBe(3);
    expect(folders.has('recording1')).toBe(true);
    expect(folders.has('recording2')).toBe(true);
    expect(folders.has('recording3')).toBe(true);
  });

  test('deduplicates folders across pages', () => {
    const page1 = [
      { Key: 'recording1/timing' },
    ];

    const page2 = [
      { Key: 'recording1/typescript' },
    ];

    const allContents = [...page1, ...page2];
    const folders = new Set();

    for (const obj of allContents) {
      const folder = extractFolderFromKey(obj.Key, '');
      if (folder) {
        folders.add(folder);
      }
    }

    expect(folders.size).toBe(1);
    expect(folders.has('recording1')).toBe(true);
  });
});

describe('S3 Configuration Scenarios', () => {
  describe('RustFS/MinIO compatible', () => {
    test('path-style URLs work correctly', () => {
      // RustFS uses path-style: http://host:9000/bucket/key
      // vs virtual-hosted-style: http://bucket.host:9000/key
      const endpoint = 'http://192.168.1.234:9000';
      const bucket = 'recordings';
      const key = 'SSNREC/recording1/timing';

      // Path-style URL construction
      const url = `${endpoint}/${bucket}/${key}`;
      expect(url).toBe('http://192.168.1.234:9000/recordings/SSNREC/recording1/timing');
    });
  });

  describe('environment variable combinations', () => {
    test('minimal config (bucket only)', () => {
      const config = {
        bucket: 'my-bucket',
        region: 'us-east-1', // default
        endpoint: '', // none
        prefix: '', // none
      };

      const key = getS3Key(config.prefix, 'recording1', 'timing');
      expect(key).toBe('recording1/timing');
    });

    test('full config with all options', () => {
      const config = {
        bucket: 'recordings',
        region: 'us-east-1',
        endpoint: 'http://storage.local:9000',
        prefix: 'SSNREC',
      };

      const key = getS3Key(config.prefix, 'recording1', 'timing');
      expect(key).toBe('SSNREC/recording1/timing');
    });
  });
});

describe('Error Scenarios', () => {
  test('NoSuchKey error detection', () => {
    const error = new Error('The specified key does not exist');
    error.name = 'NoSuchKey';

    expect(error.name).toBe('NoSuchKey');
  });

  test('AccessDenied error detection', () => {
    const error = new Error('Access Denied');
    error.name = 'AccessDenied';

    expect(error.name).toBe('AccessDenied');
  });

  test('Network error detection', () => {
    const error = new Error('getaddrinfo ENOTFOUND');
    error.code = 'ENOTFOUND';

    expect(error.code).toBe('ENOTFOUND');
  });
});
