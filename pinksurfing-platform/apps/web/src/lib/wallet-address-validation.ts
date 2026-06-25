const CHIA_ADDRESS = /^(xch|txch)1[a-z0-9]+$/i;
const BTC_ADDRESS = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,}$/i;
const ETH_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const BTC_PUBKEY = /^(02|03)[a-fA-F0-9]{64}$/;

export type AddressValidation =
  | { ok: true }
  | { ok: false; message: string };

export function validateChiaWalletAddress(value: string): AddressValidation {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, message: 'Enter your Chia wallet address (xch1… or txch1…).' };
  }
  if (BTC_ADDRESS.test(trimmed)) {
    return {
      ok: false,
      message:
        'That looks like a Bitcoin address (bc1…). Use a Chia address here — XCH only. BTC uses the separate Bitcoin public key field for atomic swaps.',
    };
  }
  if (ETH_ADDRESS.test(trimmed)) {
    return {
      ok: false,
      message: 'Ethereum addresses are not supported. Use a Chia address (xch1… or txch1…).',
    };
  }
  if (!CHIA_ADDRESS.test(trimmed)) {
    return {
      ok: false,
      message: 'Invalid Chia address. It should start with xch1 or txch1 (testnet).',
    };
  }
  return { ok: true };
}

export function validateBtcPubkey(value: string): AddressValidation {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true };
  if (BTC_ADDRESS.test(trimmed)) {
    return {
      ok: false,
      message:
        'Paste a Bitcoin public key (hex starting with 02 or 03), not a bc1 receive address.',
    };
  }
  if (!BTC_PUBKEY.test(trimmed)) {
    return {
      ok: false,
      message: 'Invalid Bitcoin public key. Expected 66 hex chars starting with 02 or 03.',
    };
  }
  return { ok: true };
}

export function detectMisplacedBtcAddress(chiaAddress: string): boolean {
  return BTC_ADDRESS.test(chiaAddress.trim());
}
