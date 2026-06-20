/** Local Raihan stack (default) vs production SSO — flip when live server is updated */
export function isLocalAuthMode(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE !== 'production';
}

/** Show “Continue with Google” in production auth mode (opt out with NEXT_PUBLIC_GOOGLE_AUTH=false) */
export function isGoogleAuthEnabled(): boolean {
  return !isLocalAuthMode() && process.env.NEXT_PUBLIC_GOOGLE_AUTH !== 'false';
}
