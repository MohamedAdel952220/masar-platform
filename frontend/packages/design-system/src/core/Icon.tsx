import { createElement, type CSSProperties } from 'react';

export interface IconProps {
  /** Lucide icon name, e.g. "bus", "qr-code". */
  name: string;
  /** @default 20 */
  size?: number;
  /** @default "currentColor" */
  color?: string;
  /** @default 2 */
  strokeWidth?: number;
  style?: CSSProperties;
}

/** Shape of a Lucide icon child node: [tagName, attributes]. */
type LucideNode = [string, Record<string, unknown>];

declare global {
  interface Window {
    lucide?: { icons?: Record<string, LucideNode[]> };
  }
}

/**
 * Icon — renders a Lucide glyph inline as an SVG (no DOM mutation, so it stays
 * safe across React re-renders). The page must have Lucide's UMD build loaded
 * (https://unpkg.com/lucide) so window.lucide.icons is available.
 */
export function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 2, style = {} }: IconProps) {
  const pascal = String(name)
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
  const node: LucideNode[] =
    (typeof window !== 'undefined' && window.lucide && window.lucide.icons && window.lucide.icons[pascal]) ||
    [];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', flex: 'none', verticalAlign: 'middle', ...style }}
      aria-hidden="true"
    >
      {node.map((c, i) => createElement(c[0], { key: i, ...c[1] }))}
    </svg>
  );
}
