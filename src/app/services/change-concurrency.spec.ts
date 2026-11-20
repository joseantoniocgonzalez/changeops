import 'fake-indexeddb/auto';

import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import {
  ChangeManagementService,
  NewChangeInput
} from './change-management.service';

describe('Concurrent change operations', () => {

  it('prevents conflicting approval decisions', async () => {

    TestBed.configureTestingModule({});

    const service = TestBed.inject(ChangeManagementService);

    const input: NewChangeInput = {
      title: 'Update production server',
      description: 'Install security updates',
      affectedSystem: 'Production Server 01',
      reason: 'Security maintenance',
      requestedBy: 'Test User',
      risk: 'medium',
      impact: 'high',
      plannedStartAt: '2026-11-21T10:00:00',
      plannedEndAt: '2026-11-21T12:00:00',
      implementationPlan: 'Apply and verify updates',
      rollbackPlan: 'Restore previous snapshot'
    };

    const change = await service.create(input);
    await service.submit(change.id);

    const results = await Promise.allSettled([
      service.approve(change.id, 'Reviewer A'),
      service.reject(change.id, 'Reviewer B', 'Risk too high')
    ]);

    const successful = results.filter(
      result => result.status === 'fulfilled'
    );

    const rejected = results.filter(
      result => result.status === 'rejected'
    );

    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const saved = await service.getById(change.id);

    expect(['approved', 'rejected']).toContain(saved?.status);

    const winner = successful[0];

    if (winner.status !== 'fulfilled') {
      throw new Error('Expected one successful operation');
    }

    expect(saved?.status).toBe(winner.value.status);

  });

});
