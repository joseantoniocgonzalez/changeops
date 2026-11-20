import { Injectable, inject } from '@angular/core';

import {
  ChangeRequest,
  ChangeStatus
} from '../models/change-request.model';

import { ChangeStorageService } from './change-storage.service';

export type NewChangeInput = Pick<
  ChangeRequest,
  | 'title'
  | 'description'
  | 'affectedSystem'
  | 'reason'
  | 'requestedBy'
  | 'assignedTo'
  | 'risk'
  | 'impact'
  | 'plannedStartAt'
  | 'plannedEndAt'
  | 'implementationPlan'
  | 'rollbackPlan'
>;

@Injectable({
  providedIn: 'root'
})
export class ChangeManagementService {

  private readonly storage = inject(ChangeStorageService);

  async getAll(): Promise<ChangeRequest[]> {
    const changes = await this.storage.getAll();

    return changes.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );
  }

  getById(id: string): Promise<ChangeRequest | undefined> {
    return this.storage.getById(id);
  }

  async create(input: NewChangeInput): Promise<ChangeRequest> {
    this.validateInput(input);

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const change: ChangeRequest = {
      ...input,
      id,
      reference: `CHG-${id.slice(0, 8).toUpperCase()}`,
      status: 'draft',
      createdAt: now,
      updatedAt: now
    };

    await this.storage.save(change);

    return change;
  }

  async submit(id: string): Promise<ChangeRequest> {
    return this.transition(
      id,
      ['draft'],
      'pending_approval'
    );
  }

  async approve(
    id: string,
    reviewer: string,
    comment = ''
  ): Promise<ChangeRequest> {
    this.requireText(reviewer, 'Reviewer');

    return this.transition(
      id,
      ['pending_approval'],
      'approved',
      {
        reviewedBy: reviewer.trim(),
        reviewedAt: new Date().toISOString(),
        reviewComment: comment.trim()
      }
    );
  }

  async reject(
    id: string,
    reviewer: string,
    reason: string
  ): Promise<ChangeRequest> {
    this.requireText(reviewer, 'Reviewer');
    this.requireText(reason, 'Rejection reason');

    return this.transition(
      id,
      ['pending_approval'],
      'rejected',
      {
        reviewedBy: reviewer.trim(),
        reviewedAt: new Date().toISOString(),
        reviewComment: reason.trim()
      }
    );
  }

  async start(id: string): Promise<ChangeRequest> {
    return this.transition(
      id,
      ['approved'],
      'in_progress',
      { executedAt: new Date().toISOString() }
    );
  }

  async finish(
    id: string,
    successful: boolean,
    notes: string
  ): Promise<ChangeRequest> {
    this.requireText(notes, 'Execution notes');

    return this.transition(
      id,
      ['in_progress'],
      successful ? 'completed' : 'failed',
      { outcomeNotes: notes.trim() }
    );
  }

  async cancel(id: string): Promise<ChangeRequest> {
    return this.transition(
      id,
      ['draft', 'pending_approval', 'approved'],
      'cancelled'
    );
  }

  private async transition(
    id: string,
    allowedStatuses: ChangeStatus[],
    nextStatus: ChangeStatus,
    additionalData: Partial<ChangeRequest> = {}
  ): Promise<ChangeRequest> {

    return this.storage.updateAtomically(id, current => {
      if (!allowedStatuses.includes(current.status)) {
        throw new Error(
          `Cannot change status from ${current.status} to ${nextStatus}.`
        );
      }

      return {
        ...current,
        ...additionalData,
        status: nextStatus,
        updatedAt: new Date().toISOString()
      };
    });
  }

  private requireText(value: string, field: string): void {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${field} is required.`);
    }
  }

  private validateInput(input: NewChangeInput): void {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Change request data is required.');
    }

    const requiredFields = [
      'title',
      'description',
      'affectedSystem',
      'reason',
      'requestedBy',
      'implementationPlan',
      'rollbackPlan'
    ] as const;

    for (const field of requiredFields) {
      this.requireText(input[field], field);
    }

    if (
      input.assignedTo !== undefined &&
      typeof input.assignedTo !== 'string'
    ) {
      throw new Error('Assigned user must be text.');
    }

    const validLevels = ['low', 'medium', 'high'];

    if (!validLevels.includes(input.risk)) {
      throw new Error('Invalid risk level.');
    }

    if (!validLevels.includes(input.impact)) {
      throw new Error('Invalid impact level.');
    }

    const parseLocalDate = (value: unknown): number | null => {
      if (typeof value !== 'string') return null;

      const match =
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);

      if (!match) return null;

      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const hour = Number(match[4]);
      const minute = Number(match[5]);
      const second = Number(match[6] ?? 0);

      const date = new Date(0);
      date.setFullYear(year, month - 1, day);
      date.setHours(hour, minute, second, 0);

      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day ||
        date.getHours() !== hour ||
        date.getMinutes() !== minute ||
        date.getSeconds() !== second
      ) {
        return null;
      }

      return date.getTime();
    };

    const start = parseLocalDate(input.plannedStartAt);
    const end = parseLocalDate(input.plannedEndAt);

    if (start === null || end === null || end <= start) {
      throw new Error('Invalid planned dates.');
    }
  }

}
