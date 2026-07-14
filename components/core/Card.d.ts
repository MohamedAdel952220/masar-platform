import React from 'react';

export interface CardProps {
  children?: React.ReactNode;
  /** @default "md" */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Lift + deepen shadow on hover. @default false */
  interactive?: boolean;
  /** Left accent stripe color (e.g. a role accent token). */
  accent?: string | null;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties;
}

/**
 * Base surface container.
 * @startingPoint section="Core" subtitle="Card surface with optional role accent" viewport="700x220"
 */
export function Card(props: CardProps): JSX.Element;
