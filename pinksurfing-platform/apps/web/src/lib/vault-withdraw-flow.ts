import {
  fetchVaultDepositInfo,
  prepareVaultWithdraw,
  recoverKeyVault,
  submitKeyVaultSpend,
} from './wallet-api';
import { signBlsCoinSpends } from './wallet-bls-sign';

export type VaultWithdrawInput = {
  launcherId: string;
  ownerPubkeyHex: string;
  mnemonic: string;
  destinationAddress: string;
  amountMojos: number;
  feeMojos?: number;
};

export type VaultWithdrawResult = {
  destination: string;
  amount: number;
  fee: number;
};

export async function executeVaultWithdraw(
  input: VaultWithdrawInput
): Promise<VaultWithdrawResult> {
  const recover = await recoverKeyVault(input.launcherId);
  if (!recover.success || !recover.state?.all_cid_hashes?.length) {
    throw new Error(recover.message ?? 'Could not recover KeyVault state from chain');
  }

  const prepared = await prepareVaultWithdraw({
    launcherId: input.launcherId,
    destinationAddress: input.destinationAddress.trim(),
    amount: input.amountMojos,
    ownerPubkeyHex: input.ownerPubkeyHex,
    currentCidHashes: recover.state.all_cid_hashes,
    feeAmount: input.feeMojos ?? 0,
  });

  if (!prepared.success || !prepared.coinSpendsJson || !prepared.signingMessageHex) {
    throw new Error(prepared.message ?? 'Prepare withdraw failed');
  }

  const signatureHex = await signBlsCoinSpends(input.mnemonic, prepared.signingMessageHex);
  const submitted = await submitKeyVaultSpend({
    coinSpendsJson: prepared.coinSpendsJson,
    signatureHex,
  });

  if (!submitted.success) {
    throw new Error(submitted.message ?? 'Submit withdraw failed');
  }

  return {
    destination: prepared.destination ?? input.destinationAddress,
    amount: prepared.amount ?? input.amountMojos,
    fee: prepared.fee ?? input.feeMojos ?? 0,
  };
}

export async function loadVaultDepositAddress(launcherId: string): Promise<string> {
  const info = await fetchVaultDepositInfo(launcherId);
  if (!info.success || !info.depositAddress) {
    throw new Error(info.message ?? 'Could not load vault deposit address');
  }
  return info.depositAddress;
}
