/** Demo / smoke-test peer ids — must not call Raihan live chat API with these. */
const DEMO_PEER_IDS = new Set([
  'web-user-b',
  'web-user-c',
  'web-user-a',
  'demo-user',
]);

const MONGO_OBJECT_ID = /^[a-fA-F0-9]{24}$/;

export function isDemoPeerUserId(peerUserId: string | null | undefined): boolean {
  if (!peerUserId) return true;
  const id = peerUserId.trim();
  if (!id) return true;
  if (DEMO_PEER_IDS.has(id)) return true;
  if (id.startsWith('web-user-')) return true;
  return false;
}

export function isLiveChatPeerUserId(peerUserId: string | null | undefined): boolean {
  if (!peerUserId?.trim()) return false;
  if (isDemoPeerUserId(peerUserId)) return false;
  return MONGO_OBJECT_ID.test(peerUserId.trim()) || peerUserId.startsWith('live-');
}
