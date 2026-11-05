import { useRef, useState } from 'react';
import { Button, Card, Field, Notice } from '../components/ui';
import { evaluateSafety } from '../lib/safety';
import { parseBackup } from '../lib/store';
import { today, useVault } from '../lib/vault-context';
import { PaceChanger } from './Home';

export function downloadJson(name: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Settings() {
  const { data, vault, lock, save, log, wipe } = useVault();
  const [confirm, setConfirm] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const p = data.profile!;
  const status = evaluateSafety(data.health);
  const lastBackup = data.audit?.filter((a) => a.what === 'Backup created').at(-1)?.at.slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[26px] font-extrabold tracking-tight">Settings</h1>

      <Card className="flex flex-col gap-2 text-sm">
        <strong className="text-[15px]">Profile</strong>
        <span className="text-slate">{[p.name, `${p.age} y`, p.sex, `${p.heightCm} cm`, p.city, p.occupation].filter(Boolean).join(' · ')}</span>
        <button type="button" className="min-h-[44px] rounded-xl border-[1.5px] border-line font-bold" onClick={() => save('onboarding', { done: false, step: 3 })}>
          Update my answers
        </button>
      </Card>

      <Card className="flex flex-col gap-3">
        <PaceChanger />
        <span className="text-xs text-slate">Changing pace recalculates your targets and estimates. It never removes recovery days.</span>
      </Card>

      {status === 'red' && (
        <Card className="flex flex-col gap-2">
          <strong className="text-[15px]">Medical clearance</strong>
          <span className="text-sm text-slate">Workouts are locked by a safety answer.</span>
          <Button variant="outline" onClick={async () => { await save('health', { ...data.health!, clearedByDoctorAt: today() }); await log('Workouts unlocked', 'You confirmed a doctor cleared you to exercise.'); }}>
            A doctor has cleared me to exercise
          </Button>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <strong className="text-[15px]">Backup</strong>
        <span className="text-sm text-slate">One encrypted file with all your data. Copy it to your other device (WhatsApp to yourself, Drive, USB) and restore it there with the same passcode. Last backup: {lastBackup ?? 'never'}.</span>
        <Button onClick={async () => { downloadJson(`forge-backup-${today()}.json`, await vault.exportBackup()); await log('Backup created', 'You downloaded an encrypted backup.'); }}>
          Download backup file
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <strong className="text-[15px]">Security</strong>
        <span className="text-sm text-slate">Forge locks itself after 5 minutes in the background.</span>
        <Button variant="dark" onClick={lock}>Lock now</Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <strong className="text-[15px] text-danger">Delete everything</strong>
        {!showDelete ? (
          <Button variant="danger" onClick={() => setShowDelete(true)}>Delete all data on this device</Button>
        ) : (
          <>
            <Notice tone="danger">This permanently erases your profile, answers and measurements from this device. Download a backup first if you might want them back.</Notice>
            <Field label='Type DELETE to confirm' value={confirm} onChange={setConfirm} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowDelete(false); setConfirm(''); }}>Cancel</Button>
              <Button variant="danger" disabled={confirm !== 'DELETE'} onClick={wipe}>Erase</Button>
            </div>
          </>
        )}
      </Card>

      <p className="text-xs leading-relaxed text-slate">Your data never leaves this device unless you export it. Forge is not a substitute for a doctor, physiotherapist or registered dietitian.</p>
    </div>
  );
}

/** Restore from a backup file. Used on a new device and from the lock screen. */
export function RestoreForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { vault, reload } = useVault();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<unknown>(null);
  const [fileName, setFileName] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Notice tone="caution">Restoring replaces any Forge data already on this device.</Notice>
      <label className="flex min-h-[52px] cursor-pointer items-center justify-center rounded-2xl border-[1.5px] border-dashed border-charcoal text-sm font-bold">
        {fileName || 'Choose backup file'}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          data-testid="restore-file"
          onChange={async (e) => {
            setErr(null);
            const f = e.target.files?.[0];
            if (!f) return;
            setFileName(f.name);
            if (f.size > 50 * 1024 * 1024) { setErr('That file is too large to be a Forge backup.'); setFile(null); return; }
            try {
              const parsed = parseBackup(JSON.parse(await f.text()));
              setFile(parsed);
            } catch (x) {
              setFile(null);
              setErr(x instanceof SyntaxError ? 'This is not a Forge backup file.' : (x as Error).message);
            }
          }}
        />
      </label>
      <Field label="Passcode used for that backup" type="password" value={pass} onChange={setPass} autoComplete="current-password" />
      {err && <p role="alert" className="text-sm font-semibold text-danger">{err}</p>}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          disabled={!file || !pass || busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            const ok = await vault.importBackup(file, pass);
            setBusy(false);
            if (!ok) { setErr('Wrong passcode for this backup.'); return; }
            await reload();
            onDone();
          }}
        >
          {busy ? 'Restoring…' : 'Restore'}
        </Button>
      </div>
    </div>
  );
}
