import Database from 'better-sqlite3';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database file paths
const DATA_DIR = join(__dirname, '..', 'data');
const DB_FILE = join(DATA_DIR, 'users.db');
const S3_DB_KEY = 'shellsight-users.db';

let db = null;
let s3Client = null;
let s3Config = null;
let syncInterval = null;
let lastSyncTime = 0;
let isDirty = false;

// Initialize the database module
export async function initUserDb(config) {
  s3Config = config;

  // Create S3 client
  const s3ClientConfig = {
    region: config.region || 'us-east-1',
  };

  if (config.accessKey && config.secretKey) {
    s3ClientConfig.credentials = {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    };
  }

  if (config.endpoint) {
    s3ClientConfig.endpoint = config.endpoint;
    s3ClientConfig.forcePathStyle = true;
  }

  s3Client = new S3Client(s3ClientConfig);

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Try to download existing database from S3
  await downloadDbFromS3();

  // Open/create the database
  db = new Database(DB_FILE);

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      provider TEXT,
      first_login TEXT NOT NULL,
      last_login TEXT NOT NULL,
      login_count INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);
  `);

  // Start periodic sync to S3 (every 5 minutes)
  syncInterval = setInterval(() => {
    if (isDirty) {
      uploadDbToS3().catch(err => console.error('Failed to sync DB to S3:', err));
    }
  }, 5 * 60 * 1000);

  console.log('User database initialized');
  return db;
}

// Download database from S3
async function downloadDbFromS3() {
  if (!s3Client || !s3Config) return;

  try {
    const prefix = s3Config.prefix ? (s3Config.prefix.endsWith('/') ? s3Config.prefix : s3Config.prefix + '/') : '';
    const key = `${prefix}${S3_DB_KEY}`;

    const command = new GetObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    writeFileSync(DB_FILE, buffer);
    console.log('Downloaded user database from S3');
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      console.log('No existing user database in S3, will create new one');
    } else {
      console.error('Error downloading user database from S3:', err.message);
    }
  }
}

// Upload database to S3
async function uploadDbToS3() {
  if (!s3Client || !s3Config || !existsSync(DB_FILE)) return;

  try {
    const prefix = s3Config.prefix ? (s3Config.prefix.endsWith('/') ? s3Config.prefix : s3Config.prefix + '/') : '';
    const key = `${prefix}${S3_DB_KEY}`;

    const dbBuffer = readFileSync(DB_FILE);

    const command = new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
      Body: dbBuffer,
      ContentType: 'application/x-sqlite3',
    });

    await s3Client.send(command);
    lastSyncTime = Date.now();
    isDirty = false;
    console.log('Synced user database to S3');
  } catch (err) {
    console.error('Error uploading user database to S3:', err.message);
  }
}

// Record a user login
export function recordUserLogin(email, name, provider) {
  if (!db) {
    console.error('User database not initialized');
    return null;
  }

  const now = new Date().toISOString();

  // Try to update existing user
  const updateStmt = db.prepare(`
    UPDATE users
    SET last_login = ?, login_count = login_count + 1, name = COALESCE(?, name), provider = COALESCE(?, provider)
    WHERE email = ?
  `);

  const result = updateStmt.run(now, name, provider, email);

  if (result.changes === 0) {
    // Insert new user
    const insertStmt = db.prepare(`
      INSERT INTO users (email, name, provider, first_login, last_login, login_count)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    insertStmt.run(email, name, provider, now, now);
  }

  isDirty = true;

  // Sync to S3 immediately after login (debounced)
  if (Date.now() - lastSyncTime > 30000) { // At least 30 seconds between syncs
    uploadDbToS3().catch(err => console.error('Failed to sync DB to S3:', err));
  }

  return getUser(email);
}

// Get a user by email
export function getUser(email) {
  if (!db) return null;

  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
}

// Get all users (for admin)
export function getAllUsers() {
  if (!db) return [];

  const stmt = db.prepare('SELECT * FROM users ORDER BY last_login DESC');
  return stmt.all();
}

// Get user count
export function getUserCount() {
  if (!db) return 0;

  const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const result = stmt.get();
  return result ? result.count : 0;
}

// Force sync to S3
export async function syncToS3() {
  await uploadDbToS3();
}

// Cleanup on shutdown
export function closeUserDb() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  // Final sync before closing
  if (isDirty && s3Client) {
    uploadDbToS3().catch(err => console.error('Failed to sync DB to S3 on shutdown:', err));
  }

  if (db) {
    db.close();
    db = null;
  }

  console.log('User database closed');
}
