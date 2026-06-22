/**
 * Verify PinkSurfing SSO access tokens (HS256, same key as Django SIMPLE_JWT).
 */

const crypto = require('crypto');

function getJwtSecret() {
  return (
    process.env.JWT_SIGNING_KEY ||
    process.env.SSO_JWT_SECRET ||
    process.env.JWT_SECRET ||
    ''
  );
}

function base64UrlDecode(str) {
  let normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) normalized += '=';
  return Buffer.from(normalized, 'base64');
}

function verifySsoJwt(token) {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error('JWT_SIGNING_KEY not configured on wallet backend');
  }

  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest();
  const actualSig = base64UrlDecode(signatureB64);

  if (
    actualSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(actualSig, expectedSig)
  ) {
    throw new Error('Invalid JWT signature');
  }

  const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));

  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('JWT expired');
  }

  if (payload.token_type && payload.token_type !== 'access') {
    throw new Error('Refresh token not accepted');
  }

  const issuer = process.env.JWT_ISSUER;
  if (issuer && payload.iss && payload.iss !== issuer) {
    throw new Error('Invalid JWT issuer');
  }

  const audience = process.env.JWT_AUDIENCE;
  if (audience && payload.aud && payload.aud !== audience) {
    throw new Error('Invalid JWT audience');
  }

  const ssoUserId = String(payload.user_id ?? payload.sub ?? '');
  if (!ssoUserId) {
    throw new Error('JWT missing user_id');
  }

  return {
    ssoUserId,
    email: payload.email || '',
    firstName: payload.first_name || '',
    lastName: payload.last_name || '',
    payload,
  };
}

function requireSsoJwt(req, res, next) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ status: 'error', message: 'Missing Bearer token' });
  }

  try {
    req.sso = verifySsoJwt(match[1]);
    next();
  } catch (err) {
    return res.status(401).json({
      status: 'error',
      message: err.message || 'Invalid token',
    });
  }
}

module.exports = { verifySsoJwt, requireSsoJwt, getJwtSecret };
