// The on-device encrypted vault. Each collection is one encrypted record in IndexedDB.
// Without the passcode the stored data and backup files are unreadable, and nothing is sent anywhere.

import Dexie, { type Table } from 'dexie';
import { deriveKey, fromB64, open, randomBytes, seal, toB64, PBKDF2_ITERATIONS, type Sealed } from './crypto';
import type { CollectionName, Collections } from './types';

interface MetaRow {
  id: 'vault';
  salt: string;
  iterations: number;
  check: Sealed; // encrypted known value, used to verify the passcode
  createdAt: string;
}
interface RecordRow {
  name: CollectionName;
  sealed: Sealed;
}

class ForgeDB extends Dexie {
  meta!: Table<MetaRow, string>;
  records!: Table<RecordRow, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ meta: 'id', records: 'name' });
  }
}

const CHECK_VALUE = 'forge-vault-ok';
export const BACKUP_FORMAT = 'forge-backup-v1';

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  createdAt: string;
  salt: string;
  iterations: number;
  check: Sealed;
  records: { name: CollectionName; sealed: Sealed }[];
}

export class Vault {
  private db: ForgeDB;
  private key: CryptoKey | null = null;

  constructor(dbName = 'forge') {
    this.db = new ForgeDB(dbName);
  }

  async exists(): Promise<boolean> {
    return (await this.db.meta.get('vault')) !== undefined;
  }

  get unlocked(): boolean {
    return this.key !== null;
  }

  async create(passcode: string): Promise<void> {
    if (await this.exists()) throw new Error('A vault already exists on this device.');
    const salt = randomBytes(16);
    const key = await deriveKey(passcode, salt);
    const check = await seal(key, CHECK_VALUE);
    await this.db.meta.put({ id: 'vault', salt: toB64(salt), iterations: PBKDF2_ITERATIONS, check, createdAt: new Date().toISOString() });
    this.key = key;
  }

  /** Returns false for a wrong passcode. */
  async unlock(passcode: string): Promise<boolean> {
    const meta = await this.db.meta.get('vault');
    if (!meta) throw new Error('No vault on this device.');
    const key = await deriveKey(passcode, fromB64(meta.salt), meta.iterations);
    try {
      if ((await open<string>(key, meta.check)) !== CHECK_VALUE) return false;
    } catch {
      return false;
    }
    this.key = key;
    return true;
  }

  lock(): void {
    this.key = null;
  }

  private requireKey(): CryptoKey {
    if (!this.key) throw new Error('Vault is locked.');
    return this.key;
  }

  async get<K extends CollectionName>(name: K): Promise<Collections[K] | undefined> {
    const key = this.requireKey();
    const row = await this.db.records.get(name);
    return row ? open<Collections[K]>(key, row.sealed) : undefined;
  }

  async set<K extends CollectionName>(name: K, value: Collections[K]): Promise<void> {
    const key = this.requireKey();
    await this.db.records.put({ name, sealed: await seal(key, value) });
  }

  async remove(name: CollectionName): Promise<void> {
    this.requireKey();
    await this.db.records.delete(name);
  }

  /** Erases everything on this device, including the key material. */
  async wipe(): Promise<void> {
    this.key = null;
    await this.db.transaction('rw', this.db.meta, this.db.records, async () => {
      await this.db.records.clear();
      await this.db.meta.clear();
    });
  }

  /** Encrypted backup: the same sealed records plus the salt; useless without the passcode. */
  async exportBackup(): Promise<BackupFile> {
    this.requireKey();
    const meta = await this.db.meta.get('vault');
    if (!meta) throw new Error('No vault on this device.');
    const records = await this.db.records.toArray();
    return { format: BACKUP_FORMAT, createdAt: new Date().toISOString(), salt: meta.salt, iterations: meta.iterations, check: meta.check, records };
  }

  /** Replaces this device's data with the backup, if the passcode opens it. Returns false for a wrong passcode. */
  async importBackup(file: unknown, passcode: string): Promise<boolean> {
    const b = parseBackup(file);
    const key = await deriveKey(passcode, fromB64(b.salt), b.iterations);
    try {
      if ((await open<string>(key, b.check)) !== CHECK_VALUE) return false;
      for (const r of b.records) await open(key, r.sealed); // verify every record before touching current data
    } catch {
      return false;
    }
    await this.db.transaction('rw', this.db.meta, this.db.records, async () => {
      await this.db.records.clear();
      await this.db.meta.clear();
      await this.db.meta.put({ id: 'vault', salt: b.salt, iterations: b.iterations, check: b.check, createdAt: b.createdAt });
      await this.db.records.bulkPut(b.records);
    });
    this.key = key;
    return true;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export function parseBackup(file: unknown): BackupFile {
  const f = file as Partial<BackupFile> | null;
  const okSealed = (s: unknown) => !!s && typeof (s as Sealed).iv === 'string' && typeof (s as Sealed).data === 'string';
  if (!f || typeof f !== 'object' || f.format !== BACKUP_FORMAT) throw new Error('This is not a Forge backup file.');
  if (typeof f.salt !== 'string' || typeof f.iterations !== 'number' || !okSealed(f.check) || !Array.isArray(f.records)) {
    throw new Error('This backup file is damaged.');
  }
  for (const r of f.records) if (typeof r?.name !== 'string' || !okSealed(r.sealed)) throw new Error('This backup file is damaged.');
  return f as BackupFile;
}
