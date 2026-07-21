import { Badge } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { formatDateTime, formatRelative, minutesSince } from '../lib/format';

/**
 * REQUIRED affordance for every analytics surface
 * (FRONTEND_ARCHITECTURE.md §12, EPIC_10_REVIEW.md M3).
 *
 * The three analytics views read from materialized views that are refreshed by
 * scheduled jobs — and `pg_cron` is not installed on the deployed project, so
 * no refresh currently runs. These figures are therefore NOT live, and the UI
 * must say so rather than presenting them as current.
 *
 * The `computed_at` column exists on all three views precisely so this can be
 * shown; surfacing it is not optional polish.
 */

/** Above this age the data is called out as stale rather than merely dated. */
const STALE_AFTER_MINUTES = 60;

export function StalenessIndicator({ computedAt }: { computedAt: string | null | undefined }) {
  const { locale } = useLocale();
  const age = minutesSince(computedAt);
  const isStale = age === null || age >= STALE_AFTER_MINUTES;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        flexWrap: 'wrap',
      }}
      title={computedAt ? formatDateTime(computedAt, locale) : 'Never computed'}
    >
      <Badge tone={isStale ? 'amber' : 'neutral'} dot>
        {computedAt ? 'Snapshot ' + formatRelative(computedAt, locale) : 'Never computed'}
      </Badge>
      {isStale ? (
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
          Not live — refreshed by a scheduled job, which is not currently registered.
        </span>
      ) : null}
    </span>
  );
}
