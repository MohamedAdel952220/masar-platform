import { Card, Icon } from '@masar/design-system';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

/**
 * "More" — secondary destinations. Nothing here is needed while the bus is
 * moving; the four hot-path screens have their own tabs.
 *
 * Rows are 64px rather than the 44px §21 floor — see `DriverShell` on gloves
 * and motion.
 */

interface Item {
  to: string;
  label: string;
  hint: string;
  icon: string;
}

const ITEMS: Item[] = [
  { to: '/trips', label: "Today's runs", hint: 'Morning and afternoon', icon: 'list' },
  { to: '/bus', label: 'My bus', hint: 'Vehicle and standing roster', icon: 'bus' },
  { to: '/gps', label: 'Location', hint: 'What the nursery can see', icon: 'satellite' },
  { to: '/notifications', label: 'Updates', hint: 'Messages and alerts', icon: 'bell' },
  { to: '/settings', label: 'Settings', hint: 'Language, notifications, sign out', icon: 'settings' },
];

export function MoreRoute() {
  return (
    <>
      <PageHeader title="More" subtitle="Everything else." />
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {ITEMS.map((item) => (
          <Link key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
            <Card padding="md" interactive>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minHeight: 64 }}>
                <span style={{ color: 'var(--primary)', display: 'inline-flex' }}>
                  <Icon name={item.icon} size={26} />
                </span>
                <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 'var(--text-base)',
                      fontWeight: 'var(--weight-semibold)',
                      color: 'var(--text-strong)',
                    }}
                  >
                    {item.label}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{item.hint}</span>
                </div>
                <span style={{ color: 'var(--text-subtle)', display: 'inline-flex' }}>
                  <Icon name="chevron-right" size={20} />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
