import { Card, Icon } from '@masar/design-system';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

/**
 * "More" — the secondary destinations that do not warrant a bottom tab.
 *
 * Mobile convention: five primary tabs, everything else one tap deeper, every
 * target above 44px (§21).
 */

interface Item {
  to: string;
  label: string;
  hint: string;
  icon: string;
}

const ITEMS: Item[] = [
  { to: '/child', label: 'Profile', hint: 'Enrolment, health and family details', icon: 'user' },
  { to: '/attendance', label: 'Attendance', hint: 'Days present this term', icon: 'calendar-check' },
  { to: '/progress', label: 'Progress', hint: 'Lessons and evaluations', icon: 'notebook-pen' },
  { to: '/reports', label: 'Reports', hint: 'Reports sent by the nursery', icon: 'sparkles' },
  { to: '/cameras', label: 'Cameras', hint: "Your child's classroom, when enabled", icon: 'video' },
  { to: '/billing', label: 'Fees', hint: 'Invoices, payments and receipts', icon: 'receipt' },
  { to: '/notifications', label: 'Updates', hint: 'Everything the nursery has sent', icon: 'bell' },
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
