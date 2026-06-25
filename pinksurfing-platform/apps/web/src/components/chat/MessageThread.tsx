'use client';

import type { ThreadMessage } from '@/lib/types/chat';
import { ChatMessageBubble } from '@/components/chat/ChatBubbles';

type Props = {
  messages: ThreadMessage[];
  children?: React.ReactNode;
  /** Neomorphic bubbles (Shaiquel business chat style) */
  variant?: 'classic' | 'neu';
};

export function MessageThread({ messages, children, variant = 'classic' }: Props) {
  const neu = variant === 'neu';

  return (
    <div
      className={`flex flex-1 flex-col gap-1 overflow-y-auto p-2.5 ${neu ? 'ps-chat-thread' : ''}`}
    >
      <div className="mb-1 self-center rounded-lg bg-[var(--ps-surf)] px-2 py-0.5 text-[9px] text-[var(--ps-dim)]">
        Today
      </div>
      {messages.map((m) =>
        neu ? (
          <ChatMessageBubble key={m.id} msg={m} />
        ) : m.kind === 'state' ? (
          <ChatMessageBubble key={m.id} msg={m} />
        ) : m.kind === 'attachment' ? (
          <ClassicAttachment key={m.id} msg={m} />
        ) : m.kind === 'bizcard' ? (
          <ChatMessageBubble key={m.id} msg={m} />
        ) : (
          <ClassicText key={m.id} msg={m} />
        )
      )}
      {children}
    </div>
  );
}

function ClassicText({ msg }: { msg: Extract<ThreadMessage, { kind: 'text' }> }) {
  return (
    <div
      className={`max-w-[70%] rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed text-[var(--ps-white)] ${
        msg.side === 'in'
          ? 'border border-[var(--ps-brd)] bg-[var(--ps-card)] rounded-tl-sm'
          : 'ml-auto border border-[#6B1A8A] bg-[#4A1070] rounded-tr-sm'
      }`}
    >
      {msg.text}
      {msg.attachmentUrl && (
        <a
          href={msg.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-[var(--ps-cyan)] underline"
        >
          📎 Attachment
        </a>
      )}
      <div className="mt-0.5 text-right text-[9px] text-[var(--ps-dim)]">{msg.time}</div>
    </div>
  );
}

function ClassicAttachment({ msg }: { msg: Extract<ThreadMessage, { kind: 'attachment' }> }) {
  const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(msg.attachmentUrl);
  const isAudio = /\.(webm|mp3|m4a|ogg|wav)(\?|$)/i.test(`${msg.fileName ?? ''} ${msg.attachmentUrl}`);
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
