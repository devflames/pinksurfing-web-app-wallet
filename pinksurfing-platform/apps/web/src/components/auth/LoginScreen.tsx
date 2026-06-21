'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { isGoogleAuthEnabled, isLocalAuthMode } from '@/lib/auth-config';

export function LoginScreen() {
  const localMode = isLocalAuthMode();
  const googleEnabled = isGoogleAuthEnabled();
  const { login, loginDev, loginWithGoogle, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [devBusy, setDevBusy] = useState(false);
  const [showProduction, setShowProduction] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (authError) {
      setUrlError(authError);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const displayError = error || urlError;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setUrlError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch {
      // error shown via context
    } finally {
      setBusy(false);
    }
  };

  const onLocal = async () => {
    clearError();
    setUrlError(null);
    setDevBusy(true);
    try {
      await loginDev();
    } catch {
      // error shown via context
    } finally {
      setDevBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <div className="mb-5 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ps-gradient-border bg-[var(--ps-surf)] text-xl font-bold text-[var(--ps-primary)]">
          P
        </div>
        <h1 className="text-[22px] font-semibold text-[var(--ps-white)]">PinkSurfing</h1>
        <p className="mt-1 text-[11px] text-[var(--ps-muted)]">
          {localMode ? 'Local Raihan stack (your branch changes)' : 'Sign in with production account'}
        </p>
      </div>

      {displayError && (
        <p className="mb-3 rounded-md border border-[var(--ps-red)]/40 bg-[var(--ps-red)]/10 px-2 py-1.5 text-[10px] text-[var(--ps-red)]">
          {displayError}
        </p>
      )}

      {localMode ? (
        <>
          <button
            type="button"
            onClick={onLocal}
            disabled={devBusy || loading}
            className="ps-btn-primary w-full py-2.5 text-xs font-semibold disabled:opacity-60"
          >
            {devBusy ? 'Connecting…' : 'Continue with local stack'}
          </button>

          <p className="mt-4 text-center text-[9px] leading-relaxed text-[var(--ps-dim)]">
            Uses your local code: gateway :8080 → smoke Raihan :6003 / :6161.
            Not the live server — deploy when ready, then set{' '}
            <code className="text-[var(--ps-muted)]">NEXT_PUBLIC_AUTH_MODE=production</code>.
          </p>

          <p className="mt-2 text-center text-[9px] text-[var(--ps-dim)]">
            Start:{' '}
            <code className="text-[var(--ps-muted)]">scripts/start-smoke-services.ps1</code>
          </p>

          {!showProduction ? (
            <button
              type="button"
              onClick={() => setShowProduction(true)}
              className="mt-4 w-full text-[9px] text-[var(--ps-dim)] underline"
            >
              Production login (email / Google)
            </button>
          ) : (
            <>
              <p className="mt-3 text-[9px] text-[var(--ps-amber)]">
                Set <code>NEXT_PUBLIC_AUTH_MODE=production</code> in .env.local and restart
                Next.js to enable production SSO.
              </p>
              <ProductionLoginForm
                email={email}
                password={password}
                busy={busy}
                loading={loading}
                googleEnabled={googleEnabled}
                onGoogle={loginWithGoogle}
                onEmail={setEmail}
                onPassword={setPassword}
                onSubmit={onSubmit}
              />
            </>
          )}
        </>
      ) : (
        <ProductionLoginForm
          email={email}
          password={password}
          busy={busy}
          loading={loading}
          googleEnabled={googleEnabled}
          onGoogle={loginWithGoogle}
          onEmail={setEmail}
          onPassword={setPassword}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}

function ProductionLoginForm({
  email,
  password,
  busy,
  loading,
  googleEnabled,
  onGoogle,
  onEmail,
  onPassword,
  onSubmit,
}: {
  email: string;
  password: string;
  busy: boolean;
  loading: boolean;
  googleEnabled: boolean;
  onGoogle: () => void;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="mt-3 space-y-3 border-t border-[var(--ps-brd)] pt-4">
      {googleEnabled && (
        <>
          <button
            type="button"
            onClick={onGoogle}
            disabled={busy || loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--ps-brd2)] bg-[var(--ps-card)] py-2.5 text-xs font-medium text-[var(--ps-white)] disabled:opacity-60"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-[var(--ps-brd)]" />
            <span className="text-[9px] text-[var(--ps-dim)]">or email</span>
            <div className="h-px flex-1 bg-[var(--ps-brd)]" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Email</label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            className="w-full rounded-[10px] border border-[var(--ps-brd)] bg-white/5 px-3 py-2 text-[12px] text-[var(--ps-white)] outline-none focus:border-[var(--ps-primary)]/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            className="w-full rounded-[10px] border border-[var(--ps-brd)] bg-white/5 px-3 py-2 text-[12px] text-[var(--ps-white)] outline-none focus:border-[var(--ps-primary)]/50"
          />
        </div>
        <button
          type="submit"
          disabled={busy || loading}
          className="ps-btn-primary w-full py-2.5 text-xs font-semibold disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in with email'}
        </button>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
