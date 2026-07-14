import React from 'react';

export interface BadgeProps {
  children?: React.ReactNode;
  /** Color family. @default "neutral" */
  tone?: 'neutral' | 'teal' | 'amber' | 'success' | 'danger' | 'info';
  /** Filled background instead of tinted surface. @default false */
  solid?: boolean;
  /** Show a leading status dot. @default false */
  dot?: boolean;
  style?: React.CSSProperties;
}

export function Badge(props: BadgeProps): JSX.Element;
