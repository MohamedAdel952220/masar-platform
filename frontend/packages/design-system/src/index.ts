/**
 * @masar/design-system — the single public entry point.
 *
 * Tokens are plain CSS custom properties and must be imported once per app:
 *   import '@masar/design-system/tokens/index.css';
 *
 * Components are ported verbatim from the original /components directory —
 * markup and style objects are unchanged (FRONTEND_ARCHITECTURE.md §9).
 */

// Core
export { Avatar, type AvatarProps } from './core/Avatar';
export { Badge, type BadgeProps } from './core/Badge';
export { Button, type ButtonProps } from './core/Button';
export { Card, type CardProps } from './core/Card';
export { Icon, type IconProps } from './core/Icon';
export { Input, type InputProps } from './core/Input';

// Data
export { StatCard, type StatCardProps } from './data/StatCard';

// Navigation
export { Tabs, type TabItem, type TabsProps } from './navigation/Tabs';

// Status
export { DayPath, type DayPathProps, type DayPathStep } from './status/DayPath';
export { StatusPill, type ChildStatus, type StatusPillProps } from './status/StatusPill';

// Layouts
export { AppShell, type AppShellProps } from './layouts/AppShell';
export { CenteredLayout, type CenteredLayoutProps } from './layouts/CenteredLayout';

// Providers
export {
  ThemeProvider,
  useTheme,
  type Direction,
  type ThemeMode,
  type ThemeProviderProps,
} from './providers/ThemeProvider';
export {
  UIStoreProvider,
  useUIStore,
  createUIStore,
  type UIState,
  type UIStore,
} from './providers/UIStoreProvider';
