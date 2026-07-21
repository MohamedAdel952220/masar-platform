import {
  realtime,
  useAcademicList,
  useRealtimeSubscription,
  useRpcMutation,
  useTransportList,
} from '@masar/api-client';
import { useAuth } from '@masar/auth';
import { Avatar, Badge, Button, Card, Input } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, QueryState } from '../components/States';
import { formatRelative, todayIso } from '../lib/format';
import { CHILD_TRIP_LABEL, isTripActive, legLabel, type ChildTripStatus } from '../lib/transport';

/**
 * Child pickup — who is still in the building, and the bus run if one is under
 * way.
 *
 * ══ PII DISCIPLINE (§12, §28) ══
 *
 * §12 grants reception `R` on children **"all, name/photo/parent only"**. That
 * is narrower than what the row physically contains: `academic.children` also
 * carries date of birth, blood type, allergies, both parents' national IDs and
 * jobs, and the home address. RLS returns those columns — the restriction is on
 * what a front desk has any business displaying.
 *
 * So this screen shows name, day state, and a parent contact number, and
 * nothing else. The parent phone is included because it is the one field a desk
 * genuinely needs (a child not collected by closing time), and §12 names
 * "parent" explicitly. Allergies and medical data are deliberately absent: they
 * belong to the teacher who supervises the child, not to the person opening the
 * door.
 *
 * ══ THE BUS RUN ══
 *
 * `update_child_trip_status` is one of the SEVEN NON-IDEMPOTENT RPCs.
 * `useRpcMutation` hard-codes `retry: false`, and after a failure the control is
 * NOT re-armed — the operator is asked to refresh and check the current state
 * rather than press again. §12 scopes reception's write here narrowly: confirm
 * an already-running trip's per-child status. Creating or editing trips, buses
 * and routes stays with managers and drivers, and no such affordance exists in
 * this app.
 */

export function PickupRoute() {
  const { locale } = useLocale();
  const { claims } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = claims.tenantId ?? '';
  const today = todayIso();

  const [search, setSearch] = useState('');
  /**
   * The child whose status change was last attempted. Set on click and cleared
   * only on success, so the control disappears for the duration of the call AND
   * stays gone after a failure — the non-idempotent rule again: never invite a
   * second press when the first may have landed.
   */
  const [attemptedChildId, setAttemptedChildId] = useState<string | null>(null);

  const children = useAcademicList(tenantId, 'children', { orderBy: 'name', ascending: true, limit: 500 });
  const trips = useTransportList(tenantId, 'trips', { orderBy: 'service_date', limit: 20 });
  const childStatus = useTransportList(tenantId, 'trip_child_status', {
    orderBy: 'status_changed_at',
    limit: 200,
  });

  const activeTrip = useMemo(
    () => (trips.data?.items ?? []).find((t) => t.service_date === today && isTripActive(t.status)) ?? null,
    [trips.data, today],
  );

  const invalidate = useCallback(() => void queryClient.invalidateQueries(), [queryClient]);
  useRealtimeSubscription(
    activeTrip ? realtime.tripStatus(activeTrip.id) : null,
    invalidate,
    Boolean(activeTrip),
  );

  const updateStatus = useRpcMutation('update_child_trip_status', {
    onSuccess: () => {
      setAttemptedChildId(null);
      invalidate();
    },
    onError: () => {
      // Non-idempotent: deliberately not re-armed. See the note above.
    },
  });

  const kids = useMemo(
    () => (children.data?.items ?? []).filter((c) => c.deleted_at === null),
    [children.data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) return kids;
    return kids.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.name_ar ?? '').toLowerCase().includes(q),
    );
  }, [kids, search]);

  /** Children still on site — anything short of having been handed over. */
  const onSite = useMemo(() => filtered.filter((c) => c.day_path_status !== 'delivered'), [filtered]);

  const statusFor = useMemo(() => {
    const map = new Map<string, { status: string; at: string | null }>();
    if (!activeTrip) return map;
    for (const row of childStatus.data?.items ?? []) {
      if (row.trip_id === activeTrip.id)
        map.set(row.child_id, { status: row.status, at: row.status_changed_at });
    }
    return map;
  }, [childStatus.data, activeTrip]);

  const parentPhone = (child: { father_phone: string | null; mother_phone: string | null }) =>
    child.father_phone ?? child.mother_phone ?? null;

  return (
    <>
      <PageHeader
        title="Child pickup"
        subtitle="Who is still here, and today's bus run."
        meta={
          activeTrip ? (
            <Badge tone="teal" dot>
              {legLabel(activeTrip.leg)} run · {activeTrip.status}
            </Badge>
          ) : (
            <Badge tone="neutral">No bus run under way</Badge>
          )
        }
      />

      {updateStatus.error ? (
        <div style={{ marginBlockEnd: 'var(--space-4)' }}>
          <ErrorState error={updateStatus.error} />
          <Card padding="md" accent="var(--status-live)" style={{ marginBlockStart: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
              Do not press again — the change may already have been recorded. Pull to refresh and check the
              child&apos;s current state first.
            </span>
          </Card>
        </div>
      ) : null}

      <div style={{ marginBlockEnd: 'var(--space-4)' }}>
        <Input
          label="Find a child"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type a name"
          autoComplete="off"
        />
      </div>

      <QueryState
        isLoading={children.isLoading}
        error={children.error}
        isEmpty={onSite.length === 0}
        emptyTitle={search.trim().length > 0 ? 'No children match that name' : 'Everyone has been collected'}
        emptyHint={
          search.trim().length > 0
            ? undefined
            : 'Children appear here until a handover is confirmed for them.'
        }
        onRetry={() => void children.refetch()}
      >
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {onSite.map((child) => {
            const tripState = statusFor.get(child.id);
            const phone = parentPhone(child);
            const attempted = attemptedChildId === child.id;
            return (
              <Card key={child.id} padding="md">
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <Avatar name={child.name} size={40} />
                    <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>
                        {locale === 'ar' && child.name_ar ? child.name_ar : child.name}
                      </span>
                      {phone ? (
                        <span dir="ltr" style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                          {phone}
                        </span>
                      ) : null}
                    </div>
                    <Badge tone="neutral" dot>
                      {child.day_path_status}
                    </Badge>
                  </div>

                  {activeTrip ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
                        {tripState
                          ? CHILD_TRIP_LABEL[tripState.status as ChildTripStatus] +
                            (tripState.at ? ' · ' + formatRelative(tripState.at, locale) : '')
                          : 'Not on this run'}
                      </span>
                      {!attempted && tripState && tripState.status === 'picked_up' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={updateStatus.isPending}
                          onClick={() => {
                            setAttemptedChildId(child.id);
                            updateStatus.mutate({
                              p_trip_id: activeTrip.id,
                              p_child_id: child.id,
                              p_status: 'dropped_off',
                            });
                          }}
                        >
                          Mark dropped off
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </QueryState>
    </>
  );
}
