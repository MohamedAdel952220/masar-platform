import React from 'react';

export interface DayPathStep {
  label: string;
  /** @default "pending" */
  state?: 'done' | 'live' | 'pending';
  /** Optional timestamp shown under the label. */
  time?: string;
}

export interface DayPathProps {
  steps: DayPathStep[];
  /** @default "horizontal" */
  orientation?: 'horizontal' | 'vertical';
  showLabels?: boolean;
  showTime?: boolean;
  style?: React.CSSProperties;
}

/**
 * Masar's signature day-progression tracker.
 * @startingPoint section="Status" subtitle="Day-path tracker — the brand mark, functional" viewport="700x160"
 */
export function DayPath(props: DayPathProps): JSX.Element;
