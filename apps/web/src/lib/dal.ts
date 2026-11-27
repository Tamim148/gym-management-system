import { UserRole, type AuthUserProfile } from '@vintage/shared';
import { apiGet, apiPost } from './api';
import { wipeOfflineStorage } from './offline-store';

export interface DemoAccountPreset {
  label: string;
  role: UserRole;
  identifier: string;
  password: string;
  note: string;
}

export const DEMO_ACCOUNTS: DemoAccountPreset[] = [
  {
    label: 'Super Admin',
    role: UserRole.SUPER_ADMIN,
    identifier: 'admin@vintageaesthetics.gym',
    password: 'Vintage@2026',
    note: 'All 3 Branches • KPIs, Churn, Flags',
  },
  {
    label: 'Front-Desk (Gulshan)',
    role: UserRole.FRONT_DESK,
    identifier: 'desk.gulshan@vintageaesthetics.gym',
    password: 'Vintage@2026',
    note: 'DHK-01 • Live Access & Overrides',
  },
  {
    label: 'Front-Desk (Dhanmondi)',
    role: UserRole.FRONT_DESK,
    identifier: 'desk.dhanmondi@vintageaesthetics.gym',
    password: 'Vintage@2026',
    note: 'DHK-02 • Branch Isolation Check',
  },
  {
    label: 'Trainer (Coach Arif)',
    role: UserRole.TRAINER,
    identifier: 'arif.trainer@vintageaesthetics.gym',
    password: 'Vintage@2026',
    note: 'DHK-01 • Schedule CRUD & Roster',
  },
  {
    label: 'VIP Member (Farhana)',
    role: UserRole.MEMBER,
    identifier: 'farhana@demo.com',
    password: 'Vintage@2026',
    note: 'Active Roaming VIP + Family Payer',
  },
  {
    label: 'Overdue Member (Tariq)',
    role: UserRole.MEMBER,
    identifier: 'tariq@demo.com',
    password: 'Vintage@2026',
    note: '3,500 BDT Due • Red Alert Test',
  },
  {
    label: 'Partial Due (Kamrul)',
    role: UserRole.MEMBER,
    identifier: 'kamrul@demo.com',
    password: 'Vintage@2026',
    note: '1,750 BDT Due • Split Payment',
  },
  {
    label: 'Frozen Member (Nusrat)',
    role: UserRole.MEMBER,
    identifier: 'nusrat@demo.com',
    password: 'Vintage@2026',
    note: 'Active Freeze • Denied Frozen Test',
  },
];

export async function fetchMe(): Promise<AuthUserProfile | null> {
  try {
    return await apiGet<AuthUserProfile>('/api/auth/me');
  } catch {
    return null;
  }
}

export async function logoutAndWipe(): Promise<void> {
  try {
    await apiPost('/api/auth/logout', {});
  } catch {
    // Proceed with local cleanup even if backend session is already expired
  } finally {
    await wipeOfflineStorage();
  }
}

export function getRoleLandingRoute(role: UserRole): string {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return '/admin';
    case UserRole.BRANCH_MANAGER:
    case UserRole.FRONT_DESK:
      return '/desk';
    case UserRole.TRAINER:
      return '/trainer';
    case UserRole.MEMBER:
    default:
      return '/member';
  }
}

export function formatBdt(amount: number): string {
  return `${Math.round(amount).toLocaleString('en-US')} BDT`;
}
