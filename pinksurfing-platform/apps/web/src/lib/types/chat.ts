export type ThreadMessage =
  | {
      id: string;
      kind: 'text';
      side: 'in' | 'out';
      text: string;
      time: string;
      attachmentUrl?: string;
    }
  | {
      id: string;
      kind: 'attachment';
      side: 'in' | 'out';
      attachmentUrl: string;
      fileName?: string;
      text?: string;
      time: string;
    }
  | {
      id: string;
      kind: 'state';
      label: string;
      accent: string;
      contractTitle?: string;
      time: string;
    }
  | {
      id: string;
      kind: 'bizcard';
      side: 'in' | 'out';
      card: import('@/lib/business-card-types').BusinessCardSnapshot;
      time: string;
    };

export type ContactPreview = {
  preview: string;
  time: string;
  unread?: number;
};
