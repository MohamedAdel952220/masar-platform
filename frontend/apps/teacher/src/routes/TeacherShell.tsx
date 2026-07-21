import { useAuth } from '@masar/auth';
import { Badge, Icon } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { NavLink, Outlet } from 'react-router-dom';

/**
 * Teacher App shell — mobile-first: a compact top bar and a bottom tab bar.
 *
 * This deliberately differs from the desktop consoles' side navigation: the
 * Teacher App is used one-handed, often standing in a classroom, so primary
 * destinations sit within thumb reach and targets meet the 44px minimum (§21).
 *
 * Design-system primitives (Badge, Icon) and tokens only. Logical properties
 * throughout so one implementation serves LTR and RTL (§20).
 *
 * The design system's AppShell is not used: it paints `var(--surface-app)`,
 * which is not a real token (the paper background is `--bg-app`). The design
 * system is frozen for this phase, so the correct background is applied here
 * and in styles.css — the same approach the earlier portals took.
 */

interface Tab {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const TABS: Tab[] = [
  { to: '/', label: 'Home', icon: 'house', end: true },
  { to: '/attendance', label: 'Register', icon: 'clipboard-check' },
  { to: '/students', label: 'Students', icon: 'users' },
  { to: '/chat', label: 'Chat', icon: 'message-circle' },
  { to: '/more', label: 'More', icon: 'menu' },
];

export function TeacherShell() {
  const { claims } = useAuth();
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          padding: 'var(--space-4) var(--space-5)',
          background: 'var(--surface-card)',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'sticky',
          insetBlockStart: 0,
          zIndex: 10,
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
          <Badge tone="teal">Teacher</Badge>
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
          maxWidth: 720,
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
              fontWeight: isActive ? 'var(--weight-bold)' : 'var(--weight-medium)',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            })}
          >
            <Icon name={tab.icon} size={22} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>

      {claims.tenantId ? null : (
        <span
          role="alert"
          style={{
            position: 'fixed',
            insetBlockEnd: 'calc(var(--tabbar-height) + var(--safe-bottom))',
            insetInline: 0,
            padding: 'var(--space-2)',
            textAlign: 'center',
            background: 'var(--amber-50)',
            color: 'var(--amber-700)',
            fontSize: 'var(--text-xs)',
          }}
        >
          Your account is not linked to a nursery.
        </span>
      )}
    </div>
  );
}
