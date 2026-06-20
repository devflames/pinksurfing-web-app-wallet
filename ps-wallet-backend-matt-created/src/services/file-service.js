/**
 * File Service — Signal-style encrypted attachment storage
 *
 * Flow:
 *   1. Client encrypts file locally (AES-256-GCM with random key)
 *   2. Client uploads encrypted blob here (server never sees plaintext)
 *   3. Client sends file ID + decryption key inside E2E encrypted message
 *   4. Recipient downloads encrypted blob, decrypts locally
 *
 * Files auto-expire after 30 days (configurable).
 * Max file size: 25 MB (encrypted).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const FILES_DIR = path.join(__dirname, '..', '..', 'data', 'files');
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

// ── Prepared statements ──

const stmts = {
  insert: db.prepare(`
    INSERT INTO encrypted_files (id, uploader_address, size_bytes, mime_type)
    VALUES (?, ?, ?, ?)
  `),
  getById: db.prepare(`SELECT * FROM encrypted_files WHERE id = ?`),
  deleteById: db.prepare(`DELETE FROM encrypted_files WHERE id = ?`),
  deleteExpired: db.prepare(
    `DELETE FROM encrypted_files WHERE expires_at < datetime('now')`
  ),
  listByUploader: db.prepare(
    `SELECT id, size_bytes, mime_type, created_at FROM encrypted_files
     WHERE uploader_address = ? ORDER BY created_at DESC LIMIT 100`
  ),
};

/**
 * Store an encrypted file blob.
 *
 * @param {string} uploaderAddress - Chia address of uploader
 * @param {Buffer} encryptedData  - Opaque encrypted bytes
 * @param {string} [mimeType]     - Original MIME type (optional, for UI hints)
 * @returns {{ id: string, sizeBytes: number }}
 */
function uploadFile(uploaderAddress, encryptedData, mimeType) {
  if (!uploaderAddress) throw new Error('uploaderAddress required');
  if (!encryptedData || encryptedData.length === 0) throw new Error('No file data');
  if (encryptedData.length > MAX_FILE_SIZE) {
    throw new Error(`File too large (${encryptedData.length} bytes). Max: ${MAX_FILE_SIZE}`);
  }

  const id = crypto.randomUUID();
  const filePath = path.join(FILES_DIR, id);

  // Write encrypted blob to disk
  fs.writeFileSync(filePath, encryptedData);

  // Store metadata in DB
  stmts.insert.run(id, uploaderAddress, encryptedData.length, mimeType || null);

  console.log(`[Files] Stored ${encryptedData.length} bytes as ${id} from ${uploaderAddress.substring(0, 16)}...`);
  return { id, sizeBytes: encryptedData.length };
}

/**
 * Retrieve an encrypted file blob.
 *
 * @param {string} fileId
 * @returns {{ data: Buffer, mimeType: string|null, sizeBytes: number } | null}
 */
function downloadFile(fileId) {
  const row = stmts.getById.get(fileId);
  if (!row) return null;

  const filePath = path.join(FILES_DIR, fileId);
  if (!fs.existsSync(filePath)) {
    // Metadata exists but file is gone — clean up
    stmts.deleteById.run(fileId);
    return null;
  }

  const data = fs.readFileSync(filePath);
  return {
    data,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
  };
}

/**
 * Get file metadata without downloading.
 */
function getFileInfo(fileId) {
  return stmts.getById.get(fileId) || null;
}

/**
 * Delete expired files (called periodically).
 */
function cleanupExpired() {
  // Get IDs of expired files before deleting from DB
  const expired = db.prepare(
    `SELECT id FROM encrypted_files WHERE expires_at < datetime('now')`
  ).all();

  if (expired.length === 0) return 0;

  // Delete files from disk
  for (const { id } of expired) {
    const filePath = path.join(FILES_DIR, id);
    try { fs.unlinkSync(filePath); } catch (_) { /* already gone */ }
  }

  // Delete from DB
  const result = stmts.deleteExpired.run();
  if (result.changes > 0) {
    console.log(`[Files] Cleaned up ${result.changes} expired file(s)`);
  }
  return result.changes;
}

// Auto-cleanup every hour
setInterval(cleanupExpired, 60 * 60 * 1000);

module.exports = {
  uploadFile,
  downloadFile,
  getFileInfo,
  cleanupExpired,
  MAX_FILE_SIZE,
};
