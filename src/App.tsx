import { useState } from 'react';
import { Button, Field, Page } from './components/ui';
import { useVault } from './lib/vault-context';
import Home from './screens/Home';
import Onboarding from './screens/Onboarding';
import { RestoreForm } from './screens/Settings';

export default function App() {
  const { status, data } = useVault();
  const [restoring, setRestoring] = useState(false);

  if (status === 'loading') return <div className="flex min-h-[100dvh] items-center justify-center text-slate" role="status">Loading…</div>;
  if (restoring)
    return (
      <Page title="Restore a backup" subtitle="Move your Forge data from another device.">
        <RestoreForm onDone={() => setRestoring(false)} onCancel={() => setRestoring(false)} />
      </Page>
    );
  if (status === 'locked') return <Lock onRestore={() => setRestoring(true)} />;
  if (status === 'new' || !data.onboarding?.done || !data.profile || !data.goals)
    // Same element position for 'new' and 'resume', so answers typed before the passcode step survive the vault being created.
    return (
      <>
        <Onboarding key="onboarding" />
        {status === 'new' && (
          <div className="mx-auto max-w-md px-6 pb-8">
            <button type="button" className="min-h-[44px] w-full text-sm font-bold text-goldink underline" onClick={() => setRestoring(true)}>
              Already use Forge? Restore from a backup
            </button>
          </div>
        )}
      </>
    );
  return <Home />;
}

function Lock({ onRestore }: { onRestore: () => void }) {
  const { unlock, wipe } = useVault();
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [confirm, setConfirm] = useState('');
  const submit = async () => {
    setBusy(true);
    const ok = await unlock(pass);
    setBusy(false);
    if (!ok) setErr('Wrong passcode. Try again.');
  };
  if (forgot)
    return (
      <Page title="Forgot your passcode?" subtitle="Forge can't recover it, because nothing is stored anywhere else." onBack={() => setForgot(false)}>
        <Button onClick={onRestore}>Restore from a backup file</Button>
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-dangerbg p-4">
          <strong className="text-sm text-danger">Or start again</strong>
          <span className="text-sm">This erases all Forge data on this device.</span>
          <Field label="Type DELETE to confirm" value={confirm} onChange={setConfirm} />
          <Button variant="danger" disabled={confirm !== 'DELETE'} onClick={wipe}>Erase and start again</Button>
        </div>
      </Page>
    );
  return (
    <Page title="Welcome back" subtitle="Enter your passcode to unlock Forge."
      footer={
        <>
          <Button disabled={!pass || busy} onClick={submit}>{busy ? 'Unlocking…' : 'Unlock'}</Button>
          <button type="button" className="min-h-[44px] text-sm font-bold text-goldink" onClick={() => setForgot(true)}>Forgot passcode?</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); if (pass) submit(); }}>
        <Field label="Passcode" type="password" value={pass} onChange={(v) => { setPass(v); setErr(null); }} error={err} autoComplete="current-password" />
      </form>
    </Page>
  );
}
