/**
 * PinkSurfing Wallet Backend
 *
 * Local development server providing:
 * 1. Google OAuth2 proxy for desktop Drive backup
 * 2. Chia on-chain inscription endpoints (profile NFT minting)
 * 3. Chain status + inscription history
 *
 * Usage:
 *   npm install
 *   cp .env.example .env   # fill in your credentials
 *   npm run dev             # starts on http://localhost:3099
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const emailAuthRoutes = require('./routes/email-auth');
const inscriptionRoutes = require('./routes/inscription');
const profileRoutes = require('./routes/profiles');
const messageRoutes = require('./routes/messages');
const keyvaultRoutes = require('./routes/keyvault');
const recoveryRoutes = require('./routes/recovery');
const swapRoutes = require('./routes/swaps');
const callRoutes = require('./routes/calls');
const groupRoutes = require('./routes/groups');
const didRoutes = require('./routes/did');
const paychatRoutes = require('./routes/paychat');
const fileRoutes = require('./routes/files');
const walletProvisionRoutes = require('./routes/wallet-provision');
const { mountApiDocs } = require('./openapi/setup-api-docs');

const app = express();
const PORT = process.env.PORT || 3099;

function parseCorsOrigins() {
  const raw = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '';
  if (!raw || raw === '*') return '*';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

const corsOrigins = parseCorsOrigins();

// Middleware
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Session-Token',
    'X-Auth-Address',
    'X-Auth-Timestamp',
    'X-Auth-Signature',
    'X-Auth-Nonce',
  ],
}));
app.use(express.json({ limit: '50mb' }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/auth/email', emailAuthRoutes);
app.use('/wallet', walletProvisionRoutes);
app.use('/wallet', inscriptionRoutes);
app.use('/profiles', profileRoutes);
app.use('/messages', messageRoutes);
app.use('/keyvault', keyvaultRoutes);
app.use('/recovery', recoveryRoutes);
app.use('/swaps', swapRoutes);
app.use('/calls', callRoutes);
app.use('/groups', groupRoutes);
app.use('/did', didRoutes);
app.use('/paychat', paychatRoutes);
app.use('/files', fileRoutes);

// Interactive API docs (Swagger UI)
mountApiDocs(app);

// Health check
app.get('/', (req, res) => {
  res.json({
    name: 'ps-wallet-backend',
    version: '1.0.0',
    docs: {
      swaggerUi: '/api-docs',
      openApiJson: '/api-docs.json',
      publicUrl: 'https://app.pinksurfing.com/api-docs',
    },
    endpoints: {
      auth: {
        'GET /auth/google': 'Start Google OAuth flow',
        'GET /auth/google/callback': 'OAuth callback (automatic)',
        'GET /auth/google/token/:id': 'Retrieve tokens by session ID',
        'POST /auth/google/refresh': 'Refresh access token',
        'GET /auth/google/status': 'Check OAuth config',
        'POST /auth/email/send-otp': 'Send 6-digit OTP to email',
        'POST /auth/email/verify-otp': 'Verify OTP, get session token',
        'POST /auth/email/logout': 'Destroy session',
      },
      wallet: {
        'GET /wallet/status': 'SSO JWT — wallet provision status',
        'POST /wallet/link': 'SSO JWT — link user to Chia address',
        'POST /wallet/auto-mint-profile': 'First login: avatar + metadata → IPFS → NFT',
        'POST /wallet/pin-image': 'Pin image to IPFS, get CID',
        'POST /wallet/inscribe-profile': 'Pin image+metadata to IPFS + mint NFT',
        'POST /wallet/update-profile': 'Pin new version to IPFS + mint new NFT',
        'POST /wallet/sync-profile': 'Pin metadata to IPFS only (fast, every save)',
        'GET /wallet/profile/:address': 'Fetch latest profile by address',
        'GET /wallet/history/:address': 'Inscription history for address',
        'GET /wallet/inscription/:id': 'Get inscription by ID',
        'GET /wallet/chain-status': 'Chia node + IPFS status',
      },
      profiles: {
        'POST /profiles/register': 'Register/update wallet profile',
        'GET /profiles/resolve/:address': 'Resolve profile by Chia address',
        'GET /profiles/pk/:publicKey': 'Resolve profile by public key',
        'GET /profiles/search?q=...': 'Search profiles by name/address',
        'GET /profiles/directory': 'List all registered profiles',
      },
      keyvault: {
        'POST /keyvault/create': 'Deploy new KeyVault singleton + pin backup to IPFS',
        'POST /keyvault/update': 'Add new backup version (spend singleton)',
        'POST /keyvault/recover': 'Recover state from blockchain (no server needed)',
        'GET /keyvault/status/:launcherId': 'Check KeyVault status',
        'POST /keyvault/transfer': 'Transfer ownership (key rotation)',
        'GET /keyvault/fetch-backup/:cid': 'Fetch encrypted backup from IPFS',
        'GET /keyvault/lookup/:walletAddress': 'Look up launcher ID for wallet',
        'GET /keyvault/health': 'Health check (Node.js + Python sidecar)',
      },
      recovery: {
        'POST /recovery/setup-totp': 'Generate TOTP secret + QR URI',
        'POST /recovery/confirm-totp': 'Verify first code to activate TOTP',
        'POST /recovery/store-share': 'Store server key share (during backup)',
        'POST /recovery/verify': 'Verify MFA + release server key share',
        'GET /recovery/methods/:lid': 'List active MFA methods',
        'GET /recovery/status/:lid': 'Check MFA + key share status',
        'DELETE /recovery/method/:id': 'Remove MFA method (requires MFA)',
      },
      messages: {
        'POST /messages/send': 'Send encrypted message (opaque blob)',
        'GET /messages/receive/:address': 'Fetch & deliver unread messages',
        'GET /messages/peek/:address': 'Peek at unread (no delivery mark)',
        'GET /messages/conversation?addr1=&addr2=': 'Conversation history',
        'GET /messages/conversations/:address': 'List conversation partners',
        'GET /messages/count/:address': 'Count undelivered messages',
        'POST /messages/ack': 'Acknowledge message delivery',
      },
      calls: {
        'GET /calls/token/:channel/:uid': 'Generate Agora RTC token',
        'POST /calls/initiate': 'Initiate voice/video call',
        'POST /calls/accept': 'Accept incoming call',
        'POST /calls/reject': 'Reject incoming call',
        'POST /calls/end': 'End active call',
        'GET /calls/status/:address': 'Get active call for address',
        'GET /calls/channel/:channel': 'Get call details by channel',
        'GET /calls/history/:address': 'Call history for address',
      },
      groups: {
        'POST /groups/create': 'Create group (E2E, Signal-grade)',
        'GET /groups/for/:address': 'List groups for wallet address',
        'GET /groups/:id': 'Get group details + members',
        'PUT /groups/:id': 'Update group metadata (admin)',
        'POST /groups/:id/members': 'Add members (admin)',
        'DELETE /groups/:id/members/:address': 'Remove member / leave',
        'GET /groups/:id/keys': 'Get member public keys for E2E',
        'POST /groups/:id/send': 'Send encrypted group message (fan-out)',
        'GET /groups/:id/messages/:address': 'Group message history',
      },
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: `Not found: ${req.method} ${req.path}` });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error(`[Error] ${err.stack || err.message}`);
  res.status(500).json({ status: 'error', message: err.message });
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n🔐 ps-wallet-backend running on http://localhost:${PORT}`);
  console.log(`   CORS:            ${corsOrigins === '*' ? '* (set CORS_ORIGINS for production)' : corsOrigins.join(', ')}`);
  console.log(`   Google OAuth:    ${process.env.GOOGLE_CLIENT_ID ? '✓ configured' : '✗ not configured (set GOOGLE_CLIENT_ID in .env)'}`);
  console.log(`   Chia RPC:        ${process.env.CHIA_RPC_HOST || 'localhost:8555'}`);
  console.log(`   KeyVault sidecar:${process.env.KEYVAULT_PYTHON_URL || 'http://localhost:5002'}`);
  console.log(`   IPFS provider:   ${process.env.IPFS_PROVIDER || 'data_uri (dev only — use pinata in production)'}`);
  console.log(`   Network:         ${process.env.CHIA_NETWORK || 'testnet10'}`);

  // Warn if Python KeyVault sidecar is not reachable (KeyVault + PayChat chain ops need it)
  try {
    const keyvaultService = require('./services/keyvault-service');
    const sidecar = await keyvaultService.healthCheck();
    console.log(`   Python sidecar:  ${sidecar?.success ? '✓ healthy' : '✗ unhealthy — start python -m ps_keyvault.api'}`);
  } catch (e) {
    console.log(`   Python sidecar:  ✗ not reachable (${e.message})`);
    console.log('                    Run: cd python && pip install -e . && python -m ps_keyvault.api');
  }

  console.log(`\n   Health: GET http://localhost:${PORT}/keyvault/health`);
  console.log(`   API docs: http://localhost:${PORT}/api-docs`);
  console.log('');
});
