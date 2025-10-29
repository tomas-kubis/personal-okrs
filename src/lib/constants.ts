import type { NavItem } from '../types';

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'home',
    path: '/',
  },
  {
    id: 'check-in',
    label: 'Check-in',
    icon: 'calendar',
    path: '/check-in',
  },
  {
    id: 'coach',
    label: 'Coach',
    icon: 'message-square',
    path: '/coach',
  },
  {
    id: 'history',
    label: 'History',
    icon: 'clock',
    path: '/history',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    path: '/settings',
  },
];
