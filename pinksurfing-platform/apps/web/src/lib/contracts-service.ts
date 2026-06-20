import {
  createContract as apiCreateContract,
  executeContractAction as apiExecuteContractAction,
  fetchContractsByConversation as apiFetchByConversation,
} from './contracts-api';
import {
  demoContractsByConversation,
  demoCreateContract,
  demoExecuteContractAction,
} from './demo-contracts';
import type { BusinessContract, ContractActionType, SettlementMode } from './types/contract';

export function isContractsLive(): boolean {
  return process.env.NEXT_PUBLIC_CONTRACTS_LIVE === 'true';
}

export async function loadContractsByConversation(
  token: string,
  conversationId: string
): Promise<BusinessContract[]> {
  if (!isContractsLive()) {
    return demoContractsByConversation(conversationId);
  }
  return apiFetchByConversation(token, conversationId);
}

export async function createBusinessContract(
  token: string,
  input: {
    conversationId: string;
    createdByUserId: string;
    counterpartyUserId: string;
    title?: string;
    scopeText: string;
    priceAmount?: number;
    priceCurrency?: string;
    deadlineAt?: string;
    settlementMode?: SettlementMode;
  }
): Promise<BusinessContract> {
  if (!isContractsLive()) {
    return demoCreateContract(input);
  }
  return apiCreateContract(token, input);
}

export async function runContractAction(
  token: string,
  contractId: string,
  actionType: ContractActionType,
  actorUserId: string,
  note?: string
): Promise<BusinessContract> {
  if (!isContractsLive()) {
    return demoExecuteContractAction(contractId, actionType, actorUserId);
  }
  return apiExecuteContractAction(token, contractId, actionType, note);
}
