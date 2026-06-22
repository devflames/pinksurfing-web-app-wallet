/**
 * OpenAPI 3.0 spec for ps-wallet-backend.
 * Served at GET /api-docs (Swagger UI) and GET /api-docs.json
 */

const ed25519Params = {
  type: 'object',
  properties: {
    'X-Auth-Address': { type: 'string', description: 'Chia address or messaging PK' },
    'X-Auth-Timestamp': { type: 'string', description: 'Unix ms (within 5 min)' },
    'X-Auth-Signature': { type: 'string', description: 'Base64 Ed25519 signature' },
    'X-Auth-Nonce': { type: 'string', description: 'Optional replay nonce' },
  },
  required: ['X-Auth-Address', 'X-Auth-Timestamp', 'X-Auth-Signature'],
};

function op(method, path, tag, summary, opts = {}) {
  return {
    [path]: {
      [method.toLowerCase()]: {
        tags: [tag],
        summary,
        description: opts.description,
        security: opts.sso
          ? [{ SsoBearer: [] }]
          : opts.auth
            ? [{ Ed25519Auth: [] }]
            : opts.public
              ? []
              : undefined,
        parameters: opts.params,
        requestBody: opts.body,
        responses: opts.responses || {
          200: { description: 'Success' },
          401: { description: 'Unauthorized' },
        },
      },
    },
  };
}

function merge(...parts) {
  return Object.assign({}, ...parts);
}

function buildOpenApiSpec() {
  const publicBase = process.env.API_DOCS_PUBLIC_URL || 'https://app.pinksurfing.com/api/wallet';
  const localPort = process.env.PORT || 3099;

  return {
    openapi: '3.0.3',
    info: {
      title: 'PinkSurfing Wallet API',
      version: '1.0.0',
      description: [
        'Non-custodial Chia wallet backend — KeyVault on-chain backups, atomic swaps (BTC ↔ XCH),',
        'E2E messaging, PayChat offers, profiles, Google Drive OAuth, and recovery MFA.',
        '',
        '**Production:** proxied at `https://app.pinksurfing.com/api/wallet/*` via NestJS gateway.',
        '',
        '**Related docs:** [Chat & mobile API](https://coreapi.pinksurfing.com/api-docs/)',
        '',
        '**Auth:** Mutating routes use Ed25519 headers (`X-Auth-Address`, `X-Auth-Timestamp`, `X-Auth-Signature`).',
        'Signature covers `<timestamp>:<nonce>:<METHOD>:<path>` (router path, e.g. `/create` not `/swaps/create`).',
        '',
        '**SSO provisioning:** `GET /wallet/status` and `POST /wallet/link` use `Authorization: Bearer <SSO access JWT>`.',
      ].join('\n'),
      contact: { name: 'PinkSurfing wallet team' },
    },
    servers: [
      { url: publicBase, description: 'Production (via gateway on app.pinksurfing.com)' },
      { url: `http://localhost:${localPort}`, description: 'Local Node wallet API' },
    ],
    tags: [
      { name: 'Health', description: 'Service health' },
      { name: 'KeyVault', description: 'On-chain encrypted wallet backup (Chia singleton + IPFS)' },
      { name: 'Swaps', description: 'BTC ↔ XCH atomic swap metadata' },
      { name: 'Profiles', description: 'Wallet identity registry' },
      { name: 'Auth', description: 'Google OAuth for Drive backup' },
      { name: 'Email Auth', description: 'Email OTP sessions' },
      { name: 'Wallet / NFT', description: 'Chia profile NFT inscriptions' },
      { name: 'Wallet provision', description: 'SSO user ↔ wallet link (status + link)' },
      { name: 'Messages', description: 'E2E encrypted message relay' },
      { name: 'Recovery', description: 'Split-key MFA recovery' },
      { name: 'PayChat', description: 'Chia PayChat offers' },
      { name: 'Calls', description: 'Agora RTC call state' },
      { name: 'Groups', description: 'E2E group chat' },
      { name: 'DID', description: 'Chia DID and business cards' },
      { name: 'Files', description: 'Encrypted attachments' },
    ],
    components: {
      securitySchemes: {
        Ed25519Auth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Auth-Address',
          description: 'Ed25519 wallet auth — also send X-Auth-Timestamp and X-Auth-Signature',
        },
        SessionToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Session-Token',
          description: 'Email OTP session token',
        },
        SsoBearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'PinkSurfing SSO access token (HS256, shared JWT_SIGNING_KEY)',
        },
      },
    },
    paths: merge(
      {
        '/': {
          get: {
            tags: ['Health'],
            summary: 'Service info',
            responses: { 200: { description: 'JSON service descriptor' } },
          },
        },
      },
      op('get', '/keyvault/health', 'KeyVault', 'KeyVault + Python sidecar health', { public: true }),
      op('get', '/keyvault/lookup/{walletAddress}', 'KeyVault', 'Lookup KeyVault by Chia address', {
        public: true,
        params: [{ name: 'walletAddress', in: 'path', required: true, schema: { type: 'string' } }],
      }),
      op('get', '/keyvault/status/{launcherId}', 'KeyVault', 'KeyVault singleton status', {
        public: true,
        params: [{ name: 'launcherId', in: 'path', required: true, schema: { type: 'string' } }],
      }),
      op('get', '/keyvault/fetch-backup/{cid}', 'KeyVault', 'Fetch encrypted backup from IPFS', {
        public: true,
        params: [{ name: 'cid', in: 'path', required: true, schema: { type: 'string' } }],
      }),
      op('post', '/keyvault/pin', 'KeyVault', 'Pin encrypted backup to IPFS only'),
      op('post', '/keyvault/create', 'KeyVault', 'Deploy KeyVault (user-funded coin)'),
      op('post', '/keyvault/create-auto', 'KeyVault', 'Deploy KeyVault (server-funded)'),
      op('post', '/keyvault/recover', 'KeyVault', 'Recover vault state from chain'),
      op('post', '/keyvault/prepare-update', 'KeyVault', 'Prepare backup update (client signs)'),
      op('post', '/keyvault/prepare-transfer', 'KeyVault', 'Prepare ownership transfer'),
      op('post', '/keyvault/submit', 'KeyVault', 'Submit signed spend bundle'),
      op('get', '/keyvault/vault/balance/{launcherId}', 'KeyVault', 'Vault XCH balance', {
        public: true,
        params: [{ name: 'launcherId', in: 'path', required: true, schema: { type: 'string' } }],
      }),
      op('post', '/swaps/create', 'Swaps', 'Create atomic swap offer', {
        auth: true,
        description: 'Returns swap metadata + secret to initiator (secret not stored server-side).',
      }),
      op('get', '/swaps/open', 'Swaps', 'List open swaps', {
        public: true,
        params: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }],
      }),
      op('get', '/swaps/address/{addr}', 'Swaps', 'Swaps for address', {
        public: true,
        params: [
          { name: 'addr', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
      }),
      op('get', '/swaps/{id}', 'Swaps', 'Get swap by ID', {
        public: true,
        params: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      }),
      op('post', '/swaps/{id}/accept', 'Swaps', 'Accept swap', { auth: true }),
      op('post', '/swaps/{id}/claim', 'Swaps', 'Claim with preimage', { auth: true }),
      op('post', '/swaps/{id}/complete', 'Swaps', 'Mark completed', { auth: true }),
      op('post', '/swaps/{id}/refund', 'Swaps', 'Mark refunded', { auth: true }),
      op('post', '/swaps/{id}/cancel', 'Swaps', 'Cancel open offer', { auth: true }),
      op('post', '/profiles/register', 'Profiles', 'Register wallet profile', { auth: true }),
      op('get', '/profiles/resolve/{address}', 'Profiles', 'Resolve profile by Chia address', {
        public: true,
        params: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
      }),
      op('get', '/profiles/search', 'Profiles', 'Search profiles', {
        public: true,
        params: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
      }),
      op('get', '/profiles/directory', 'Profiles', 'List registered profiles', { public: true }),
      op('get', '/auth/google', 'Auth', 'Start Google OAuth', { public: true }),
      op('get', '/auth/google/callback', 'Auth', 'OAuth callback', { public: true }),
      op('get', '/auth/google/token/{id}', 'Auth', 'Poll OAuth tokens by session ID', {
        public: true,
        params: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      }),
      op('get', '/auth/google/status', 'Auth', 'OAuth config status', { public: true }),
      op('post', '/auth/email/send-otp', 'Email Auth', 'Send email OTP', { public: true }),
      op('post', '/auth/email/verify-otp', 'Email Auth', 'Verify OTP → session token', { public: true }),
      op('get', '/wallet/status', 'Wallet provision', 'SSO wallet provision status', {
        sso: true,
        description: 'Returns whether the authenticated SSO user has a linked Chia wallet.',
        responses: {
          200: { description: '{ provisioned: boolean, chiaAddress?, launcherId? }' },
          401: { description: 'Invalid or missing SSO JWT' },
        },
      }),
      op('post', '/wallet/link', 'Wallet provision', 'Link SSO user to wallet address', {
        sso: true,
        description: 'Associates SSO user_id with chiaAddress + walletPk. Keys remain client-side.',
        body: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['chiaAddress', 'walletPk'],
                properties: {
                  chiaAddress: { type: 'string' },
                  walletPk: { type: 'string', description: 'Wallet Ed25519 public key (hex)' },
                  launcherId: { type: 'string', description: 'Optional KeyVault launcher ID' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Wallet linked' },
          401: { description: 'Invalid SSO JWT' },
          409: { description: 'Address linked to another account' },
        },
      }),
      op('get', '/wallet/chain-status', 'Wallet / NFT', 'Chia node sync status', { public: true }),
      op('post', '/wallet/inscribe-profile', 'Wallet / NFT', 'Mint profile NFT'),
      op('get', '/wallet/profile/{address}', 'Wallet / NFT', 'Latest profile NFT', {
        public: true,
        params: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
      }),
      op('post', '/messages/send', 'Messages', 'Send encrypted message blob', { auth: true }),
      op('get', '/messages/receive/{address}', 'Messages', 'Receive undelivered messages', { auth: true }),
      op('get', '/messages/conversation', 'Messages', 'Conversation history', { public: true }),
      op('post', '/recovery/setup-totp', 'Recovery', 'Setup TOTP MFA', { auth: true }),
      op('post', '/recovery/verify', 'Recovery', 'Verify MFA → release key share', { public: true }),
      op('post', '/paychat/prepare-offer', 'PayChat', 'Prepare Chia PayChat offer'),
      op('get', '/paychat/ask-price/{address}', 'PayChat', 'Get ask price', {
        public: true,
        params: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
      }),
      op('get', '/calls/token/{channel}/{uid}', 'Calls', 'Agora RTC token', {
        public: true,
        params: [
          { name: 'channel', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'uid', in: 'path', required: true, schema: { type: 'string' } },
        ],
      }),
      op('post', '/groups/create', 'Groups', 'Create E2E group'),
      op('get', '/groups/for/{address}', 'Groups', 'Groups for wallet', {
        public: true,
        params: [{ name: 'address', in: 'path', required: true, schema: { type: 'string' } }],
      }),
      op('post', '/did/prepare-create', 'DID', 'Prepare Chia DID creation'),
      op('get', '/did/lookup/{walletAddress}', 'DID', 'Lookup DID by wallet', {
        public: true,
        params: [{ name: 'walletAddress', in: 'path', required: true, schema: { type: 'string' } }],
      }),
      op('post', '/files/upload', 'Files', 'Upload encrypted attachment'),
      op('get', '/files/{id}', 'Files', 'Download encrypted file', {
        public: true,
        params: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      })
    ),
  };
}

module.exports = { buildOpenApiSpec, ed25519Params };
