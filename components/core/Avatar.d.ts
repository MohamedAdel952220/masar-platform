import React from 'react';

export interface AvatarProps {
  /** Full name — drives initials + deterministic color. */
  name?: string;
  /** Photo URL; falls back to initials when absent. */
  src?: string | null;
  /** Pixel size. @default 40 */
  size?: number;
  /** Corner status dot. */
  status?: 'present' | 'live' | 'absent' | 'offline' | null;
  style?: React.CSSProperties;
}

export function Avatar(props: AvatarProps): JSX.Element;
