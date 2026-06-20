/** Live voice/video calls use Agora RTC — see use-agora-call.ts */
export function isAgoraConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_AGORA_APP_ID?.trim();
}
