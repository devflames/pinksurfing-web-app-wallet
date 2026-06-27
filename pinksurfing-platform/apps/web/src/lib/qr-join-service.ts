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
  type ParsedQrInput,
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
        ? 'Invalid business invite. Paste their Share-tab link, business email, or invite code.'
        : 'Invalid PayChat invite. Paste their Share-tab link or PayChat ID (PS-…).'
    );
  }

  const code = parsed.code;
  let entry: { contactId: string; label: string } | null = null;

  if (live) {
    if (!opts.token) {
      throw new QrJoinError('Sign in to add contacts.');
    }
    entry =
      opts.kind === 'paychat'
        ? await joinPaychatLive(opts.token, code)
        : await joinBusinessLive(opts.token, code, parsed);
  } else {
    entry = resolveQrJoin(opts.kind, code);
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
    paychatContacts.find((c) => c.askUsd != null && registry?.askUsd != null) ??
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
  code: string,
  parsed: ParsedQrInput
): Promise<{ contactId: string; label: string } | null> {
  const registry = findBusinessRegistryEntry(code);
  const email = parsed.email?.trim().toLowerCase() || registry?.email?.trim().toLowerCase();
  if (!email) {
    throw new QrJoinError(
      'Business invite not found. Paste the full link from their Share tab, or enter their business email.'
    );
  }

  try {
    await addBusinessContactByEmail(token, email);
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
      (c.userId === registry?.userId ||
        c.name.toLowerCase() === (registry?.name ?? '').toLowerCase())
  );

  const label = match?.name ?? registry?.name ?? email.split('@')[0];

  if (match) {
    upsertDynamicBusinessContact({
      id: match.id,
      name: match.name,
      code: registry?.code ?? code,
      email,
      userId: match.userId ?? registry?.userId,
    });
    return { contactId: match.id, label: match.name };
  }

  const contactId = dynamicBusinessContactId(registry?.userId ?? email);
  upsertDynamicBusinessContact({
    id: contactId,
    name: label,
    code: registry?.code ?? code,
    email,
    userId: registry?.userId,
  });
  return { contactId, label };
}
