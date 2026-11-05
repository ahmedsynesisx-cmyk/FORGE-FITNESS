import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Vault, parseBackup } from './store';
import type { Profile } from './types';

const profile: Profile = { name: 'Test', age: 30, sex: 'male', heightCm: 170, weightKg: 70, city: 'Pune', occupation: 'Engineer', busyHoursPerDay: 9, createdAt: '2026-11-05' };
let n = 0;
const fresh = () => new Vault('test-' + n++);

describe('Vault', () => {
  it('creates, stores encrypted data, locks and unlocks', async () => {
    const v = fresh();
    expect(await v.exists()).toBe(false);
    await v.create('correct horse');
    await v.set('profile', profile);
    expect(await v.get('profile')).toEqual(profile);
    v.lock();
    await expect(v.get('profile')).rejects.toThrow(/locked/);
    expect(await v.unlock('wrong pass')).toBe(false);
    expect(await v.unlock('correct horse')).toBe(true);
    expect((await v.get('profile'))?.city).toBe('Pune');
  });

  it('never stores readable text', async () => {
    const v = fresh();
    await v.create('passcode1');
    await v.set('profile', profile);
    const backup = await v.exportBackup();
    expect(JSON.stringify(backup)).not.toContain('Pune');
  });

  it('backup restores on another device only with the passcode', async () => {
    const a = fresh();
    await a.create('passcode1');
    await a.set('profile', profile);
    const file = JSON.parse(JSON.stringify(await a.exportBackup()));
    const b = fresh();
    expect(await b.importBackup(file, 'nope-nope')).toBe(false);
    expect(await b.exists()).toBe(false);
    expect(await b.importBackup(file, 'passcode1')).toBe(true);
    expect((await b.get('profile'))?.name).toBe('Test');
  });

  it('rejects files that are not Forge backups', () => {
    expect(() => parseBackup({ hello: 1 })).toThrow(/not a Forge backup/);
    expect(() => parseBackup({ format: 'forge-backup-v1', salt: 'x' })).toThrow(/damaged/);
  });

  it('wipe deletes everything', async () => {
    const v = fresh();
    await v.create('passcode1');
    await v.set('profile', profile);
    await v.wipe();
    expect(await v.exists()).toBe(false);
  });
});
