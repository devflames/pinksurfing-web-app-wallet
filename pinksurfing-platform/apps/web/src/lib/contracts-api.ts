import { apiFetch, getContractsBase } from './api-client';
import type {
  ApiResponse,
  BusinessContract,
  ContractActionType,
  SettlementMode,
} from './types/contract';

const base = () => getContractsBase();

export async function fetchAllContracts(token: string): Promise<BusinessContract[]> {
  const res = await apiFetch<ApiResponse<BusinessContract[]>>(`${base()}/all`, {
    method: 'GET',
    token,
  });
  return res.data ?? [];
}

export async function fetchContractsByConversation(
  token: string,
  conversationId: string
): Promise<BusinessContract[]> {
  const res = await apiFetch<ApiResponse<BusinessContract[]>>(`${base()}/byConversation`, {
    method: 'POST',
    token,
    body: JSON.stringify({ conversationId }),
  });
  return res.data ?? [];
}

export async function createContract(
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
  const res = await apiFetch<ApiResponse<BusinessContract>>(`${base()}/create`, {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  });
  if (!res.data) throw new Error(res.message || 'Create failed');
  return res.data;
}

export async function executeContractAction(
  token: string,
  contractId: string,
  actionType: ContractActionType,
  note?: string
): Promise<BusinessContract> {
  const res = await apiFetch<ApiResponse<BusinessContract>>(`${base()}/action`, {
    method: 'POST',
    token,
    body: JSON.stringify({ contractId, actionType, note }),
  });
  if (!res.data) throw new Error(res.message || 'Action failed');
  return res.data;
}
