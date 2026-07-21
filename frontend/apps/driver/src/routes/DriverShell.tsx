import { Badge, Icon } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { NavLink, Outlet } from 'react-router-dom';
import { StatusStrip } from '../components/StatusStrip';
import { useTripContext } from '../lib/tripContext';

/**
 * Driver App shell — a phone mounted on a dashboard, operated with one thumb,
 * possibly wearing gloves, by someone who should be looking at the road.
 *
 * ══ MOBILE UX DECISIONS, AND THEIR REASONS ══
 *
 * - **Bigger targets than the other portals.** §21 sets a 44px floor; the tab
 *   bar here is 64px and the primary actions are 56px. 44px is a minimum for a
 *   stationary user, and a driver is neither stationary nor looking.
 * - **Five tabs, no nesting on the hot path.** Home, Trip, Manifest, Route,
 *   More. Everything a driver touches while the bus is moving is one tap deep.
 * - **The status strip is chrome, not content.** Trip state, GPS state and
 *   connectivity are visible on every screen, so "is the nursery still seeing
 *   me?" never requires navigating.
 * - **The offline banner is a full-width bar, not a badge.** Losing signal
 *   changes what the app can do, and that must be impossible to miss.
 * - **No text input anywhere on the trip path.** Every action is a tap. The
 *   only typed field in the entire app is the login form.
 *
 * The design system's AppShell is not used: it paints `var(--surface-app)`,
 * which is not a real token (the paper background is `--bg-app`). The design
 * system is frozen for this phase, so the correct background is applied here
 * and in styles.css — the same approach every earlier portal took.
 */

interface Tab {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const TABS: Tab[] = [
  { to: '/', label: 'Home', icon: 'house', end: true },
  { to: '/trip', label: 'Trip', icon: 'bus' },
  { to: '/manifest', label: 'Riders', icon: 'users' },
  { to: '/route', label: 'Route', icon: 'route' },
  { to: '/more', label: 'More', icon: 'menu' },
];

/** Taller than the 44px floor — see the note above on gloves and motion. */
const TABBAR_HEIGHT = 64;

export function DriverShell() {
  const { locale, direction, setLocale } = useLocale();
  const { gps } = useTripContext();

  return (
    <div
      dir={direction}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-app)',
      }}
    >
      <header
        style={{
          background: 'var(--surface-card)',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'sticky',
          insetBlockStart: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            padding: 'var(--space-4) var(--space-5)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-extra)',
              letterSpacing: 'var(--tracking-tight)',
              color: 'var(--text-strong)',
            }}
          >
            Masar
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Badge tone="teal">Driver</Badge>
            <button
              type="button"
              onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
              aria-label="Toggle language"
              style={{
                minWidth: 48,
                minHeight: 48,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-body)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-bold)',
                cursor: 'pointer',
              }}
            >
              {locale === 'ar' ? 'EN' : 'ع'}
            </button>
          </div>
        </div>

        <StatusStrip />
      </header>

      {!gps.online ? (
        <div
          role="status"
          style={{
            background: 'var(--amber-100, #fdf1d6)',
            borderBottom: '1px solid var(--amber-500, #d99b28)',
            color: 'var(--amber-900, #6b4508)',
            padding: 'var(--space-3) var(--space-5)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-semibold)',
            textAlign: 'center',
          }}
        >
          No connection — your position is not reaching the nursery
        </div>
      ) : null}

      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: 'var(--space-5)',
          paddingBlockEnd: 'calc(' + TABBAR_HEIGHT + 'px + var(--safe-bottom) + var(--space-6))',
          maxWidth: 760,
          width: '100%',
          marginInline: 'auto',
        }}
      >
        <Outlet />
      </main>

      <nav
        aria-label="Primary"
        style={{
          position: 'fixed',
          insetInline: 0,
          insetBlockEnd: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(' + TABS.length + ', 1fr)',
          background: 'var(--surface-card)',
          borderTop: '1px solid var(--border-subtle)',
          paddingBlockEnd: 'var(--safe-bottom)',
          zIndex: 20,
        }}
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end ?? false}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              minHeight: TABBAR_HEIGHT,
              textDecoration: 'none',
              fontSize: 'var(--text-xs)',
              fontWeight: isActive ? 'var(--weight-bold)' : 'var(--weight-medium)',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            })}
          >
            <Icon name={tab.icon} size={26} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
