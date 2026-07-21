import { Avatar, Badge, Button, Card } from '@masar/design-system';
import { useLocale } from '@masar/i18n';
import {
  CHILD_TRIP_STATUS_LABEL,
  CHILD_TRIP_STATUS_TONE,
  LEG_PRIMARY_ACTION,
  TRIP_LEG_LABEL,
  type ChildTripStatus,
  type TripLeg,
} from '../lib/enums';
import type { DriverChild } from '../lib/useDriverChildren';

/**
 * One rider on the manifest, with its status control.
 *
 * The child record comes from `children_driver_safe()`, so the fields shown
 * here are all the driver has: name and address. That is the whole point — see
 * `lib/driver.ts`.
 *
 * Two actions, both a single tap, both ≥56px:
 *   - the leg's primary action (board in the morning, drop off in the
 *     afternoon), and
 *   - "not travelling", which a driver needs constantly and which is otherwise
 *     the kind of thing that gets fixed by phoning the office.
 *
 * There is no free-text field and no confirmation dialog. A dialog on a moving
 * bus is a second thing to aim at; the safeguard here is that the action is
 * withdrawn after a failure, not that it is hard to press.
 */
export function RiderCard({
  child,
  childId,
  status,
  leg,
  disabled,
  locked,
  failed,
  onUpdate,
}: {
  /** Null when the manifest references a child the gated view did not return. */
  child: DriverChild | null;
  childId: string;
  status: ChildTripStatus;
  leg: TripLeg;
  /** True when no trip is active — the manifest is then read-only. */
  disabled: boolean;
  locked: boolean;
  failed: boolean;
  onUpdate: (childId: string, next: ChildTripStatus) => void;
}) {
  const { locale } = useLocale();
  const primary = LEG_PRIMARY_ACTION[leg];
  const done = status === primary;
  const absent = status === 'absent';

  const name = child ? (locale === 'ar' && child.name_ar ? child.name_ar : child.name) : null;

  return (
    <Card padding="md" accent={failed ? 'var(--status-live)' : undefined}>
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Avatar name={name ?? '?'} size={44} />
          <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--weight-bold)',
                color: 'var(--text-strong)',
              }}
            >
              {name ?? 'Rider'}
            </span>
            {child?.address_line ? (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {child.address_line}
              </span>
            ) : null}
          </div>
          <Badge tone={CHILD_TRIP_STATUS_TONE[status]} dot>
            {CHILD_TRIP_STATUS_LABEL[status]}
          </Badge>
        </div>

        {failed ? (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-body)' }}>
            That change did not save. Do not tap again — refresh and check this rider&apos;s current state
            first.
          </span>
        ) : disabled ? null : (
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button
              size="lg"
              disabled={locked || done || absent}
              onClick={() => onUpdate(childId, primary)}
              style={{ flex: 2, minHeight: 56 }}
            >
              {done
                ? CHILD_TRIP_STATUS_LABEL[primary]
                : locked
                  ? 'Saving…'
                  : leg === 'am'
                    ? 'On board'
                    : 'Dropped off'}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              disabled={locked || absent}
              onClick={() => onUpdate(childId, 'absent')}
              style={{ flex: 1, minHeight: 56 }}
            >
              {absent ? 'Not travelling' : 'Absent'}
            </Button>
          </div>
        )}

        {disabled ? (
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-subtle)' }}>
            {TRIP_LEG_LABEL[leg]} run is not active — this is a record, not a control.
          </span>
        ) : null}
      </div>
    </Card>
  );
}
