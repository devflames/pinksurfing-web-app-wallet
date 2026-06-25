import {
  addBusinessContactByEmail,
  addPaychatContactByPspayId,
  fetchContactList,
  isChatLive,
} from './chat-api';
import {
  dynamicBusinessContactId,
  upsertDynamicBusinessContact,
} from './dynamic-business-contacts';
import {
  dynamicPaychatContactId,
  upsertDynamicPaychatContact,
} from './dynamic-paychat-contacts';
import {
  findBusinessRegistryEntry,
  findPaychatRegistryEntry,
  joinContactViaQr,
  normalizePaychatCode,
  parseQrInput,
  resolveQrJoin,
  type QrJoinKind,
} from './qr-invite';

export class QrJoinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QrJoinError';
  }
}

export async function executeQrJoin(opts: {
  kind: QrJoinKind;
  raw: string;
  token: string | null;
  live?: boolean;
}): Promise<{ contactId: string; label: string }> {
  const live = opts.live ?? isChatLive();
  const parsed = parseQrInput(opts.raw);
  if (!parsed || parsed.kind !== opts.kind) {
    throw new QrJoinError(
      opts.kind === 'business'
        ? 'Invalid business invite. Scan their card QR or enter their business code.'
        : 'Invalid PayChat invite. Scan their PayChat QR or enter their PS- ID.'
    );
  }

  const code = parsed.code;
  let entry = resolveQrJoin(opts.kind, code);

  if (!entry && live && opts.token) {
    if (opts.kind === 'paychat') {
      entry = await joinPaychatLive(opts.token, code);
    } else {
      entry = await joinBusinessLive(opts.token, code);
    }
  }

  if (!entry) {
    throw new QrJoinError('Invite not found. Ask them to share their card again.');
  }

  joinContactViaQr(opts.kind, entry.contactId);
  return entry;
}

async function joinPaychatLive(
  token: string,
  code: string
): Promise<{ contactId: string; label: string } | null> {
  const pspayId = normalizePaychatCode(code);
  const registry = findPaychatRegistryEntry(pspayId);

  try {
    await addPaychatContactByPspayId(token, pspayId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (!msg.toLowerCase().includes('already exists') && !msg.toLowerCase().includes('exists')) {
      throw e;
    }
  }

  const contacts = await fetchContactList(token);
  const paychatContacts = contacts.filter((c) => c.type === 'paychat');
  const match =
    paychatContacts.find((c) => c.name.toLowerCase() === registry?.name.toLowerCase()) ??
    paychatContacts[paychatContacts.length - 1];

  if (match) {
    upsertDynamicPaychatContact({
      id: match.id,
      name: match.name,
      code: pspayId,
      askUsd: match.askUsd,
      userId: match.userId,
    });
    return { contactId: match.id, label: match.name };
  }

  if (registry) {
    const contactId = dynamicPaychatContactId(registry.userId);
    upsertDynamicPaychatContact({
      id: contactId,
      name: registry.name,
      code: registry.code,
      askUsd: registry.askUsd,
      userId: registry.userId,
    });
    return { contactId, label: registry.name };
  }

  const contactId = dynamicPaychatContactId(pspayId);
  upsertDynamicPaychatContact({
    id: contactId,
    name: pspayId,
    code: pspayId,
  });
  return { contactId, label: pspayId };
}

async function joinBusinessLive(
  token: string,
  code: string
): Promise<{ contactId: string; label: string } | null> {
  const registry = findBusinessRegistryEntry(code);
  if (!registry?.email) return null;

  try {
    await addBusinessContactByEmail(token, registry.email);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (!msg.toLowerCase().includes('already exists') && !msg.toLowerCase().includes('exists')) {
      throw e;
    }
  }

  const contacts = await fetchContactList(token);
  const match = contacts.find(
    (c) =>
      c.type === 'business' &&
      (c.userId === registry.userId ||
        c.name.toLowerCase() === registry.name.toLowerCase())
  );

  if (match) {
    upsertDynamicBusinessContact({
      id: match.id,
      name: match.name,
      code: registry.code,
      email: registry.email,
      userId: match.userId ?? registry.userId,
    });
    return { contactId: match.id, label: match.name };
  }

  const contactId = dynamicBusinessContactId(registry.userId);
  upsertDynamicBusinessContact({
    id: contactId,
    name: registry.name,
    code: registry.code,
    email: registry.email,
    userId: registry.userId,
  });
  return { contactId, label: registry.name };
}
