'use client';

import { useCallback, useRef, useState } from 'react';

export type AudioRecorderState = 'idle' | 'recording' | 'unsupported';

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return types.find((t) => MediaRecorder.isTypeSupported(t));
}

export function isAudioRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined' &&
    !!pickMimeType()
  );
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeRef = useRef<string>('audio/webm');

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const mime = pickMimeType();
    if (!mime) {
      setState('unsupported');
      setError('Audio recording is not supported in this browser.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      mimeRef.current = mime;

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(250);
      recorderRef.current = recorder;
      setSeconds(0);
      setState('recording');
      clearTimer();
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      return true;
    } catch {
      setError('Microphone access denied. Allow mic permission to send voice messages.');
      setState('idle');
      return false;
    }
  }, [clearTimer]);

  const stop = useCallback(async (): Promise<File | null> => {
    const recorder = recorderRef.current;
    if (!recorder || state !== 'recording') return null;

    clearTimer();
    setState('idle');

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        releaseStream();
        recorderRef.current = null;
        chunksRef.current = [];

        if (blob.size < 1) {
          setError('Recording too short.');
          resolve(null);
          return;
        }

        const ext = mimeRef.current.includes('mp4') ? 'm4a' : mimeRef.current.includes('ogg') ? 'ogg' : 'webm';
        resolve(
          new File([blob], `voice-${Date.now()}.${ext}`, {
            type: mimeRef.current,
          })
        );
      };
      recorder.stop();
    });
  }, [state, clearTimer, releaseStream]);

  const cancel = useCallback(() => {
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        releaseStream();
        recorderRef.current = null;
        chunksRef.current = [];
      };
      recorder.stop();
    } else {
      releaseStream();
    }
    setState('idle');
    setSeconds(0);
  }, [clearTimer, releaseStream]);

  return { state, seconds, error, start, stop, cancel };
}
