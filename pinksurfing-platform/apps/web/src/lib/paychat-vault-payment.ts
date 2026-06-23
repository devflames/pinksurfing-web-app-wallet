'use client';

import type { Contact } from '@pinksurfing/ui';
import { findPaychatRegistryByUserId, findPaychatRegistryEntry } from './qr-invite';
import { peerUserIdForLiveContact } from './chat-api';
import {
  acceptPaychatOffer,
  fetchPaychatAskPrice,
  preparePaychatOffer,
  storePaychatOffer,
  usdToMojosEstimate,
} from './wallet-api';
import { loadWalletSecrets } from './wallet-secrets-storage';
import { signPaychatOfferMessages } from './wallet-bls-sign';

export async function resolveRecipientChiaAddress(contact: Contact): Promise<string | null> {
  const peerId = peerUserIdForLiveContact(contact);
  if (peerId) {
    const registry = findPaychatRegistryByUserId(peerId);
    if (registry?.chiaAddress) return registry.chiaAddress;
  }

  const codeMatch = contact.id.match(/paychat-scan-(.+)/);
  if (codeMatch) {
    const byUser = findPaychatRegistryByUserId(codeMatch[1]);
    if (byUser?.chiaAddress) return byUser.chiaAddress;
  }

  return null;
}

export async function resolvePaychatAmountMojos(
  recipientAddress: string,
  fallbackUsd: number
): Promise<number> {
  const ask = await fetchPaychatAskPrice(recipientAddress);
  if (ask?.isActive && ask.askAmountMojos > 0) return ask.askAmountMojos;
  return usdToMojosEstimate(fallbackUsd);
}

export async function payPaychatViaVault(opts: {
  email: string;
  recipientAddress: string;
  amountUsd: number;
  memo?: string;
}): Promise<{ offerId: string; amountMojos: number }> {
  const secrets = await loadWalletSecrets(opts.email);
  if (!secrets?.mnemonic || !secrets.walletPk || !secrets.chiaAddress) {
    throw new Error('Set up your wallet under Me first');
  }

  const amountMojos = await resolvePaychatAmountMojos(opts.recipientAddress, opts.amountUsd);

  const prepared = await preparePaychatOffer({
    senderPubkeyHex: secrets.walletPk,
    recipientAddress: opts.recipientAddress,
    amountMojos,
    memo: opts.memo ?? 'PayChat unlock',
  });

  const signatureHex = await signPaychatOfferMessages(
    secrets.mnemonic,
    prepared.signingMessageHex,
    prepared.extraSigningMessagesHex ?? []
  );

  const stored = await storePaychatOffer({
    senderAddress: secrets.chiaAddress,
    recipientAddress: opts.recipientAddress,
    amountMojos,
    memo: opts.memo ?? 'PayChat unlock',
    coinSpendsJson: prepared.coinSpendsJson,
    signatureHex,
    coinIds: prepared.coinIds ?? [],
  });

  await acceptPaychatOffer(stored.id);

  return { offerId: stored.id, amountMojos };
}
