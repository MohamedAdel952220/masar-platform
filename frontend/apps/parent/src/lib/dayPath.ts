import type { ChildStatus } from '@masar/design-system';

/**
 * The database enum and the design system's `StatusPill` disagree on spelling:
 * `academic.day_path_status` is snake_case (`at_home`), `ChildStatus` is
 * kebab-case (`at-home`) and carries two extra presentation-only states
 * (`arrived`, `left`) that no column ever produces.
 *
 * Mapping in one place keeps that mismatch from being re-derived on every
 * screen. The design system is frozen for this phase; if it is ever reopened,
 * aligning `ChildStatus` with the deployed enum would delete this file.
 */

const TO_PILL: Record<string, ChildStatus> = {
  at_home: 'at-home',
  in_bus: 'in-bus',
  classroom: 'classroom',
  playing: 'playing',
  nap: 'nap',
  delivered: 'delivered',
};

export function toChildStatus(status: string | null | undefined): ChildStatus {
  return TO_PILL[status ?? ''] ?? 'classroom';
}

/** Human label for a day-path status, used where a pill would be too heavy. */
const LABEL: Record<string, string> = {
  at_home: 'At home',
  in_bus: 'On the bus',
  classroom: 'In classroom',
  playing: 'Playing',
  nap: 'Nap time',
  delivered: 'Delivered home',
};

export function dayPathLabel(status: string | null | undefined): string {
  return LABEL[status ?? ''] ?? status ?? 'Unknown';
}

/**
 * The order a normal day runs in, used to render the remainder of the day as
 * pending steps rather than showing only what has already happened. This is
 * presentation only — the authoritative sequence is whatever
 * `day_path_events` actually recorded.
 */
export const DAY_PATH_SEQUENCE = ['at_home', 'in_bus', 'classroom', 'playing', 'nap', 'delivered'] as const;
