export type AdminPermission =
  | 'overview.view'
  | 'events.view'
  | 'events.create'
  | 'events.edit'
  | 'events.publish'
  | 'events.delete'
  | 'registrations.manage'
  | 'cities.manage'
  | 'members.view'
  | 'members.manage'
  | 'roles.assign'
  | 'communities.manage'
  | 'partners.verify'
  | 'venues.manage'
  | 'checkin.access'
  | 'checkin.override'
  | 'quiz.manage'
  | 'moderation.manage'
  | 'campaigns.approve'
  | 'payments.view'
  | 'payments.refund'
  | 'notifications.manage'
  | 'analytics.view'
  | 'settings.manage'
  | 'auditlogs.view';

export const ALL_PERMISSIONS: AdminPermission[] = [
  'overview.view',
  'events.view',
  'events.create',
  'events.edit',
  'events.publish',
  'events.delete',
  'registrations.manage',
  'cities.manage',
  'members.view',
  'members.manage',
  'roles.assign',
  'communities.manage',
  'partners.verify',
  'venues.manage',
  'checkin.access',
  'checkin.override',
  'quiz.manage',
  'moderation.manage',
  'campaigns.approve',
  'payments.view',
  'payments.refund',
  'notifications.manage',
  'analytics.view',
  'settings.manage',
  'auditlogs.view',
];

export const ROLE_PERMISSIONS: Record<string, AdminPermission[]> = {
  super_admin: [...ALL_PERMISSIONS],
  admin: ALL_PERMISSIONS.filter((p) => p !== 'settings.manage' ? true : true),
  platform_admin: ALL_PERMISSIONS.filter((p) => p !== 'roles.assign' && p !== 'settings.manage'),
  event_manager: [
    'overview.view',
    'events.view',
    'events.create',
    'events.edit',
    'events.publish',
    'events.delete',
    'registrations.manage',
    'cities.manage',
    'venues.manage',
    'checkin.access',
    'notifications.manage',
    'analytics.view',
  ],
  community_manager: [
    'overview.view',
    'communities.manage',
    'moderation.manage',
    'events.view',
    'notifications.manage',
    'analytics.view',
  ],
  partner_manager: [
    'overview.view',
    'partners.verify',
    'venues.manage',
    'campaigns.approve',
    'notifications.manage',
    'analytics.view',
  ],
  checkin_staff: [
    'overview.view',
    'events.view',
    'checkin.access',
  ],
  support_staff: [
    'overview.view',
    'members.view',
    'events.view',
    'moderation.manage',
  ],
  venue_partner: [],
  participant: [],
  user: [],
};

export const PRIVILEGED_ROLES = ['super_admin', 'admin', 'platform_admin'];
export const ADMIN_STAFF_ROLES = [
  'super_admin',
  'admin',
  'platform_admin',
  'event_manager',
  'community_manager',
  'partner_manager',
  'checkin_staff',
  'support_staff',
];

export function getRolePermissions(role?: string): AdminPermission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role: string | undefined, permission: AdminPermission): boolean {
  if (!role) return false;
  if (role === 'super_admin' || role === 'admin') return true;
  return getRolePermissions(role).includes(permission);
}

export function hasAnyAdminAccess(role?: string): boolean {
  return !!role && ADMIN_STAFF_ROLES.includes(role);
}

export function getAllowedSidebarSections(role?: string): string[] {
  const perms = new Set(getRolePermissions(role));
  if (role === 'super_admin' || role === 'admin') {
    ALL_PERMISSIONS.forEach((p) => perms.add(p));
  }
  const sections: string[] = [];
  if (perms.has('overview.view')) sections.push('overview');
  if (perms.has('events.view') || perms.has('cities.manage')) sections.push('events');
  if (perms.has('members.view') || perms.has('members.manage') || perms.has('roles.assign')) sections.push('members');
  if (perms.has('communities.manage')) sections.push('communities');
  if (perms.has('partners.verify') || perms.has('campaigns.approve')) sections.push('partners');
  if (perms.has('venues.manage')) sections.push('venues');
  if (perms.has('checkin.access')) sections.push('checkin');
  if (perms.has('quiz.manage')) sections.push('quiz_cms');
  if (perms.has('moderation.manage')) sections.push('moderation');
  if (perms.has('payments.view') || perms.has('payments.refund')) sections.push('payments');
  if (perms.has('notifications.manage')) sections.push('notifications');
  if (perms.has('analytics.view')) sections.push('analytics');
  if (perms.has('settings.manage')) sections.push('settings');
  if (perms.has('auditlogs.view')) sections.push('audit_logs');
  return sections;
}
