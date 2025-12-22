// Utility functions for shell replay server

// Parse timing file content into array of {delay, bytes} entries
export function parseTimingContent(content) {
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
export function getRecordingDurationFromContent(timingContent) {
  try {
    const entries = parseTimingContent(timingContent);
    return entries.reduce((sum, entry) => sum + entry.delay, 0);
  } catch (error) {
    return 0;
  }
}

// Find the offset after the "Script started on..." header line in typescript content
export function getTypescriptHeaderOffset(buffer) {
  // Find the first newline - header ends there
  const newlineIndex = buffer.indexOf(0x0a); // '\n'
  if (newlineIndex !== -1 && buffer.slice(0, 20).toString().startsWith('Script started')) {
    return newlineIndex + 1; // Skip past the newline
  }
  return 0; // No header found, start from beginning
}

// Get S3 key for a file in a recording folder
export function getS3Key(prefix, folderName, fileName) {
  if (prefix) {
    const normalizedPrefix = prefix.endsWith('/') ? prefix : prefix + '/';
    return `${normalizedPrefix}${folderName}/${fileName}`;
  }
  return `${folderName}/${fileName}`;
}

// Extract folder name from S3 key
export function extractFolderFromKey(key, prefix) {
  let normalizedKey = key;

  if (prefix) {
    const prefixWithSlash = prefix.endsWith('/') ? prefix : prefix + '/';
    if (normalizedKey.startsWith(prefixWithSlash)) {
      normalizedKey = normalizedKey.slice(prefixWithSlash.length);
    } else if (normalizedKey.startsWith(prefix)) {
      normalizedKey = normalizedKey.slice(prefix.length);
    }
  }

  // Remove leading slash if present
  normalizedKey = normalizedKey.replace(/^\//, '');
  const parts = normalizedKey.split('/');

  if (parts.length >= 2 && parts[0]) {
    return parts[0];
  }
  return null;
}

// Format duration in seconds to human readable string
export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

// Helper to convert stream to buffer
export async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Helper to convert stream to string
export async function streamToString(stream) {
  const buffer = await streamToBuffer(stream);
  return buffer.toString('utf-8');
}
