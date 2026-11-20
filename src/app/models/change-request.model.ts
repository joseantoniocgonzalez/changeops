export type ChangeStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RiskLevel = 'low' | 'medium' | 'high';

export type ImpactLevel = 'low' | 'medium' | 'high';

export interface ChangeRequest {
  id: string;
  reference: string;

  title: string;
  description: string;
  affectedSystem: string;
  reason: string;

  requestedBy: string;
  assignedTo?: string;

  risk: RiskLevel;
  impact: ImpactLevel;

  plannedStartAt: string;
  plannedEndAt: string;

  implementationPlan: string;
  rollbackPlan: string;

  status: ChangeStatus;

  createdAt: string;
  updatedAt: string;

  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;

  executedAt?: string;
  outcomeNotes?: string;
}
