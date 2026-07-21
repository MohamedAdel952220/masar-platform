import { Card, Icon } from '@masar/design-system';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

/**
 * "More" — secondary destinations that do not warrant a bottom tab. Every
 * target is ≥44px (§21).
 */

interface Item {
  to: string;
  label: string;
  hint: string;
  icon: string;
}

const ITEMS: Item[] = [
  { to: '/pickup', label: 'Child pickup', hint: 'Who is still here, and the bus run', icon: 'baby' },
  { to: '/notifications', label: 'Updates', hint: 'Messages and alerts for this desk', icon: 'bell' },
  { to: '/settings', label: 'Settings', hint: 'Language, notifications and sign out', icon: 'settings' },
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
