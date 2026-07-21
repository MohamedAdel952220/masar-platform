import { Avatar, Badge, Icon } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { NavLink, Outlet } from 'react-router-dom';
import { useSelectedChild } from '../lib/selectedChild';

/**
 * Parent App shell — mobile-first: compact top bar, child switcher, bottom tabs.
 *
 * The child switcher is part of the chrome rather than a per-screen control,
 * because almost every screen is scoped to one child and a guardian with two
 * children switches context constantly. It only appears when more than one
 * child is visible — and the list is whatever RLS returned, so a guardian can
 * never switch to a child they cannot see.
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
  { to: '/day', label: 'Day', icon: 'route' },
  { to: '/trip', label: 'Bus', icon: 'bus' },
  { to: '/chat', label: 'Chat', icon: 'message-circle' },
  { to: '/more', label: 'More', icon: 'menu' },
];

export function ParentShell() {
  const { locale, direction, setLocale } = useLocale();
  const { children: kids, selected, setSelectedId } = useSelectedChild();

  return (
    <div
      dir={direction}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}
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
            <Badge tone="teal">Family</Badge>
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
        </div>

        {kids.length > 1 ? (
          <div
            role="group"
            aria-label="Select child"
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              padding: '0 var(--space-5) var(--space-3)',
              overflowX: 'auto',
            }}
          >
            {kids.map((child) => {
              const active = child.id === selected?.id;
              return (
                <button
                  key={child.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(child.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    minHeight: 44,
                    padding: '0 var(--space-3)',
                    flex: 'none',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border-subtle)'),
                    background: active ? 'var(--teal-50)' : 'var(--surface-card)',
                    color: active ? 'var(--primary)' : 'var(--text-body)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: active ? 'var(--weight-bold)' : 'var(--weight-medium)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Avatar name={child.name} size={24} />
                  {child.name}
                </button>
              );
            })}
          </div>
        ) : null}
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
    </div>
  );
}
