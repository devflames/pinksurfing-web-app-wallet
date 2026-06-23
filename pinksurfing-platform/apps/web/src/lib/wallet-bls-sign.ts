'use client';

import { mnemonicToSeedSync } from '@scure/bip39';

async function walletSkFromSeed(seed: Uint8Array) {
  const { PrivateKey, deriveChildSk, deriveChildSkUnhardened } = await import('chia-bls');
  const masterSk = PrivateKey.fromSeed(seed);
  let sk = deriveChildSk(masterSk, 12381);
  sk = deriveChildSk(sk, 8444);
  sk = deriveChildSk(sk, 2);
  return deriveChildSkUnhardened(sk, 0);
}

/** Aggregate BLS signature for a PayChat offer spend bundle. */
export async function signPaychatOfferMessages(
  mnemonic: string,
  signingMessageHex: string,
  extraSigningMessagesHex: string[] = []
): Promise<string> {
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  const seed = mnemonicToSeedSync(normalized);
  const sk = await walletSkFromSeed(seed);
  const { AugSchemeMPL } = await import('chia-bls');

  const messages = [
    Buffer.from(signingMessageHex, 'hex'),
    ...extraSigningMessagesHex.map((hex) => Buffer.from(hex, 'hex')),
  ];

  const signatures = messages.map((msg) => AugSchemeMPL.sign(sk, msg));
  const aggregated =
    signatures.length === 1 ? signatures[0] : AugSchemeMPL.aggregate(signatures);
  return aggregated.toHex();
}
