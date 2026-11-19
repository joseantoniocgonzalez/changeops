import { Routes } from '@angular/router';

import { Dashboard } from './pages/dashboard/dashboard';
import { Changes } from './pages/changes/changes';
import { ChangeForm } from './pages/change-form/change-form';
import { ChangeDetail } from './pages/change-detail/change-detail';
import { Approvals } from './pages/approvals/approvals';
import { Audit } from './pages/audit/audit';

export const routes: Routes = [
  { path: '', component: Dashboard, title: 'Dashboard | ChangeOps' },
  { path: 'changes', component: Changes, title: 'Changes | ChangeOps' },
  { path: 'changes/new', component: ChangeForm, title: 'New Change | ChangeOps' },
  { path: 'changes/:id', component: ChangeDetail, title: 'Change Details | ChangeOps' },
  { path: 'approvals', component: Approvals, title: 'Approvals | ChangeOps' },
  { path: 'audit', component: Audit, title: 'Audit Log | ChangeOps' },
  { path: '**', redirectTo: '' }
];
