export type SwapDirection = 'xch_to_btc' | 'btc_to_xch';

export type SwapStatus =
  | 'created'
  | 'accepted'
  | 'claimed'
  | 'completed'
  | 'refunded'
  | 'cancelled';

export interface ChiaHtlc {
  puzzleHash?: string | null;
  address?: string | null;
  coinId?: string | null;
  clawbackPubkey?: string | null;
  sweepPubkey?: string | null;
  timeoutSeconds?: number | null;
}

export interface BtcHtlc {
  address?: string | null;
  redeemScript?: string | null;
  fundingTxid?: string | null;
  claimPubkey?: string | null;
  refundPubkey?: string | null;
  timeoutBlocks?: number | null;
}

export interface AtomicSwap {
  id: string;
  initiatorChiaAddress: string;
  initiatorBtcPubkey?: string | null;
  counterpartyChiaAddress?: string | null;
  counterpartyBtcPubkey?: string | null;
  direction: SwapDirection;
  xchAmountMojos: string;
  btcAmountSats: string;
  secretHash: string;
  chiaHtlc: ChiaHtlc;
  btcHtlc: BtcHtlc;
  status: SwapStatus;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
}

export interface WalletHealth {
  name?: string;
  version?: string;
  keyvault?: {
    success: boolean;
    nodejs: string;
    python: { success?: boolean; message?: string };
  };
}

export interface WalletProvisionStatus {
  status: string;
  provisioned: boolean;
  chiaAddress?: string;
  walletPk?: string;
  launcherId?: string | null;
  email?: string | null;
  linkedAt?: string;
}

export interface KeyVaultLookup {
  success: boolean;
  launcherId?: string;
  message?: string;
}

export interface KeyVaultStatus {
  success: boolean;
  status?: 'active' | 'pending' | 'not_found' | 'melted' | string;
  launcherId?: string;
  message?: string;
}
