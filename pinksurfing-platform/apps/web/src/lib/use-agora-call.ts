'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, ILocalTrack, IRemoteAudioTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';
import {
  acceptCall,
  agoraUidFromUserId,
  endCall,
  fetchRtcToken,
  initiateCall,
  rejectCall,
  buildDemoChannel,
} from './calls-api';
import type { ActiveCall, CallMode } from './types/call';

type OutgoingInput = {
  token: string;
  userId: string;
  peerUserId: string;
  peerName: string;
  mode: CallMode;
  chatType: 'personal' | 'business';
  groupId?: string;
  groupName?: string;
  isGroup?: boolean;
};

type AnswerInput = {
  token: string;
  userId: string;
  channel: string;
  peerUserId: string;
  peerName: string;
  mode: CallMode;
  chatType: 'personal' | 'business';
  isGroup?: boolean;
  groupId?: string;
  groupName?: string;
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
      const groupId = activeCall?.groupId ?? '0';
      await cleanup();
      setActiveCall(null);
      setPendingCall(null);
      setStatus('idle');
      setError(null);
      if (authToken && channel && !DEMO_CALLS) {
        await endCall(authToken, channel, groupId).catch(() => undefined);
      }
    },
    [activeCall?.channel, activeCall?.groupId, cleanup]
  );

  const connectToChannel = useCallback(
    async (input: {
      token: string;
      userId: string;
      channel: string;
      mode: CallMode;
      peerName: string;
      peerUserId: string;
      chatType: 'personal' | 'business';
      isGroup?: boolean;
      groupId?: string;
      groupName?: string;
    }) => {
      if (!APP_ID) {
        setError('Set NEXT_PUBLIC_AGORA_APP_ID in apps/web/.env.local');
        setStatus('error');
        return;
      }

      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      const uid = agoraUidFromUserId(input.userId);
      const rtcToken = await fetchRtcToken(input.channel, uid);

      const client = AgoraRTC.createClient({
        mode: input.isGroup ? 'live' : 'rtc',
        codec: 'vp8',
      });
      clientRef.current = client;

      if (input.isGroup) {
        await client.setClientRole('host');
      }

      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          (user.audioTrack as IRemoteAudioTrack)?.play();
        }
        if (mediaType === 'video' && remoteVideoRef.current && user.videoTrack) {
          user.videoTrack.play(remoteVideoRef.current);
        }
        setRemoteUsers((prev) =>
          prev.includes(user.uid as number) ? prev : [...prev, user.uid as number]
        );
      });

      client.on('user-unpublished', (user) => {
        setRemoteUsers((prev) => prev.filter((id) => id !== user.uid));
      });

      await client.join(APP_ID, input.channel, rtcToken, uid);

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
        channel: input.channel,
        mode: input.mode,
        peerName: input.peerName,
        peerUserId: input.peerUserId,
        chatType: input.chatType,
        isGroup: input.isGroup,
        groupId: input.groupId,
        groupName: input.groupName,
      });
      setPendingCall(null);
      setStatus('live');
    },
    []
  );

  const startOutgoingCall = useCallback(
    async (input: OutgoingInput) => {
      setStatus('connecting');
      setError(null);
      setPendingCall({
        mode: input.mode,
        peerName: input.peerName,
        peerUserId: input.peerUserId,
        chatType: input.chatType,
        isGroup: input.isGroup,
        groupId: input.groupId,
        groupName: input.groupName,
      });

      try {
        let channel: string;
        try {
          channel = await initiateCall(input.token, {
            from: input.userId,
            to: input.peerUserId,
            mode: input.mode,
            chatType: input.chatType,
            groupId: input.groupId,
            groupName: input.groupName,
          });
        } catch (e) {
          if (!DEMO_CALLS) throw e;
          channel = buildDemoChannel(input.userId, input.peerUserId);
        }

        await connectToChannel({
          token: input.token,
          userId: input.userId,
          channel,
          mode: input.mode,
          peerName: input.peerName,
          peerUserId: input.peerUserId,
          chatType: input.chatType,
          isGroup: input.isGroup,
          groupId: input.groupId,
          groupName: input.groupName,
        });
      } catch (e) {
        await cleanup();
        setActiveCall(null);
        setPendingCall(null);
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Call failed');
      }
    },
    [cleanup, connectToChannel]
  );

  const answerIncomingCall = useCallback(
    async (input: AnswerInput) => {
      setStatus('connecting');
      setError(null);
      setPendingCall({
        mode: input.mode,
        peerName: input.peerName,
        peerUserId: input.peerUserId,
        chatType: input.chatType,
        isGroup: input.isGroup,
        groupId: input.groupId,
        groupName: input.groupName,
      });

      try {
        if (!DEMO_CALLS) {
          await acceptCall(input.token, input.channel);
        }
        await connectToChannel({
          token: input.token,
          userId: input.userId,
          channel: input.channel,
          mode: input.mode,
          peerName: input.peerName,
          peerUserId: input.peerUserId,
          chatType: input.chatType,
          isGroup: input.isGroup,
          groupId: input.groupId,
          groupName: input.groupName,
        });
      } catch (e) {
        await cleanup();
        setActiveCall(null);
        setPendingCall(null);
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Could not join call');
      }
    },
    [cleanup, connectToChannel]
  );

  const declineIncomingCall = useCallback(async (token: string, channel: string, groupId = '0') => {
    if (!DEMO_CALLS) {
      await rejectCall(token, channel, groupId).catch(() => undefined);
    }
  }, []);

  const joinCall = useCallback(
    async (input: OutgoingInput) => {
      await startOutgoingCall(input);
    },
    [startOutgoingCall]
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
    startOutgoingCall,
    answerIncomingCall,
    declineIncomingCall,
    hangUp,
    toggleMute,
  };
}
