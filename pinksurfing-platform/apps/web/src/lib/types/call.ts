export type CallMode = 'voice' | 'video';

export type ActiveCall = {
  channel: string;
  mode: CallMode;
  peerName: string;
  peerUserId: string;
  chatType: 'personal' | 'business';
  isGroup?: boolean;
  groupId?: string;
  groupName?: string;
};

export type IncomingCall = {
  channel: string;
  from: string;
  to: string;
  mode: CallMode;
  callerName: string;
  chatType: 'personal' | 'business';
  isGroup: boolean;
  groupId?: string;
  groupName?: string;
  notificationType?: string;
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

export type CallRecord = {
  channel?: string;
  from?: string;
  to?: string;
  maker_name?: string;
  maker_virtual_id?: string;
  call_mode?: string;
  group_id?: string;
  group_name?: string;
  type?: string;
  call_status?: string;
  chatType?: string;
};

export type CallStatusResponse = {
  status?: string;
  data?: CallRecord[];
  callStatus?: boolean;
};
