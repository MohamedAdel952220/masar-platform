import { Badge, Icon } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { NavLink, Outlet } from 'react-router-dom';

/**
 * Reception App shell — a front-desk terminal held or propped at a counter.
 *
 * Five bottom tabs, with **Scan** placed centrally and given a filled treatment
 * rather than sharing the flat icon row. That is not decoration: scanning is
 * the one thing this app exists to do, it happens under time pressure with a
 * queue of parents waiting, and it should be reachable without aiming. Every
 * other destination is a lookup that can wait a second longer.
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
  /** The scan tab renders as a raised primary action. */
  primary?: boolean;
}

const TABS: Tab[] = [
  { to: '/', label: 'Home', icon: 'house', end: true },
  { to: '/visitors', label: 'Visitors', icon: 'users' },
  { to: '/scan', label: 'Scan', icon: 'scan-line', primary: true },
  { to: '/log', label: 'Log', icon: 'list' },
  { to: '/more', label: 'More', icon: 'menu' },
];

export function ReceptionShell() {
  const { locale, direction, setLocale } = useLocale();

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
          <Badge tone="teal">Reception</Badge>
          <button
            type="button"
            onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            aria-label="Toggle language"
            style={{
              minWidth: 44,
              minHeight: 44,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-body)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-bold)',
              cursor: 'pointer',
            }}
          >
            {locale === 'ar' ? 'EN' : 'ع'}
          </button>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: 'var(--space-5)',
          paddingBlockEnd: 'calc(var(--tabbar-height) + var(--safe-bottom) + var(--space-6))',
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
              gap: 3,
              minHeight: 'var(--tabbar-height)',
              textDecoration: 'none',
              fontSize: 'var(--text-2xs)',
              fontWeight: isActive || tab.primary ? 'var(--weight-bold)' : 'var(--weight-medium)',
              color: tab.primary ? 'var(--primary)' : isActive ? 'var(--primary)' : 'var(--text-muted)',
            })}
          >
            {tab.primary ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--primary)',
                  color: 'var(--on-primary, #fff)',
                }}
              >
                <Icon name={tab.icon} size={24} />
              </span>
            ) : (
              <Icon name={tab.icon} size={22} />
            )}
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
