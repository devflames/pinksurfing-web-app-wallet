'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  deriveWalletFromMnemonic,
  downloadRecoveryPhraseFile,
  encryptBackupBlob,
  isValidMnemonic,
} from '@/lib/wallet-crypto';
import {
  downloadEncryptedBackupFromDrive,
  pollWalletDriveToken,
  startWalletDriveOAuth,
  uploadEncryptedBackupToDrive,
} from '@/lib/wallet-drive-backup';
import { buildProfileRegisterAuth } from '@/lib/wallet-ed25519-auth';
import {
  createKeyVaultAuto,
  linkWalletToSso,
  registerWalletProfile,
} from '@/lib/wallet-api';
import { saveWalletIdentity } from '@/lib/wallet-identity-storage';
import { saveWalletSecrets, updateWalletSecrets } from '@/lib/wallet-secrets-storage';
import type { DerivedWallet } from '@/lib/wallet-crypto';

type Props = {
  onComplete: () => Promise<void> | void;
};

type Step = 'choose' | 'phrase' | 'confirm' | 'working' | 'backup' | 'restore';

export function WalletRestoreScreen({ onComplete }: Props) {
  const { token, user } = useAuth();
  const [step, setStep] = useState<Step>('restore');
  const [mnemonic, setMnemonic] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);

  const restoreFromDerived = async (derived: DerivedWallet) => {
    if (!token || !user?.email) throw new Error('Session expired');

    await saveWalletSecrets(user.email, derived);
    saveWalletIdentity(user.email, {
      chiaAddress: derived.chiaAddress,
      walletPk: derived.walletPk,
    });

    const profileBody = {
      chiaAddress: derived.chiaAddress,
      walletPk: derived.walletPk,
      displayName: user.firstName || user.email.split('@')[0],
      profileData: {
        signingPk: derived.signingPk,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
    const authHeaders = await buildProfileRegisterAuth(derived.signingSk, profileBody);
    try {
      await registerWalletProfile(profileBody, authHeaders);
    } catch {
      // Profile may already exist on re-login
    }

    await linkWalletToSso(token, {
      chiaAddress: derived.chiaAddress,
      walletPk: derived.walletPk,
    });

    await onComplete();
  };

  const onRestoreMnemonic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidMnemonic(mnemonic)) {
      setError('Enter a valid 12-word recovery phrase');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const derived = await deriveWalletFromMnemonic(mnemonic);
      await restoreFromDerived(derived);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore wallet');
    } finally {
      setBusy(false);
    }
  };

  const onRestoreDrive = async () => {
    setDriveBusy(true);
    setError(null);
    try {
      const { url, sessionId } = await startWalletDriveOAuth();
      window.open(url, 'pinksurfing-drive', 'width=520,height=720');
      const { accessToken } = await pollWalletDriveToken(sessionId);
      const encrypted = await downloadEncryptedBackupFromDrive(accessToken);
      if (!encrypted) {
        throw new Error('No backup found in Google Drive');
      }
      const phrase = window.prompt(
        'Enter your recovery phrase to decrypt the Drive backup:'
      );
      if (!phrase || !isValidMnemonic(phrase)) {
        throw new Error('Recovery phrase required to decrypt Drive backup');
      }
      const derived = await deriveWalletFromMnemonic(phrase);
      await restoreFromDerived(derived);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Drive restore failed');
    } finally {
      setDriveBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <h1 className="text-lg font-semibold text-[var(--ps-text)]">Restore your wallet</h1>
        <p className="mt-2 text-sm text-[var(--ps-muted)]">
          Your account is linked to a wallet, but keys are not on this device. Restore from your
          recovery phrase or Google Drive backup.
        </p>

        <form onSubmit={onRestoreMnemonic} className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--ps-muted)]">Recovery phrase</span>
            <textarea
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              rows={3}
              placeholder="twelve words separated by spaces"
              className="w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-bg)] px-3 py-2 text-sm text-[var(--ps-text)]"
            />
          </label>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[var(--ps-primary)] px-4 py-2.5 text-sm text-white disabled:opacity-50"
          >
            {busy ? 'Restoring…' : 'Restore from phrase'}
          </button>
        </form>

        <button
          type="button"
          disabled={driveBusy}
          onClick={() => void onRestoreDrive()}
          className="mt-3 w-full rounded-lg border border-[var(--ps-brd)] px-4 py-2.5 text-sm text-[var(--ps-text)]"
        >
          {driveBusy ? 'Connecting to Drive…' : 'Restore from Google Drive'}
        </button>
      </div>
    </div>
  );
}

export function WalletSetupScreen({ onComplete }: Props) {
  const { token, user } = useAuth();
  const [step, setStep] = useState<Step>('choose');
  const [mnemonic, setMnemonic] = useState('');
  const [derived, setDerived] = useState<DerivedWallet | null>(null);
  const [confirmWords, setConfirmWords] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launcherId, setLauncherId] = useState<string | undefined>();
  const [driveDone, setDriveDone] = useState(false);
  const [fileDone, setFileDone] = useState(false);

  const startCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const { createMnemonic, deriveWalletFromMnemonic: derive } = await import('@/lib/wallet-crypto');
      const phrase = createMnemonic();
      const wallet = await derive(phrase);
      setMnemonic(phrase);
      setDerived(wallet);
      setStep('phrase');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate wallet');
    } finally {
      setBusy(false);
    }
  };

  const startRestore = () => setStep('restore');

  const onConfirmPhrase = () => {
    const normalized = confirmWords.trim().toLowerCase();
    if (normalized !== mnemonic.trim().toLowerCase()) {
      setError('Confirmation phrase does not match');
      return;
    }
    setError(null);
    setStep('working');
    void provisionWallet();
  };

  const provisionWallet = async () => {
    if (!derived || !token || !user?.email) return;
    setBusy(true);
    setError(null);
    try {
      await saveWalletSecrets(user.email, derived);
      saveWalletIdentity(user.email, {
        chiaAddress: derived.chiaAddress,
        walletPk: derived.walletPk,
      });

      const backupPayload = {
        v: 1,
        mnemonic: derived.mnemonic,
        chiaAddress: derived.chiaAddress,
        walletPk: derived.walletPk,
        signingPk: derived.signingPk,
      };
      const encryptedBackup = await encryptBackupBlob(backupPayload, derived.mnemonic);

      const kv = await createKeyVaultAuto({
        ownerPubkeyHex: derived.ownerPubkeyHex,
        encryptedBackup,
        walletAddress: derived.chiaAddress,
      });
      const lid = kv.success ? kv.launcherId || undefined : undefined;
      setLauncherId(lid);

      const profileBody = {
        chiaAddress: derived.chiaAddress,
        walletPk: derived.walletPk,
        displayName: user.firstName || user.email.split('@')[0],
        profileData: {
          signingPk: derived.signingPk,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };
      const authHeaders = await buildProfileRegisterAuth(derived.signingSk, profileBody);
      try {
        await registerWalletProfile(profileBody, authHeaders);
      } catch {
        // Profile may already exist if user retries setup
      }

      await linkWalletToSso(token, {
        chiaAddress: derived.chiaAddress,
        walletPk: derived.walletPk,
        launcherId: lid,
      });

      await updateWalletSecrets(user.email, { launcherId: lid });
      setStep('backup');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet setup failed');
      setStep('confirm');
    } finally {
      setBusy(false);
    }
  };

  const onDownloadFile = () => {
    if (!derived) return;
    downloadRecoveryPhraseFile(derived.mnemonic, derived.chiaAddress);
    setFileDone(true);
  };

  const onDriveBackup = async () => {
    if (!derived) return;
    setBusy(true);
    setError(null);
    try {
      const backupPayload = {
        v: 1,
        mnemonic: derived.mnemonic,
        chiaAddress: derived.chiaAddress,
        walletPk: derived.walletPk,
        signingPk: derived.signingPk,
      };
      const encrypted = await encryptBackupBlob(backupPayload, derived.mnemonic);
      const { url, sessionId } = await startWalletDriveOAuth();
      window.open(url, 'pinksurfing-drive', 'width=520,height=720');
      const { accessToken } = await pollWalletDriveToken(sessionId);
      await uploadEncryptedBackupToDrive(accessToken, encrypted);
      if (user?.email) {
        await updateWalletSecrets(user.email, { backedUpToDrive: true });
      }
      setDriveDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Drive backup failed');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    await onComplete();
  };

  if (step === 'choose') {
    return (
      <Shell title="Set up your wallet" subtitle="Your keys are created on this device. We never see your recovery phrase.">
        {error ? <Err msg={error} /> : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void startCreate()}
          className="w-full rounded-lg bg-[var(--ps-primary)] px-4 py-2.5 text-sm text-white"
        >
          {busy ? 'Generating…' : 'Create new wallet'}
        </button>
        <button
          type="button"
          onClick={startRestore}
          className="mt-3 w-full rounded-lg border border-[var(--ps-brd)] px-4 py-2.5 text-sm"
        >
          I already have a recovery phrase
        </button>
      </Shell>
    );
  }

  if (step === 'restore') {
    return (
      <WalletRestoreScreen
        onComplete={async () => {
          setStep('choose');
          await onComplete();
        }}
      />
    );
  }

  if (step === 'phrase' && derived) {
    return (
      <Shell
        title="Save your recovery phrase"
        subtitle="Write these 12 words down and store them somewhere safe. This is the only way to recover your wallet."
      >
        <div className="rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-bg)] p-4 font-mono text-sm leading-relaxed text-[var(--ps-text)]">
          {mnemonic}
        </div>
        <button type="button" onClick={onDownloadFile} className="mt-3 text-sm text-[var(--ps-cyan)]">
          Download recovery file
        </button>
        <button
          type="button"
          onClick={() => setStep('confirm')}
          className="mt-4 w-full rounded-lg bg-[var(--ps-primary)] px-4 py-2.5 text-sm text-white"
        >
          I saved my phrase
        </button>
      </Shell>
    );
  }

  if (step === 'confirm') {
    return (
      <Shell title="Confirm your phrase" subtitle="Type the full recovery phrase to confirm you saved it.">
        {error ? <Err msg={error} /> : null}
        <textarea
          value={confirmWords}
          onChange={(e) => setConfirmWords(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-bg)] px-3 py-2 text-sm"
          placeholder="Enter your 12 words"
        />
        <button
          type="button"
          onClick={onConfirmPhrase}
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-[var(--ps-primary)] px-4 py-2.5 text-sm text-white"
        >
          {busy ? 'Setting up wallet…' : 'Continue'}
        </button>
      </Shell>
    );
  }

  if (step === 'working') {
    return (
      <Shell title="Setting up wallet" subtitle="Registering your profile and securing your backup…">
        <p className="text-sm text-[var(--ps-muted)]">This may take a moment.</p>
      </Shell>
    );
  }

  if (step === 'backup' && derived) {
    return (
      <Shell
        title="Back up your wallet"
        subtitle="Optional but recommended — restore on a new device from Drive or your recovery file."
      >
        {error ? <Err msg={error} /> : null}
        <p className="text-xs text-[var(--ps-muted)]">Address: {derived.chiaAddress}</p>
        {launcherId ? (
          <p className="text-xs text-[var(--ps-muted)]">Vault linked {launcherId.slice(0, 12)}…</p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void onDriveBackup()}
          className="mt-4 w-full rounded-lg border border-[var(--ps-brd)] px-4 py-2.5 text-sm"
        >
          {driveDone ? '✓ Backed up to Google Drive' : busy ? 'Connecting…' : 'Back up to Google Drive'}
        </button>
        <button type="button" onClick={onDownloadFile} className="mt-3 w-full rounded-lg border border-[var(--ps-brd)] px-4 py-2.5 text-sm">
          {fileDone ? '✓ Recovery file downloaded' : 'Download recovery file'}
        </button>
        <button
          type="button"
          onClick={() => void finish()}
          className="mt-4 w-full rounded-lg bg-[var(--ps-primary)] px-4 py-2.5 text-sm text-white"
        >
          Continue to app
        </button>
      </Shell>
    );
  }

  return null;
}

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <h1 className="text-lg font-semibold text-[var(--ps-text)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--ps-muted)]">{subtitle}</p>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {msg}
    </p>
  );
}
