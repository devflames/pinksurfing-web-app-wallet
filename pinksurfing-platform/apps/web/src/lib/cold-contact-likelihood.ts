/** How open someone is to cold business contact requests (Find → Request). */

export type ColdContactLikelihood = 'high' | 'moderate' | 'low';

export const COLD_CONTACT_OPTIONS: {
  value: ColdContactLikelihood;
  title: string;
  description: string;
}[] = [
  {
    value: 'high',
    title: 'High — open to outreach',
    description:
      'Cold business requests are welcome. Find users can request you directly without a PayChat nudge.',
  },
  {
    value: 'moderate',
    title: 'Moderate — selective',
    description:
      'You sometimes accept cold requests. Find users are nudged to connect on PayChat first.',
  },
  {
    value: 'low',
    title: 'Low — PayChat first',
    description:
      'You rarely accept cold leads. Find users are guided to grab your attention on PayChat before requesting.',
  },
];

export const DEFAULT_COLD_CONTACT: ColdContactLikelihood = 'moderate';

export function coldContactLikelihoodLabel(v: ColdContactLikelihood): string {
  switch (v) {
    case 'high':
      return 'High likelihood to accept';
    case 'moderate':
      return 'Moderate likelihood to accept';
    case 'low':
      return 'Low likelihood to accept';
  }
}

export function shouldNudgePayChatBeforeRequest(v: ColdContactLikelihood): boolean {
  return v !== 'high';
}

export function coldContactNudgeMessage(v: ColdContactLikelihood, name: string): string {
  if (v === 'low') {
    return `${name} rarely adds cold business contacts. Reach out on PayChat first to get on their radar — then send your request.`;
  }
  return `${name} is selective about cold outreach. A quick PayChat hello often works better than a request alone.`;
}
