import { useCommsList, useIdentityList, useRpcMutation, type CommsRow } from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { useSignOut } from '../lib/useSignOut';
import { Avatar, Badge, Button, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, QueryState } from '../components/States';

/**
 * Settings — profile, notification preferences and language.
 *
 * `update_notification_preferences` is one of only two RPCs the architecture
 * permits to update OPTIMISTICALLY (§12: pure toggles whose server outcome is
 * fully determined by the request). This screen nonetheless uses the plain
 * mutation: a preference toggle is not latency-sensitive enough to justify the
 * rollback complexity, and the authoritative row is cheap to await. The
 * optimistic path remains available in `@masar/api-client` if that trade
 * changes.
 *
 * Preferences and profile both return RLS-scoped to this teacher's own rows.
 */

type Preference = CommsRow<'notification_preferences'>;

export function SettingsRoute() {
  const handleSignOut = useSignOut();
  const { locale, setLocale } = useLocale();
  const { claims, session } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  /** identity.staff_profiles.id is the auth user id — the notification recipient key. */
  const userId = session?.user.id ?? null;

  const profile = useIdentityList(tenantId, 'staff_profiles', { orderBy: 'created_at', limit: 5 });
  const preferences = useCommsList(tenantId, 'notification_preferences', {
    orderBy: 'category',
    ascending: true,
    limit: 50,
  });

  const me = useMemo(
    () => (profile.data?.items ?? []).find((p) => p.id === userId) ?? profile.data?.items[0] ?? null,
    [profile.data, userId],
  );
  const prefRows = useMemo(() => preferences.data?.items ?? [], [preferences.data]);

  const updatePreference = useRpcMutation('update_notification_preferences', {
    onSuccess: () => void queryClient.invalidateQueries(),
  });

  return (
    <>
      <PageHeader title="Settings" subtitle="Your profile and how you are notified." />

      <QueryState
        isLoading={profile.isLoading}
        error={profile.error}
        isEmpty={!me}
        emptyTitle="Profile unavailable"
        emptyHint="Your staff profile could not be loaded."
        onRetry={() => void profile.refetch()}
      >
        {me ? (
          <Card padding="lg" style={{ marginBottom: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <Avatar name={me.name} size={56} />
              <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>
                  {me.name}
                </span>
                <span dir="ltr" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  {me.phone}
                </span>
                <Badge tone="teal">{me.role}</Badge>
              </div>
            </div>
          </Card>
        ) : null}
      </QueryState>

      <Card padding="lg" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>Language</span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant={locale === 'en' ? 'primary' : 'secondary'}
              onClick={() => setLocale('en')}
              style={{ flex: 1 }}
            >
              English
            </Button>
            <Button
              variant={locale === 'ar' ? 'primary' : 'secondary'}
              onClick={() => setLocale('ar')}
              style={{ flex: 1 }}
            >
              العربية
            </Button>
          </div>
        </div>
      </Card>

      {updatePreference.error ? (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorState error={updatePreference.error} onRetry={() => updatePreference.reset()} />
        </div>
      ) : null}

      <Card padding="lg" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-strong)' }}>Notifications</span>
          {prefRows.length === 0 ? (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              No preferences set — you receive the nursery defaults.
            </span>
          ) : (
            prefRows.map((pref: Preference) => (
              <div
                key={pref.id}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 44 }}
              >
                <div style={{ display: 'grid', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-strong)' }}>
                    {pref.category}
                  </span>
                  <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                    {pref.channel}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={pref.enabled ? 'primary' : 'secondary'}
                  disabled={updatePreference.isPending}
                  onClick={() =>
                    updatePreference.mutate({
                      p_category: pref.category,
                      p_channel: pref.channel,
                      p_enabled: !pref.enabled,
                    })
                  }
                >
                  {pref.enabled ? 'On' : 'Off'}
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>

      <Button variant="secondary" fullWidth size="lg" onClick={handleSignOut}>
        Sign out
      </Button>
    </>
  );
}
