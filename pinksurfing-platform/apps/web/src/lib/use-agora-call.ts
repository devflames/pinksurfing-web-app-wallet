'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, ILocalTrack, IRemoteAudioTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';
import { agoraUidFromUserId, endCall, fetchRtcToken, initiateCall, buildDemoChannel } from './calls-api';
import type { ActiveCall, CallMode } from './types/call';

type JoinInput = {
  token: string;
  userId: string;
  peerUserId: string;
  peerName: string;
  mode: CallMode;
  chatType: 'personal' | 'business';
};

const DEMO_CALLS = process.env.NEXT_PUBLIC_CALLS_DEMO === 'true';
const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID?.trim() || '';

export function useAgoraCall() {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoRef = useRef<ICameraVideoTrack | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [pendingCall, setPendingCall] = useState<Omit<ActiveCall, 'channel'> | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<number[]>([]);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const localVideoRefEl = useRef<HTMLDivElement | null>(null);

  const cleanup = useCallback(async () => {
    localAudioRef.current?.stop();
    localAudioRef.current?.close();
    localVideoRef.current?.stop();
    localVideoRef.current?.close();
    localAudioRef.current = null;
    localVideoRef.current = null;
    if (clientRef.current) {
      await clientRef.current.leave().catch(() => undefined);
      clientRef.current.removeAllListeners();
      clientRef.current = null;
    }
    setRemoteUsers([]);
    setMuted(false);
  }, []);

  const hangUp = useCallback(
    async (authToken: string | null) => {
      const channel = activeCall?.channel;
      await cleanup();
      setActiveCall(null);
      setPendingCall(null);
      setStatus('idle');
      setError(null);
      if (authToken && channel && !DEMO_CALLS) {
        await endCall(authToken, channel).catch(() => undefined);
      }
    },
    [activeCall?.channel, cleanup]
  );

  const joinCall = useCallback(
    async (input: JoinInput) => {
      if (!APP_ID) {
        setError('Set NEXT_PUBLIC_AGORA_APP_ID in apps/web/.env.local');
        setStatus('error');
        return;
      }

      setStatus('connecting');
      setError(null);
      setPendingCall({
        mode: input.mode,
        peerName: input.peerName,
        peerUserId: input.peerUserId,
        chatType: input.chatType,
      });

      try {
        let channel: string;
        try {
          channel = await initiateCall(input.token, {
            from: input.userId,
            to: input.peerUserId,
            mode: input.mode,
            chatType: input.chatType,
            message: `${input.mode} call from web`,
          });
        } catch (e) {
          if (!DEMO_CALLS) throw e;
          channel = buildDemoChannel(input.userId, input.peerUserId);
        }

        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        const uid = agoraUidFromUserId(input.userId);
        const rtcToken = await fetchRtcToken(channel, uid);

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;

        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === 'audio') {
            (user.audioTrack as IRemoteAudioTrack)?.play();
          }
          if (mediaType === 'video' && remoteVideoRef.current && user.videoTrack) {
            user.videoTrack.play(remoteVideoRef.current);
          }
          setRemoteUsers((prev) => (prev.includes(user.uid as number) ? prev : [...prev, user.uid as number]));
        });

        client.on('user-unpublished', (user) => {
          setRemoteUsers((prev) => prev.filter((id) => id !== user.uid));
        });

        await client.join(APP_ID, channel, rtcToken, uid);

        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localAudioRef.current = audioTrack;

        const tracks: ILocalTrack[] = [audioTrack];
        if (input.mode === 'video') {
          const videoTrack = await AgoraRTC.createCameraVideoTrack();
          localVideoRef.current = videoTrack;
          tracks.push(videoTrack);
          if (localVideoRefEl.current) {
            videoTrack.play(localVideoRefEl.current);
          }
        }

        await client.publish(tracks);

        setActiveCall({
          channel,
          mode: input.mode,
          peerName: input.peerName,
          peerUserId: input.peerUserId,
          chatType: input.chatType,
        });
        setPendingCall(null);
        setStatus('live');
      } catch (e) {
        await cleanup();
        setActiveCall(null);
        setPendingCall(null);
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Call failed');
      }
    },
    [cleanup]
  );

  const toggleMute = useCallback(async () => {
    const track = localAudioRef.current;
    if (!track) return;
    const next = !muted;
    await track.setEnabled(!next);
    setMuted(next);
  }, [muted]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    activeCall,
    pendingCall,
    status,
    error,
    muted,
    remoteUsers,
    remoteVideoRef,
    localVideoRefEl,
    joinCall,
    hangUp,
    toggleMute,
  };
}
