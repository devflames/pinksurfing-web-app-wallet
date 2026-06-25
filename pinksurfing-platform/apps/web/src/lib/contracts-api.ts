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

export async function fetchContractById(
  token: string,
  contractId: string
): Promise<BusinessContract> {
  const res = await apiFetch<ApiResponse<BusinessContract>>(
    `${base()}/get?contractId=${encodeURIComponent(contractId)}`,
    { method: 'GET', token }
  );
  if (!res.data) throw new Error(res.message || 'Contract not found');
  return res.data;
}

export async function createContractPaymentLink(
  token: string,
  contractId: string
): Promise<string> {
  const res = await apiFetch<{
    status: string;
    data?: { paymentLink?: { url?: string; longUrl?: string } };
    message?: string;
  }>(`${base()}/create-payment-link`, {
    method: 'POST',
    token,
    body: JSON.stringify({ contractId }),
  });
  const url = res.data?.paymentLink?.url || res.data?.paymentLink?.longUrl;
  if (!url) throw new Error(res.message || 'No payment URL returned');
  return url;
}
