'use client';

import { useEffect, useState } from 'react';
import type { ActiveCall } from '@/lib/types/call';

type Props = {
  call: ActiveCall;
  status: 'connecting' | 'live' | 'error';
  error: string | null;
  muted: boolean;
  remoteUsers: number[];
  remoteVideoRef: React.RefObject<HTMLDivElement | null>;
  localVideoRef: React.RefObject<HTMLDivElement | null>;
  onHangUp: () => void;
  onToggleMute: () => void;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function CallOverlay({
  call,
  status,
  error,
  muted,
  remoteUsers,
  remoteVideoRef,
  localVideoRef,
  onHangUp,
  onToggleMute,
}: Props) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (status !== 'live') {
      setSeconds(0);
      return;
    }
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  const isVideo = call.mode === 'video';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white">
      {isVideo && (
        <div className="relative flex-1 bg-[#0a0a0f]">
          <div ref={remoteVideoRef} className="absolute inset-0" />
          {!remoteUsers.length && status === 'live' && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50">
              Waiting for {call.peerName}…
            </div>
          )}
          <div
            ref={localVideoRef}
            className="absolute bottom-4 right-4 h-28 w-20 overflow-hidden rounded-lg border border-white/20 bg-black shadow-lg"
          />
        </div>
      )}

      <div className={`flex flex-col items-center ${isVideo ? 'py-6' : 'flex-1 justify-center py-12'}`}>
        {!isVideo && (
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--ps-card2)] text-2xl font-semibold text-[var(--ps-cyan)]">
            {call.peerName.slice(0, 2).toUpperCase()}
          </div>
        )}

        <p className="text-xs uppercase tracking-widest text-[var(--ps-cyan)]">
          {status === 'connecting' ? 'Connecting…' : isVideo ? 'Video call' : 'Voice call'}
        </p>
        <h2 className="mt-2 text-xl font-semibold">{call.peerName}</h2>
        <p className="mt-1 text-sm text-white/50">
          {status === 'live' ? formatDuration(seconds) : status === 'connecting' ? 'Joining channel…' : ''}
        </p>
        {error && <p className="mt-3 max-w-sm px-4 text-center text-xs text-red-400">{error}</p>}
        <p className="mt-2 max-w-md truncate px-4 text-[9px] text-white/30">{call.channel}</p>
      </div>

      <div className="flex items-center justify-center gap-6 pb-10">
        <button
          type="button"
          onClick={onToggleMute}
          disabled={status !== 'live'}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg disabled:opacity-40"
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🎤'}
        </button>
        <button
          type="button"
          onClick={onHangUp}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-2xl shadow-lg"
          title="End call"
        >
          📞
        </button>
      </div>
    </div>
  );
}
