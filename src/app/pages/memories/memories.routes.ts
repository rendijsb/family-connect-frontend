import { Routes } from '@angular/router';

export const memoriesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./memory-timeline.page').then(m => m.MemoryTimelinePage),
    data: { title: 'Memory Timeline' }
  },
  {
    path: 'create',
    loadComponent: () => import('./create-memory.page').then(m => m.CreateMemoryPage),
    data: { title: 'Create Memory' }
  },
  {
    path: 'milestones',
    loadComponent: () => import('./milestones.page').then(m => m.MilestonesPage),
    data: { title: 'Family Milestones' }
  },
  {
    path: 'milestones/create',
    loadComponent: () => import('./create-milestone.page').then(m => m.CreateMilestonePage),
    data: { title: 'Create Milestone' }
  },
  {
    path: 'milestones/:milestoneId',
    loadComponent: () => import('./milestone-detail.page').then(m => m.MilestoneDetailPage),
    data: { title: 'Milestone Details' }
  },
  {
    path: 'traditions',
    loadComponent: () => import('./traditions.page').then(m => m.TraditionsPage),
    data: { title: 'Family Traditions' }
  },
  {
    path: 'traditions/create',
    loadComponent: () => import('./create-tradition.page').then(m => m.CreateTraditionPage),
    data: { title: 'Create Tradition' }
  },
  {
    path: 'traditions/:traditionId',
    loadComponent: () => import('./tradition-detail.page').then(m => m.TraditionDetailPage),
    data: { title: 'Tradition Details' }
  },
  {
    path: 'time-capsules',
    loadComponent: () => import('./time-capsule.page').then(m => m.TimeCapsulePage),
    data: { title: 'Time Capsules' }
  },
  {
    path: 'time-capsules/create',
    loadComponent: () => import('./create-time-capsule.page').then(m => m.CreateTimeCapsulePage),
    data: { title: 'Create Time Capsule' }
  },
  {
    path: 'time-capsules/:capsuleId',
    loadComponent: () => import('./time-capsule-detail.page').then(m => m.TimeCapsuleDetailPage),
    data: { title: 'Time Capsule' }
  },
  {
    path: ':memoryId',
    loadComponent: () => import('./memory-detail.page').then(m => m.MemoryDetailPage),
    data: { title: 'Memory Details' }
  }
];