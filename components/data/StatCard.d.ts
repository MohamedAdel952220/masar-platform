import React from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  /** Delta text, e.g. "+12%". Omit to hide. */
  delta?: string | null;
  /** @default "up" */
  deltaDir?: 'up' | 'down';
  icon?: React.ReactNode;
  /** Accent for icon tile. @default primary teal */
  accent?: string;
  style?: React.CSSProperties;
}

/**
 * Single dashboard metric tile.
 * @startingPoint section="Data" subtitle="Metric tile with delta + icon" viewport="700x160"
 */
export function StatCard(props: StatCardProps): JSX.Element;
