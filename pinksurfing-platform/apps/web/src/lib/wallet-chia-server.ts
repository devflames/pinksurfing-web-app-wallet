import fs from 'fs';
import path from 'path';
import { Program } from 'clvm-lib';
import { JacobianPoint } from 'chia-bls';
import { bech32m } from '@scure/base';

type PuzzleSet = {
  syntheticPublicKey: Program;
  defaultHidden: Program;
  payToDelegatedOrHidden: Program;
};

let puzzles: PuzzleSet | null = null;

function findChiaWalletLibRoot(): string {
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'chia-wallet-lib'),
    path.join(process.cwd(), '..', '..', 'node_modules', 'chia-wallet-lib'),
    path.join(process.cwd(), '..', 'node_modules', 'chia-wallet-lib'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'puzzles', 'default_hidden.clvm.hex'))) {
      return candidate;
    }
  }
  throw new Error('chia-wallet-lib puzzles not found');
}

function loadPuzzleHex(name: string): string {
  const libRoot = findChiaWalletLibRoot();
  return fs.readFileSync(path.join(libRoot, 'puzzles', `${name}.clvm.hex`), 'utf8').trim();
}

function getPuzzles(): PuzzleSet {
  if (!puzzles) {
    puzzles = {
      syntheticPublicKey: Program.deserializeHex(loadPuzzleHex('synthetic_public_key')),
      defaultHidden: Program.deserializeHex(loadPuzzleHex('default_hidden')),
      payToDelegatedOrHidden: Program.deserializeHex(loadPuzzleHex('pay_to_delegated_or_hidden')),
    };
  }
  return puzzles;
}

function calculateSyntheticPublicKey(
  publicKey: JacobianPoint,
  hiddenPuzzleHash: Uint8Array
): JacobianPoint {
  const p = getPuzzles();
  return JacobianPoint.fromBytes(
    p.syntheticPublicKey
      .run(
        Program.fromList([
          Program.fromJacobianPoint(publicKey),
          Program.fromBytes(hiddenPuzzleHash),
        ])
      )
      .value.atom,
    false
  );
}

export function chiaAddressFromWalletPk(
  publicKeyHex: string,
  prefix = process.env.NEXT_PUBLIC_WALLET_ADDRESS_PREFIX?.trim() || 'xch'
): string {
  const publicKey = JacobianPoint.fromHexG1(publicKeyHex, false);
  const hiddenPuzzleHash = getPuzzles().defaultHidden.hash();
  const syntheticPublicKey = calculateSyntheticPublicKey(publicKey, hiddenPuzzleHash);
  const puzzle = getPuzzles().payToDelegatedOrHidden.curry([
    Program.fromJacobianPoint(syntheticPublicKey),
  ]);
  return bech32m.encode(prefix, puzzle.hash());
}
