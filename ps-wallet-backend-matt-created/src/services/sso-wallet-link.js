const db = require('./db');

function getLinkBySsoUserId(ssoUserId) {
  return db
    .prepare(
      `SELECT sso_user_id, email, chia_address, wallet_pk, launcher_id, created_at, updated_at
       FROM sso_wallet_links WHERE sso_user_id = ?`
    )
    .get(String(ssoUserId));
}

function getLinkByChiaAddress(chiaAddress) {
  return db
    .prepare(
      `SELECT sso_user_id, email, chia_address, wallet_pk, launcher_id
       FROM sso_wallet_links WHERE chia_address = ?`
    )
    .get(String(chiaAddress).trim());
}

function resolveLauncherId(chiaAddress, explicitLauncherId) {
  if (explicitLauncherId) return explicitLauncherId;
  const row = db
    .prepare(
      `SELECT launcher_id FROM keyvaults
       WHERE wallet_address = ? AND status != 'melted'
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(chiaAddress);
  return row?.launcher_id || null;
}

function upsertLink({ ssoUserId, email, chiaAddress, walletPk, launcherId }) {
  const normalizedAddress = String(chiaAddress).trim();
  const normalizedPk = String(walletPk).trim();
  const resolvedLauncherId = resolveLauncherId(normalizedAddress, launcherId || null);

  db.prepare(
    `INSERT INTO sso_wallet_links (sso_user_id, email, chia_address, wallet_pk, launcher_id, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(sso_user_id) DO UPDATE SET
       email = excluded.email,
       chia_address = excluded.chia_address,
       wallet_pk = excluded.wallet_pk,
       launcher_id = COALESCE(excluded.launcher_id, sso_wallet_links.launcher_id),
       updated_at = datetime('now')`
  ).run(
    String(ssoUserId),
    email || null,
    normalizedAddress,
    normalizedPk,
    resolvedLauncherId
  );

  return getLinkBySsoUserId(ssoUserId);
}

module.exports = {
  getLinkBySsoUserId,
  getLinkByChiaAddress,
  upsertLink,
  resolveLauncherId,
};
