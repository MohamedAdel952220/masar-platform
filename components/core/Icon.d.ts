import React from 'react';

export interface IconProps {
  /** Lucide icon name, e.g. "bus", "qr-code". */
  name: string;
  /** @default 20 */
  size?: number;
  /** @default "currentColor" */
  color?: string;
  /** @default 2 */
  strokeWidth?: number;
  style?: React.CSSProperties;
}

export function Icon(props: IconProps): JSX.Element;
