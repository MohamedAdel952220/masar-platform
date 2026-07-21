import { useAuth } from '@masar/auth';
import { useSignOut } from '../lib/useSignOut';
import { Badge, Button, Icon } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { NavLink, Outlet } from 'react-router-dom';
import { tierLabel, tierTone } from '../lib/tier';

/**
 * Console chrome: top bar + side navigation.
 *
 * Uses design-system primitives (Badge, Button, Icon) and tokens only. Layout
 * uses logical properties so a single implementation serves LTR and RTL (§20).
 *
 * The @masar/design-system AppShell is intentionally not used here: it paints
 * `var(--surface-app)`, which is not a real token, and the design system is
 * frozen for this phase. The portal composes the same structure with the
 * correct `--bg-app` background instead (see the completion report).
 */

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: 'layout-dashboard', end: true },
  { to: '/service-health', label: 'Service Health', icon: 'activity' },
  { to: '/system-health', label: 'System Health', icon: 'server-cog' },
  { to: '/support', label: 'Support Tickets', icon: 'life-buoy' },
  { to: '/billing', label: 'Tenant Billing', icon: 'wallet' },
  { to: '/analytics', label: 'Analytics', icon: 'bar-chart-3' },
  { to: '/audit', label: 'Activity & Audit', icon: 'scroll-text' },
];

export function ConsoleLayout() {
  const handleSignOut = useSignOut();
  const { claims } = useAuth();
  const { locale, direction, setLocale } = useLocale();

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
            Masar · Platform Admin
          </span>
          <Badge tone={tierTone(claims.platformAdminTier)}>{tierLabel(claims.platformAdminTier)}</Badge>
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
            width: 232,
            flex: 'none',
            padding: 'var(--space-5) var(--space-4)',
            background: 'var(--surface-card)',
            borderInlineEnd: '1px solid var(--border-subtle)',
            display: 'grid',
            gap: 'var(--space-1)',
            alignContent: 'start',
          }}
        >
          {NAV.map((item) => (
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
        </nav>

        <main
          dir={direction}
          style={{
            flex: 1,
            minWidth: 0,
            padding: 'var(--space-7) var(--space-7)',
            maxWidth: 1280,
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
