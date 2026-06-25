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
import { publishStateEvent } from './state-message-service';
import type { StateEventType } from './state-message-types';
import { isDemoPeerUserId, isLiveChatPeerUserId } from './live-chat-peer';
import type { ThreadMessage } from './types/chat';

export type AppendStateMeta = {
  eventType?: StateEventType;
  refId?: string;
  state?: string;
};

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
  const peerOk = isLiveChatPeerUserId(peerUserId);
  const live = isChatLive() && !!token && !!userId && !!peerUserId && peerOk;
  const local = useChatSession(contact.id, fallbackPreview);

  const [apiMessages, setApiMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const reload = useCallback(async () => {
    if (!isChatLive() || !token || !userId || !peerUserId) return;
    if (isDemoPeerUserId(peerUserId)) {
      setError(null);
      setApiMessages([]);
      return;
    }
    if (!peerOk) {
      setError('Add a real contact via QR or business card to use live chat.');
      setApiMessages([]);
      return;
    }
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
  }, [token, userId, peerUserId, peerOk, contact]);

  useEffect(() => {
    reload();
  }, [reload]);

  const messages = useMemo(() => {
    if (!live) return local.messages;
    return apiMessages;
  }, [live, apiMessages, local.messages]);

  const preview = useMemo(() => {
    if (!live) return local.preview;
    const last = [...apiMessages]
      .reverse()
      .find((m) => m.kind === 'text' || m.kind === 'attachment' || m.kind === 'state');
    if (!last) return local.preview;
    if (last.kind === 'state') {
      return { preview: last.label, time: last.time };
    }
    if (last.kind === 'attachment') {
      const audio = /\.(webm|mp3|m4a|ogg|wav)(\?|$)/i.test(last.attachmentUrl);
      return {
        preview: last.text ?? (audio ? '🎤 Voice message' : '📎 Attachment'),
        time: last.time,
      };
    }
    return { preview: last.text, time: last.time };
  }, [live, apiMessages, local.preview]);

  const appendState = useCallback(
    async (
      label: string,
      accent: string,
      contractTitle?: string,
      meta?: AppendStateMeta
    ) => {
      if (live && token && userId && peerUserId) {
        setError(null);
        try {
          await publishStateEvent({
            token,
            fromUserId: userId,
            toUserId: peerUserId,
            contactId: contact.id,
            chatType: chatTypeForContact(contact),
            label,
            accent,
            contractTitle,
            eventType: meta?.eventType ?? 'CONTRACT_STATE',
            refId: meta?.refId,
            state: meta?.state,
          });
          await reload();
          return;
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to publish state event');
        }
      }
      local.appendState(label, accent, contractTitle);
    },
    [live, token, userId, peerUserId, contact, local, reload]
  );

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
    appendState,
    appendSystem: local.appendSystem,
    reload,
  };
}
