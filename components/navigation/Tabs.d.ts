import React from 'react';

export interface TabItem {
  value: string;
  label: string;
  /** Optional count badge. */
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}

export function Tabs(props: TabsProps): JSX.Element;
