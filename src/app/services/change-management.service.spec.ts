import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ChangeRequest
} from '../models/change-request.model';

import {
  ChangeManagementService,
  NewChangeInput
} from './change-management.service';

import { ChangeStorageService } from './change-storage.service';

class MemoryStorage {
  private records = new Map<string, ChangeRequest>();

  async getAll(): Promise<ChangeRequest[]> {
    return Array.from(this.records.values());
  }

  async getById(id: string): Promise<ChangeRequest | undefined> {
    return this.records.get(id);
  }

  async save(change: ChangeRequest): Promise<void> {
    this.records.set(change.id, structuredClone(change));
  }

  async updateAtomically(
    id: string,
    updater: (current: ChangeRequest) => ChangeRequest
  ): Promise<ChangeRequest> {
    const current = this.records.get(id);

    if (!current) {
      throw new Error('Change request not found.');
    }

    const updated = updater(structuredClone(current));
    this.records.set(id, structuredClone(updated));

    return structuredClone(updated);
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}

describe('ChangeManagementService', () => {
  let service: ChangeManagementService;
  let storage: MemoryStorage;

  const validInput: NewChangeInput = {
    title: 'Update Linux server',
    description: 'Install security updates',
    affectedSystem: 'Linux Server 01',
    reason: 'Security maintenance',
    requestedBy: 'Test User',
    assignedTo: 'System Administrator',
    risk: 'medium',
    impact: 'low',
    plannedStartAt: '2026-11-21T10:00:00',
    plannedEndAt: '2026-11-21T11:00:00',
    implementationPlan: 'Apply and verify updates',
    rollbackPlan: 'Restore system snapshot'
  };

  beforeEach(() => {
    storage = new MemoryStorage();

    const originalCrypto = globalThis.crypto;

    vi.stubGlobal('crypto', {
      getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
      randomUUID: () => '12345678-1234-4abc-8def-123456789abc'
    });

    TestBed.configureTestingModule({
      providers: [
        ChangeManagementService,
        { provide: ChangeStorageService, useValue: storage }
      ]
    });

    service = TestBed.inject(ChangeManagementService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a valid request as draft', async () => {
    const change = await service.create(validInput);

    expect(change.status).toBe('draft');
    expect(change.title).toBe(validInput.title);

    const saved = await service.getById(change.id);

    expect(saved).toEqual(change);
  });

  it('rejects an empty title', async () => {
    await expect(
      service.create({ ...validInput, title: '  ' })
    ).rejects.toThrow('title is required');
  });

  it('rejects invalid planned dates', async () => {
    await expect(
      service.create({
        ...validInput,
        plannedEndAt: '2026-11-21T09:00:00'
      })
    ).rejects.toThrow('Invalid planned dates');
  });

  it('prevents approving a draft', async () => {
    const change = await service.create(validInput);

    await expect(
      service.approve(change.id, 'Reviewer')
    ).rejects.toThrow('Cannot change status');

    expect((await service.getById(change.id))?.status).toBe('draft');
  });

  it('supports the complete approval workflow', async () => {
    const change = await service.create(validInput);

    await service.submit(change.id);
    await service.approve(change.id, 'Reviewer');
    await service.start(change.id);

    const result = await service.finish(
      change.id,
      true,
      'Updates installed successfully'
    );

    expect(result.status).toBe('completed');
    expect(result.reviewedBy).toBe('Reviewer');
    expect(result.executedAt).toBeDefined();
    expect(result.outcomeNotes).toBe(
      'Updates installed successfully'
    );
  });

  it('requires a reason when rejecting', async () => {
    const change = await service.create(validInput);
    await service.submit(change.id);

    await expect(
      service.reject(change.id, 'Reviewer', '')
    ).rejects.toThrow('Rejection reason is required');

    const rejected = await service.reject(
      change.id,
      'Reviewer',
      'Insufficient documentation'
    );

    expect(rejected.status).toBe('rejected');
  });

  it('prevents starting an unapproved change', async () => {
    const change = await service.create(validInput);

    await expect(
      service.start(change.id)
    ).rejects.toThrow('Cannot change status');
  });

  it('prevents completing a change not in progress', async () => {
    const change = await service.create(validInput);

    await expect(
      service.finish(change.id, true, 'Completed')
    ).rejects.toThrow('Cannot change status');
  });

  it('allows cancellation before execution', async () => {
    const change = await service.create(validInput);

    const cancelled = await service.cancel(change.id);

    expect(cancelled.status).toBe('cancelled');

    await expect(
      service.submit(change.id)
    ).rejects.toThrow('Cannot change status');
  });

  it('rejects operations on missing requests', async () => {
    await expect(
      service.submit('nonexistent-id')
    ).rejects.toThrow('Change request not found');
  });

  it('rejects an impossible calendar date', async () => {
    await expect(
      service.create({
        ...validInput,
        plannedStartAt: '2026-02-31T10:00:00',
        plannedEndAt: '2026-03-01T12:00:00'
      })
    ).rejects.toThrow('Invalid planned dates');
  });

  it('rejects identical start and end dates', async () => {
    await expect(
      service.create({
        ...validInput,
        plannedEndAt: validInput.plannedStartAt
      })
    ).rejects.toThrow('Invalid planned dates');
  });

  it('rejects an invalid risk level', async () => {
    await expect(
      service.create({
        ...validInput,
        risk: 'critical' as NewChangeInput['risk']
      })
    ).rejects.toThrow('Invalid risk level');
  });

  it('rejects an invalid impact level', async () => {
    await expect(
      service.create({
        ...validInput,
        impact: 'unknown' as NewChangeInput['impact']
      })
    ).rejects.toThrow('Invalid impact level');
  });

  it('rejects missing required descriptions', async () => {
    await expect(
      service.create({
        ...validInput,
        implementationPlan: ' ',
        rollbackPlan: ''
      })
    ).rejects.toThrow();

    expect(await storage.getAll()).toHaveLength(0);
  });

  it('rejects invalid assigned user data', async () => {
    await expect(
      service.create({
        ...validInput,
        assignedTo: 123 as unknown as string
      })
    ).rejects.toThrow('Assigned user must be text');
  });

  it('prevents cancelling an executing change', async () => {
    const change = await service.create(validInput);

    await service.submit(change.id);
    await service.approve(change.id, 'Reviewer');
    await service.start(change.id);

    await expect(
      service.cancel(change.id)
    ).rejects.toThrow('Cannot change status');

    expect(
      (await service.getById(change.id))?.status
    ).toBe('in_progress');
  });

  it('requires execution notes', async () => {
    const change = await service.create(validInput);

    await service.submit(change.id);
    await service.approve(change.id, 'Reviewer');
    await service.start(change.id);

    await expect(
      service.finish(change.id, true, '  ')
    ).rejects.toThrow('Execution notes is required');
  });

  it('reports storage write failures', async () => {
    vi.spyOn(storage, 'save').mockRejectedValueOnce(
      new Error('Storage write failed')
    );

    await expect(
      service.create(validInput)
    ).rejects.toThrow('Storage write failed');
  });

  it('returns changes ordered by creation date', async () => {
    const change = await service.create(validInput);

    await storage.save({
      ...change,
      id: 'older',
      createdAt: '2025-01-01T10:00:00'
    });

    await storage.save({
      ...change,
      id: 'newer',
      createdAt: '2027-01-01T10:00:00'
    });

    const changes = await service.getAll();

    expect(changes[0].id).toBe('newer');
    expect(changes[changes.length - 1].id).toBe('older');
  });

});
