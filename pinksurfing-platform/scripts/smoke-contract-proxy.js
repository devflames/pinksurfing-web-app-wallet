/**
 * Minimal mobileapi /chat proxy — forwards JWT to chat (smoke test)
 */
const path = require('path');

const BACKEND_ROOT = process.env.PINKSURFING_ROOT || path.join(__dirname, '../..');
const apiDir = path.join(BACKEND_ROOT, 'PS-App-Backend/mobileapi');
const apiNodeModules = path.join(apiDir, 'node_modules');

const express = require(path.join(apiNodeModules, 'express'));
const requestPromise = require(path.join(apiNodeModules, 'request-promise'));
const jwt = require(path.join(apiNodeModules, 'jsonwebtoken'));
const { RtcTokenBuilder, RtcRole } = require(path.join(apiNodeModules, 'agora-access-token'));

const APP_ID = '6633314fbbcf41f8a2c73dac26dd8552';
const APP_CERTIFICATE = '1c384022a9e741c7868f82563e0330e7';

const JWT_SECRET = process.env.JWT_SECRET || 'sso_secret_key_for_jwt_decoding';
const CHAT_URL = process.env.CHAT_URL || 'http://127.0.0.1:6161';
const PORT = Number(process.env.MOBILEAPI_PORT || 6003);

function tokenVerification(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'fail', message: 'No token provided' });
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ status: 'fail', message: 'Invalid token' });
  }
}

const app = express();
app.use(express.json());
app.get('/', (_req, res) => res.json({ status: 'ok', service: 'smoke-contract-proxy' }));

/** Agora RTC token — mirrors mobileapi GET /rtc/:channel/:role/:tokentype/:uid */
app.get('/rtc/:channel/:role/:tokentype/:uid', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const channelName = req.params.channel;
  const uid = parseInt(req.params.uid, 10);
  const role = req.params.role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const expire = Math.floor(Date.now() / 1000) + 3600;
  const token =
    req.params.tokentype === 'uid'
      ? RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, uid, role, expire)
      : RtcTokenBuilder.buildTokenWithAccount(APP_ID, APP_CERTIFICATE, channelName, String(uid), role, expire);
  return res.json({ rtcToken: token });
});

app.use('/chat', tokenVerification, async (req, res) => {
  const paths = req.originalUrl.slice(5);
  const method = req.method;
  const chatProxyHeaders = {};
  if (req.headers.authorization) {
    chatProxyHeaders.Authorization = req.headers.authorization;
  }

  try {
    let result;
    if (method === 'GET') {
      const data = encodeURIComponent(JSON.stringify(req.user));
      result = await requestPromise({
        uri: `${CHAT_URL}${paths}?value=${data}`,
        method: 'GET',
        headers: chatProxyHeaders,
        json: true,
        simple: false,
        resolveWithFullResponse: true,
      });
    } else if (method === 'POST') {
      const body = { ...req.body, value: req.user };
      result = await requestPromise({
        uri: `${CHAT_URL}${paths}`,
        method: 'POST',
        headers: chatProxyHeaders,
        body,
        json: true,
        simple: false,
        resolveWithFullResponse: true,
      });
    } else {
      return res.status(405).json({ status: 'fail', message: 'Method not allowed' });
    }
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    console.error('proxy error:', err.message);
    return res.status(500).json({ status: 'fail', message: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT} (chat proxy only)`);
});
