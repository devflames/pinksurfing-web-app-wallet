'use client';

import type { ThreadMessage } from '@/lib/types/chat';
import { BusinessCardFlipView } from '@/components/cards/BusinessCardFlipView';

function StateEventCard({ msg }: { msg: Extract<ThreadMessage, { kind: 'state' }> }) {
  return (
    <div className="my-1 overflow-hidden rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)]">
      <div
        className="flex items-center gap-1.5 border-b px-2.5 py-1.5"
        style={{
          borderColor: `${msg.accent}40`,
          background: `${msg.accent}12`,
        }}
      >
        <span className="text-[13px]" style={{ color: msg.accent }}>
          ⚡
        </span>
        <span className="flex-1 text-[10px] font-medium" style={{ color: msg.accent }}>
          {msg.label}
        </span>
      </div>
      {msg.contractTitle && (
        <div className="px-2.5 py-1.5 text-[10px] text-[var(--ps-white)]">{msg.contractTitle}</div>
      )}
      <div className="px-2.5 pb-1.5 text-[9px] text-[var(--ps-dim)]">{msg.time}</div>
    </div>
  );
}

function isAudioAttachment(url: string, fileName?: string): boolean {
  const probe = `${fileName ?? ''} ${url}`;
  return /\.(webm|mp3|m4a|ogg|wav)(\?|$)/i.test(probe) || /voice-/i.test(fileName ?? '');
}

function AttachmentBubble({
  msg,
}: {
  msg: Extract<ThreadMessage, { kind: 'attachment' }>;
}) {
  const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(msg.attachmentUrl);
  const isAudio = isAudioAttachment(msg.attachmentUrl, msg.fileName);
  return (
    <div
      className={`max-w-[75%] overflow-hidden rounded-lg border text-[11px] text-[var(--ps-white)] ${
        msg.side === 'in'
          ? 'border-[var(--ps-brd)] bg-[var(--ps-card)] rounded-tl-sm'
          : 'ml-auto border-[var(--ps-pink)]/50 bg-[var(--ps-pink)]/20 rounded-tr-sm'
      }`}
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={msg.attachmentUrl} alt="" className="max-h-40 w-full object-cover" />
      ) : isAudio ? (
        <div className="px-2.5 py-2">
          <div className="mb-1.5 text-[9px] text-[var(--ps-dim)]">🎤 Voice message</div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls preload="metadata" className="h-8 w-full max-w-[220px]">
            <source src={msg.attachmentUrl} />
          </audio>
        </div>
      ) : (
        <a
          href={msg.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-2.5 py-2 text-[var(--ps-cyan)] underline"
        >
          📎 {msg.fileName ?? 'Download file'}
        </a>
      )}
      {msg.text && !isAudio && <div className="px-2.5 py-1.5">{msg.text}</div>}
      <div className="px-2.5 pb-1.5 text-right text-[9px] text-[var(--ps-dim)]">{msg.time}</div>
    </div>
  );
}

function BizCardBubble({ msg }: { msg: Extract<ThreadMessage, { kind: 'bizcard' }> }) {
  return (
    <div
      className={`max-w-[92%] ${msg.side === 'out' ? 'ml-auto' : ''}`}
    >
      <BusinessCardFlipView card={msg.card} variant="shared" compact />
      <div className="mt-1 text-right text-[9px] text-[var(--ps-dim)]">{msg.time}</div>
    </div>
  );
}

type Props = {
  messages: ThreadMessage[];
  children?: React.ReactNode;
};

export function MessageThread({ messages, children }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2.5">
      <div className="mb-1 self-center rounded-lg bg-[var(--ps-surf)] px-2 py-0.5 text-[9px] text-[var(--ps-dim)]">
        Today
      </div>
      {messages.map((m) => {
        if (m.kind === 'state') return <StateEventCard key={m.id} msg={m} />;
        if (m.kind === 'attachment') return <AttachmentBubble key={m.id} msg={m} />;
        if (m.kind === 'bizcard') return <BizCardBubble key={m.id} msg={m} />;
        return (
          <div
            key={m.id}
            className={`max-w-[70%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed text-[var(--ps-white)] ${
              m.side === 'in'
                ? 'border border-[var(--ps-brd)] bg-[var(--ps-card)] rounded-tl-sm'
                : 'ml-auto border border-[#6B1A8A] bg-[#4A1070] rounded-tr-sm'
            }`}
          >
            {m.text}
            {m.attachmentUrl && (
              <a
                href={m.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-[var(--ps-cyan)] underline"
              >
                📎 Attachment
              </a>
            )}
            <div className="mt-0.5 text-right text-[9px] text-[var(--ps-dim)]">{m.time}</div>
          </div>
        );
      })}
      {children}
    </div>
  );
}
