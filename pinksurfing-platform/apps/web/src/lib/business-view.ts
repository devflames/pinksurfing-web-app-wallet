export type BusinessView = 'chat' | 'swap';

export const BUSINESS_VIEWS: { id: BusinessView; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'swap', label: 'BTC Swap' },
];
