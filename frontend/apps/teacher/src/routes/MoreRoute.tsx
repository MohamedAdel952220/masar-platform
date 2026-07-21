import { Card, Icon } from '@masar/design-system';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

/**
 * "More" — the secondary destinations that do not warrant a bottom tab.
 *
 * Mobile convention: five primary tabs, everything else one tap deeper. This
 * keeps the tab bar within thumb reach and each target above 44px (§21).
 */

interface Item {
  to: string;
  label: string;
  hint: string;
  icon: string;
}

const ITEMS: Item[] = [
  { to: '/classroom', label: 'My classroom', hint: 'Room details and recent lessons', icon: 'school' },
  { to: '/observations', label: 'Observations', hint: "Today's events and open concerns", icon: 'eye' },
  {
    to: '/evaluations',
    label: 'Evaluations',
    hint: 'Record how a child did in a lesson',
    icon: 'notebook-pen',
  },
  {
    to: '/ai/polish',
    label: 'Polish a note',
    hint: 'Tidy a quick note before sharing',
    icon: 'wand-sparkles',
  },
  { to: '/reports', label: 'Reports', hint: 'Draft, review and send family reports', icon: 'sparkles' },
  { to: '/notifications', label: 'Notifications', hint: 'Updates for you', icon: 'bell' },
  { to: '/settings', label: 'Settings', hint: 'Profile, language and notifications', icon: 'settings' },
];

export function MoreRoute() {
  return (
    <>
      <PageHeader title="More" subtitle="Everything else." />
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {ITEMS.map((item) => (
          <Link key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
            <Card padding="md" interactive>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minHeight: 44 }}>
                <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>
                  <Icon name={item.icon} size={22} />
                </span>
                <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{item.hint}</span>
                </div>
                <span style={{ color: 'var(--text-subtle)', display: 'inline-flex' }}>
                  <Icon name="chevron-right" size={18} />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
