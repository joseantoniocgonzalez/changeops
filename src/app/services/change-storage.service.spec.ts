import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';
import { ChangeStorageService } from './change-storage.service';
import { ChangeRequest } from '../models/change-request.model';

describe('ChangeStorageService', () => {

  it('should create, retrieve, update and delete a change request', async () => {

    const storage = new ChangeStorageService();

    const change: ChangeRequest = {
      id: 'test-change-001',
      reference: 'CHG-001',
      title: 'Update Linux server',
      description: 'Apply system security updates',
      affectedSystem: 'Linux Server 01',
      reason: 'Security maintenance',
      requestedBy: 'Test User',
      risk: 'medium',
      impact: 'low',
      plannedStartAt: '2026-11-21T10:00:00',
      plannedEndAt: '2026-11-21T11:00:00',
      implementationPlan: 'Apply updates and verify services',
      rollbackPlan: 'Restore previous system snapshot',
      status: 'draft',
      createdAt: '2026-11-20T10:00:00',
      updatedAt: '2026-11-20T10:00:00'
    };

    // 1. Save a new change request
    await storage.save(change);

    // 2. Retrieve the saved request
    const saved = await storage.getById(change.id);

    expect(saved).toEqual(change);

    // 3. Check persistence across service instances
    const secondStorage = new ChangeStorageService();

    const allChanges = await secondStorage.getAll();

    expect(allChanges).toContainEqual(change);

    // 4. Update the request
    const updated: ChangeRequest = {
      ...change,
      status: 'approved',
      updatedAt: '2026-11-20T11:00:00'
    };

    await storage.save(updated);

    const retrieved = await storage.getById(change.id);

    expect(retrieved?.status).toBe('approved');
    expect(retrieved?.updatedAt).toBe(updated.updatedAt);

    // 5. Delete the request
    await storage.delete(change.id);

    const deleted = await storage.getById(change.id);

    expect(deleted).toBeUndefined();

  });

});
