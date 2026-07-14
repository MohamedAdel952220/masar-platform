import React from 'react';

export type ChildStatus =
  | 'at-home' | 'in-bus' | 'arrived' | 'classroom'
  | 'playing' | 'nap' | 'left' | 'delivered';

export interface StatusPillProps {
  /** @default "classroom" */
  status?: ChildStatus;
  /** @default "en" */
  lang?: 'en' | 'ar';
  /** @default "md" */
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

/**
 * Current child day-state pill, bilingual.
 * @startingPoint section="Status" subtitle="Child status pill — 8 day states, EN/AR" viewport="700x140"
 */
export function StatusPill(props: StatusPillProps): JSX.Element;
