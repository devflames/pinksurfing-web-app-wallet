import { NextResponse } from 'next/server';
import { PrivateKey, deriveChildSk, deriveChildSkUnhardened } from 'chia-bls';
import { chiaAddressFromWalletPk } from '@/lib/wallet-chia-server';

export const runtime = 'nodejs';

function walletSkFromMaster(masterSk: PrivateKey, index: number): PrivateKey {
  let sk = deriveChildSk(masterSk, 12381);
  sk = deriveChildSk(sk, 8444);
  sk = deriveChildSk(sk, 2);
  return deriveChildSkUnhardened(sk, index);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      walletPk?: string;
      mnemonic?: string;
    };

    let publicKeyHex = body.walletPk?.trim();

    if (!publicKeyHex && body.mnemonic?.trim()) {
      const { mnemonicToSeedSync, validateMnemonic } = await import('@scure/bip39');
      const { wordlist } = await import('@scure/bip39/wordlists/english.js');
      const mnemonic = body.mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!validateMnemonic(mnemonic, wordlist)) {
        return NextResponse.json({ message: 'Invalid mnemonic' }, { status: 400 });
      }
      const masterSk = PrivateKey.fromSeed(mnemonicToSeedSync(mnemonic));
      publicKeyHex = walletSkFromMaster(masterSk, 0).getG1().toHex();
    }

    if (!publicKeyHex || publicKeyHex.length !== 96) {
      return NextResponse.json(
        { message: 'walletPk must be a 96-char BLS public key hex' },
        { status: 400 }
      );
    }

    const chiaAddress = chiaAddressFromWalletPk(publicKeyHex);
    return NextResponse.json({ chiaAddress, walletPk: publicKeyHex });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : 'Address derivation failed' },
      { status: 500 }
    );
  }
}
