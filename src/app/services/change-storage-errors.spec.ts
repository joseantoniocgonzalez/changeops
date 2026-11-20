import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { ChangeStorageService } from './change-storage.service';

describe('ChangeStorageService error handling', () => {

  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty list for a new database', async () => {
    const storage = new ChangeStorageService();

    expect(await storage.getAll()).toEqual([]);
  });

  it('returns undefined for a missing record', async () => {
    const storage = new ChangeStorageService();

    expect(
      await storage.getById('missing-id')
    ).toBeUndefined();
  });

  it('reports when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);

    const storage = new ChangeStorageService();

    await expect(
      storage.getAll()
    ).rejects.toThrow('IndexedDB is not available');
  });

});
