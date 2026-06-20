'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Contact } from '@pinksurfing/ui';
import {
  chatTypeForContact,
  fetchOneToOneMessages,
  isChatLive,
  sendChatMessage,
  uploadChatAttachment,
} from './chat-api';
import { useChatSession } from './use-chat-session';
import { getChatSession } from './chat-session';
import type { ThreadMessage } from './types/chat';

type Options = {
  token: string | null;
  userId: string | null;
  contact: Contact;
  peerUserId: string | null;
  fallbackPreview: string;
};

export function useLiveChat({
  token,
  userId,
  contact,
  peerUserId,
  fallbackPreview,
}: Options) {
  const live = isChatLive() && !!token && !!userId && !!peerUserId;
  const local = useChatSession(contact.id, fallbackPreview);

  const [apiMessages, setApiMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const reload = useCallback(async () => {
    if (!live || !token || !userId || !peerUserId) return;
    setLoading(true);
    setError(null);
    try {
      const chatType = chatTypeForContact(contact);
      const msgs = await fetchOneToOneMessages(token, userId, peerUserId, chatType);
      setApiMessages(msgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [live, token, userId, peerUserId, contact]);

  useEffect(() => {
    reload();
  }, [reload]);

  const messages = useMemo(() => {
    if (!live) return local.messages;
    const stateEvents = local.messages.filter((m) => m.kind === 'state');
    return [...apiMessages, ...stateEvents].sort((a, b) => {
      // state events stay at end-ish; api messages already sorted
      if (a.kind === 'state' && b.kind !== 'state') return 1;
      if (b.kind === 'state' && a.kind !== 'state') return -1;
      return 0;
    });
  }, [live, apiMessages, local.messages]);

  const preview = useMemo(() => {
    if (!live) return local.preview;
    const last = [...apiMessages].reverse().find((m) => m.kind === 'text' || m.kind === 'attachment');
    if (!last) return local.preview;
    if (last.kind === 'attachment') {
      const audio = /\.(webm|mp3|m4a|ogg|wav)(\?|$)/i.test(last.attachmentUrl);
      return {
        preview: last.text ?? (audio ? '🎤 Voice message' : '📎 Attachment'),
        time: last.time,
      };
    }
    return { preview: last.text, time: last.time };
  }, [live, apiMessages, local.preview]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!live || !token || !userId || !peerUserId) {
        local.send(trimmed);
        return;
      }
      setError(null);
      try {
        await sendChatMessage(token, userId, peerUserId, chatTypeForContact(contact), {
          text: trimmed,
        });
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Send failed');
      }
    },
    [live, token, userId, peerUserId, contact, local, reload]
  );

  const sendAttachment = useCallback(
    async (file: File, caption?: string) => {
      const isAudio = file.type.startsWith('audio/');
      if (!live || !token || !userId || !peerUserId) {
        if (isAudio || file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          getChatSession().sendAttachment(contact.id, url, file.name, caption);
        } else {
          local.send(`📎 ${file.name} (demo — enable NEXT_PUBLIC_CHAT_LIVE for upload)`);
        }
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const url = await uploadChatAttachment(token, file);
        await sendChatMessage(token, userId, peerUserId, chatTypeForContact(contact), {
          attachmentUrl: url,
          text: caption ?? (isAudio ? '🎤 Voice message' : undefined),
        });
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [live, token, userId, peerUserId, contact, local, reload]
  );

  return {
    live,
    messages,
    preview,
    loading,
    uploading,
    error,
    send,
    sendAttachment,
    appendState: local.appendState,
    appendSystem: local.appendSystem,
    reload,
  };
}
