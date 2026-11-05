import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Vault } from './store';
import type { AuditEntry, CollectionName, Collections } from './types';

export type Data = Partial<Collections>;
const ALL: CollectionName[] = ['profile', 'health', 'lifestyle', 'fitness', 'equipment', 'food', 'goals', 'measurements', 'audit', 'onboarding', 'training', 'sessions'];
const AUTO_LOCK_MS = 5 * 60 * 1000;

interface Ctx {
  status: 'loading' | 'new' | 'locked' | 'unlocked';
  data: Data;
  vault: Vault;
  create: (passcode: string) => Promise<void>;
  unlock: (passcode: string) => Promise<boolean>;
  lock: () => void;
  save: <K extends CollectionName>(name: K, value: Collections[K]) => Promise<void>;
  log: (what: string, why: string) => Promise<void>;
  reload: () => Promise<void>;
  wipe: () => Promise<void>;
}

const VaultCtx = createContext<Ctx | null>(null);

export function VaultProvider({ children, vault: given }: { children: ReactNode; vault?: Vault }) {
  const vault = useMemo(() => given ?? new Vault(), [given]);
  const [status, setStatus] = useState<Ctx['status']>('loading');
  const [data, setData] = useState<Data>({});
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    vault.exists().then((e) => setStatus(e ? 'locked' : 'new'));
    // Ask the browser not to clear our storage under pressure (best effort).
    navigator.storage?.persist?.().catch(() => undefined);
  }, [vault]);

  const loadAll = useCallback(async () => {
    const out: Data = {};
    for (const n of ALL) {
      const v = await vault.get(n);
      if (v !== undefined) (out as Record<string, unknown>)[n] = v;
    }
    setData(out);
  }, [vault]);

  const lock = useCallback(() => {
    vault.lock();
    setData({});
    setStatus('locked');
  }, [vault]);

  // Auto-lock when the app has been in the background for 5 minutes.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > AUTO_LOCK_MS && vault.unlocked) lock();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [vault, lock]);

  const value: Ctx = {
    status,
    data,
    vault,
    create: async (p) => {
      await vault.create(p);
      setData({});
      setStatus('unlocked');
    },
    unlock: async (p) => {
      const ok = await vault.unlock(p);
      if (ok) {
        await loadAll();
        setStatus('unlocked');
      }
      return ok;
    },
    lock,
    save: async (name, v) => {
      await vault.set(name, v);
      setData((d) => ({ ...d, [name]: v }));
    },
    log: async (what, why) => {
      const entry: AuditEntry = { at: new Date().toISOString(), what, why };
      const next = [...(data.audit ?? []), entry].slice(-500);
      await vault.set('audit', next);
      setData((d) => ({ ...d, audit: next }));
    },
    reload: async () => {
      if (vault.unlocked) {
        await loadAll();
        setStatus('unlocked');
      } else setStatus((await vault.exists()) ? 'locked' : 'new');
    },
    wipe: async () => {
      await vault.wipe();
      setData({});
      setStatus('new');
    },
  };
  return <VaultCtx.Provider value={value}>{children}</VaultCtx.Provider>;
}

export function useVault(): Ctx {
  const c = useContext(VaultCtx);
  if (!c) throw new Error('useVault outside provider');
  return c;
}

export function today(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
