'use client';

import { useRef, useState } from 'react';
import { isAudioRecordingSupported, useAudioRecorder } from '@/lib/use-audio-recorder';

type Props = {
  placeholder?: string;
  showMic?: boolean;
  disabled?: boolean;
  uploading?: boolean;
  onSend: (text: string) => void;
  onAttach?: (file: File) => void;
};

function formatRecTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ChatInput({
  placeholder = 'Message...',
  showMic,
  disabled,
  uploading,
  onSend,
  onAttach,
}: Props) {
  const [draft, setDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const recorder = useAudioRecorder();
  const canRecord = showMic && isAudioRecordingSupported() && !!onAttach;

  const submit = () => {
    if (!draft.trim() || disabled || uploading || recorder.state === 'recording') return;
    onSend(draft);
    setDraft('');
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAttach) onAttach(file);
    e.target.value = '';
  };

  const toggleRecording = async () => {
    if (!canRecord || disabled || uploading) return;

    if (recorder.state === 'recording') {
      const file = await recorder.stop();
      if (file) onAttach(file);
      return;
    }

    await recorder.start();
  };

  const recording = recorder.state === 'recording';

  return (
    <div className="flex shrink-0 flex-col ps-neu-input-bar">
      {recording && (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--ps-pink)]/30 bg-[var(--ps-pink)]/10 px-3 py-1.5">
          <span className="flex items-center gap-2 text-[10px] text-[var(--ps-pink)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--ps-pink)]" />
            Recording {formatRecTime(recorder.seconds)}
          </span>
          <button
            type="button"
            onClick={() => recorder.cancel()}
            className="text-[9px] text-[var(--ps-muted)] hover:text-[var(--ps-white)]"
          >
            Cancel
          </button>
        </div>
      )}
      {recorder.error && (
        <p className="border-b border-[var(--ps-brd)] px-3 py-1 text-[9px] text-[var(--ps-red)]">
          {recorder.error}
        </p>
      )}
      <div className="flex items-end gap-1.5 p-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={onFileChange}
          accept="image/*,.pdf,.doc,.docx,.txt,audio/*"
        />
        <button
          type="button"
          disabled={disabled || uploading || recording || !onAttach}
          onClick={() => fileRef.current?.click()}
          className="ps-neu-icon-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] text-[var(--ps-muted)] disabled:opacity-40"
          title="Attach file"
        >
          {uploading ? '…' : '📎'}
        </button>
        <textarea
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={recording ? 'Tap mic to send voice message…' : placeholder}
          disabled={disabled || uploading || recording}
          className="ps-neu-input-field max-h-20 min-h-[34px] flex-1 resize-none px-3 py-1.5 text-[11px] text-[var(--ps-white)] outline-none placeholder:text-[var(--ps-dim)] disabled:opacity-50"
        />
        {showMic && (
          <button
            type="button"
            disabled={disabled || uploading || !onAttach || recorder.state === 'unsupported'}
            onClick={() => void toggleRecording()}
            className={`ps-neu-icon-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] transition-colors disabled:opacity-40 ${
              recording ? 'text-[var(--ps-pink)] ring-1 ring-[var(--ps-pink)]/40' : 'text-[var(--ps-pink)]'
            }`}
            title={
              recording
                ? 'Tap to send voice message'
                : canRecord
                  ? 'Record voice message'
                  : 'Voice recording unavailable'
            }
          >
            🎤
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={disabled || uploading || recording}
          className="ps-neu-send-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm disabled:opacity-40"
          title="Send"
        >
          →
        </button>
      </div>
    </div>
  );
}
