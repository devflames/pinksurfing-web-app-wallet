'use client';

import type { ThreadMessage } from '@/lib/types/chat';
import { BusinessCardFlipView } from '@/components/cards/BusinessCardFlipView';

function isAudioAttachment(url: string, fileName?: string): boolean {
  const probe = `${fileName ?? ''} ${url}`;
  return /\.(webm|mp3|m4a|ogg|wav)(\?|$)/i.test(probe) || /voice-/i.test(fileName ?? '');
}

export function ThinkingCloud({ time }: { time?: string }) {
  return (
    <div className="flex items-end gap-2">
      <div className="ps-think-cloud relative px-4 py-2.5">
        <span className="ps-think-dot" style={{ animationDelay: '0ms' }} />
        <span className="ps-think-dot" style={{ animationDelay: '160ms' }} />
        <span className="ps-think-dot" style={{ animationDelay: '320ms' }} />
        <span className="ps-think-tail" aria-hidden />
      </div>
      {time && <span className="pb-1 text-[8px] text-[var(--ps-dim)]">{time}</span>}
    </div>
  );
}

export function SeenDivider({ label }: { label: string }) {
  return (
    <div className="my-2 flex justify-center">
      <span className="ps-neu-seen rounded-full px-3 py-0.5 text-[8px] text-[var(--ps-dim)]">
        {label}
      </span>
    </div>
  );
}

export function TextBubble({ msg }: { msg: Extract<ThreadMessage, { kind: 'text' }> }) {
  const outgoing = msg.side === 'out';
  return (
    <div className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`ps-neu-bubble max-w-[78%] px-3 py-2 text-[11px] leading-relaxed text-[var(--ps-white)] ${
          outgoing
            ? 'ps-neu-bubble-out rounded-2xl rounded-br-sm'
            : 'ps-neu-bubble-in rounded-2xl rounded-bl-sm'
        }`}
      >
        {msg.text}
        <div
          className={`mt-1 text-[8px] ${outgoing ? 'text-[var(--ps-cyan)]/80' : 'text-[var(--ps-dim)]'} text-right`}
        >
          {msg.time}
        </div>
      </div>
    </div>
  );
}

function VoiceBubble({ msg }: { msg: Extract<ThreadMessage, { kind: 'attachment' }> }) {
  const outgoing = msg.side === 'out';
  return (
    <div className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`ps-neu-bubble max-w-[78%] px-3 py-2.5 ${
          outgoing
            ? 'ps-neu-bubble-out rounded-2xl rounded-br-sm'
            : 'ps-neu-bubble-in rounded-2xl rounded-bl-sm'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="ps-neu-voice-play flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--ps-pink)]">
            🎤
          </span>
          <div className="min-w-0 flex-1">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls preload="metadata" className="h-7 w-full max-w-[200px]">
              <source src={msg.attachmentUrl} />
            </audio>
          </div>
        </div>
        <div
          className={`mt-1 text-[8px] text-right ${outgoing ? 'text-[var(--ps-cyan)]/80' : 'text-[var(--ps-dim)]'}`}
        >
          {msg.time}
        </div>
      </div>
    </div>
  );
}

function DocumentBubble({ msg }: { msg: Extract<ThreadMessage, { kind: 'attachment' }> }) {
  const outgoing = msg.side === 'out';
  const name = msg.fileName ?? 'Document';
  return (
    <div className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
      <a
        href={msg.attachmentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`ps-neu-bubble flex max-w-[78%] items-center gap-2.5 px-3 py-2.5 no-underline ${
          outgoing
            ? 'ps-neu-bubble-out rounded-2xl rounded-br-sm'
            : 'ps-neu-bubble-in rounded-2xl rounded-bl-sm'
        }`}
      >
        <span className="ps-neu-doc-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-[var(--ps-pink)]">
          ↓
        </span>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium text-[var(--ps-white)]">{name}</div>
          <div className="text-[8px] text-[var(--ps-dim)]">Tap to download</div>
        </div>
      </a>
    </div>
  );
}

function AttachmentBubble({ msg }: { msg: Extract<ThreadMessage, { kind: 'attachment' }> }) {
  const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(msg.attachmentUrl);
  const isAudio = isAudioAttachment(msg.attachmentUrl, msg.fileName);
  if (isAudio) return <VoiceBubble msg={msg} />;
  if (!isImage) return <DocumentBubble msg={msg} />;
  const outgoing = msg.side === 'out';
  return (
    <div className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`ps-neu-bubble max-w-[78%] overflow-hidden ${
          outgoing
            ? 'ps-neu-bubble-out rounded-2xl rounded-br-sm'
            : 'ps-neu-bubble-in rounded-2xl rounded-bl-sm'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={msg.attachmentUrl} alt="" className="max-h-40 w-full object-cover" />
        <div className="px-3 pb-1.5 text-right text-[8px] text-[var(--ps-dim)]">{msg.time}</div>
      </div>
    </div>
  );
}

export function StateEventCard({ msg }: { msg: Extract<ThreadMessage, { kind: 'state' }> }) {
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

function BizCardBubble({ msg }: { msg: Extract<ThreadMessage, { kind: 'bizcard' }> }) {
  return (
    <div className={`max-w-[92%] ${msg.side === 'out' ? 'ml-auto' : ''}`}>
      <BusinessCardFlipView card={msg.card} variant="shared" compact />
      <div className="mt-1 text-right text-[9px] text-[var(--ps-dim)]">{msg.time}</div>
    </div>
  );
}

export function ChatMessageBubble({ msg }: { msg: ThreadMessage }) {
  if (msg.kind === 'state') return <StateEventCard msg={msg} />;
  if (msg.kind === 'attachment') return <AttachmentBubble msg={msg} />;
  if (msg.kind === 'bizcard') return <BizCardBubble msg={msg} />;
  return <TextBubble msg={msg} />;
}
