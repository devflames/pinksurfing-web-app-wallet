export type CallMode = 'voice' | 'video';

export type ActiveCall = {
  channel: string;
  mode: CallMode;
  peerName: string;
  peerUserId: string;
  chatType: 'personal' | 'business';
};

export type RtcTokenResponse = {
  rtcToken?: string;
  error?: string;
};

export type CallInitiateResponse = {
  status?: boolean | string;
  message?: string;
  data?: { channel?: string };
};
