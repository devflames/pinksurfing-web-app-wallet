/**
 * File Routes — Signal-style encrypted attachment upload/download
 *
 * POST /files/upload    — Upload encrypted blob (base64 in JSON body)
 * GET  /files/:id       — Download encrypted blob (binary response)
 * GET  /files/:id/info  — Get file metadata without downloading
 */

const express = require('express');
const router = express.Router();
const fileService = require('../services/file-service');

// POST /files/upload
// Body: { uploaderAddress, data (base64), mimeType? }
router.post('/upload', (req, res) => {
  try {
    const { uploaderAddress, data, mimeType } = req.body;

    if (!uploaderAddress || !data) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: uploaderAddress, data (base64)',
      });
    }

    const buffer = Buffer.from(data, 'base64');
    const result = fileService.uploadFile(uploaderAddress, buffer, mimeType);

    res.json({ status: 'success', data: result });
  } catch (e) {
    console.error(`[API] file upload error: ${e.message}`);
    const status = e.message.includes('too large') ? 413 : 500;
    res.status(status).json({ status: 'error', message: e.message });
  }
});

// GET /files/:id — returns raw encrypted binary
router.get('/:id', (req, res) => {
  try {
    const result = fileService.downloadFile(req.params.id);
    if (!result) {
      return res.status(404).json({ status: 'error', message: 'File not found' });
    }

    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Length', result.sizeBytes);
    if (result.mimeType) {
      res.set('X-Original-Mime-Type', result.mimeType);
    }
    res.send(result.data);
  } catch (e) {
    console.error(`[API] file download error: ${e.message}`);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// GET /files/:id/info — metadata only
router.get('/:id/info', (req, res) => {
  try {
    const info = fileService.getFileInfo(req.params.id);
    if (!info) {
      return res.status(404).json({ status: 'error', message: 'File not found' });
    }
    res.json({ status: 'success', data: info });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
