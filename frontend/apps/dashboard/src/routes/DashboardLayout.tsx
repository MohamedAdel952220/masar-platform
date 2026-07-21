import { useAuth } from '@masar/auth';
import { useSignOut } from '../lib/useSignOut';
import { Badge, Button, Icon } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { NavLink, Outlet } from 'react-router-dom';
import { isManager, roleLabel } from '../lib/permissions';

/**
 * Dashboard chrome: top bar + grouped side navigation.
 *
 * Design-system primitives (Badge, Button, Icon) and tokens only. Logical
 * properties throughout so one implementation serves LTR and RTL (§20).
 *
 * The design system's AppShell is not used: it paints `var(--surface-app)`,
 * which is not a real token (the paper background is `--bg-app`). The design
 * system is frozen for this phase, so the correct background is applied here
 * and in styles.css instead — the same approach the Platform Admin console
 * took. See the completion report.
 */

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  /** Hidden from non-managers because every action inside is manager-only. */
  managerOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Home', icon: 'layout-dashboard', end: true },
      { to: '/timeline', label: 'Daily Timeline', icon: 'route' },
      { to: '/analytics', label: 'Analytics', icon: 'bar-chart-3' },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/children', label: 'Children', icon: 'baby' },
      { to: '/classrooms', label: 'Classrooms', icon: 'school' },
      { to: '/teachers', label: 'Staff', icon: 'users' },
    ],
  },
  {
    label: 'Academic',
    items: [
      { to: '/attendance', label: 'Attendance', icon: 'clipboard-check' },
      { to: '/records', label: 'Academic Records', icon: 'notebook-pen' },
      { to: '/reports', label: 'AI Reports', icon: 'sparkles' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/approvals', label: 'Approvals', icon: 'check-check' },
      { to: '/billing', label: 'Billing', icon: 'wallet', managerOnly: true },
      { to: '/cameras', label: 'Cameras', icon: 'video' },
      { to: '/notifications', label: 'Notifications', icon: 'bell' },
      { to: '/settings', label: 'Settings', icon: 'settings', managerOnly: true },
    ],
  },
];

export function DashboardLayout() {
  const handleSignOut = useSignOut();
  const { claims } = useAuth();
  const { locale, direction, setLocale } = useLocale();
  const manager = isManager(claims);

  return (
    <div
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-6)',
          background: 'var(--surface-card)',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'sticky',
          insetBlockStart: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
          <span
            style={{
              fontSize: 'var(--text-md)',
              fontWeight: 'var(--weight-extra)',
              letterSpacing: 'var(--tracking-tight)',
              color: 'var(--text-strong)',
              whiteSpace: 'nowrap',
            }}
          >
            Masar · Dashboard
          </span>
          <Badge tone={manager ? 'teal' : 'info'}>{roleLabel(claims.role)}</Badge>
          {!manager ? <Badge tone="amber">Read-only</Badge> : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            aria-label="Toggle language"
          >
            {locale === 'ar' ? 'EN' : 'ع'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <nav
          aria-label="Primary"
          style={{
            width: 236,
            flex: 'none',
            padding: 'var(--space-5) var(--space-4)',
            background: 'var(--surface-card)',
            borderInlineEnd: '1px solid var(--border-subtle)',
            display: 'grid',
            gap: 'var(--space-5)',
            alignContent: 'start',
            overflowY: 'auto',
          }}
        >
          {NAV.map((group) => {
            const visible = group.items.filter((item) => !item.managerOnly || manager);
            if (visible.length === 0) return null;
            return (
              <div key={group.label} style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <span
                  style={{
                    fontSize: 'var(--text-2xs)',
                    fontWeight: 'var(--weight-bold)',
                    letterSpacing: 'var(--tracking-caps)',
                    textTransform: 'uppercase',
                    color: 'var(--text-subtle)',
                    padding: '0 var(--space-4)',
                    marginBottom: 'var(--space-1)',
                  }}
                >
                  {group.label}
                </span>
                {visible.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end ?? false}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      fontSize: 'var(--text-sm)',
                      fontWeight: isActive ? 'var(--weight-bold)' : 'var(--weight-medium)',
                      color: isActive ? 'var(--primary)' : 'var(--text-body)',
                      background: isActive ? 'var(--teal-50)' : 'transparent',
                      transition: 'background var(--dur-fast) var(--ease-out)',
                    })}
                  >
                    <Icon name={item.icon} size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <main dir={direction} style={{ flex: 1, minWidth: 0, padding: 'var(--space-7)', maxWidth: 1360 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
