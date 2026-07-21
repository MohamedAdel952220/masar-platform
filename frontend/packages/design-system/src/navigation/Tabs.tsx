import { type CSSProperties } from 'react';

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
  style?: CSSProperties;
}

/**
 * Tabs — underline-style segmented navigation. Controlled via value/onChange.
 * items: [{ value, label, count? }].
 */
export function Tabs({ items = [], value, onChange, style = {} }: TabsProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid var(--border-subtle)',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            onClick={() => onChange && onChange(it.value)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'var(--text-base)',
              fontWeight: active ? 'var(--weight-bold)' : 'var(--weight-semibold)',
              color: active ? 'var(--text-strong)' : 'var(--text-muted)',
              transition: 'color var(--dur-fast)',
            }}
          >
            {it.label}
            {typeof it.count === 'number' && (
              <span
                style={{
                  fontSize: 'var(--text-2xs)',
                  fontWeight: 'var(--weight-bold)',
                  color: active ? 'var(--primary)' : 'var(--text-subtle)',
                  background: active ? 'var(--teal-50)' : 'var(--neutral-200)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '1px 7px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {it.count}
              </span>
            )}
            <span
              style={{
                position: 'absolute',
                insetInline: 8,
                bottom: -1,
                height: 2.5,
                borderRadius: 2,
                background: active ? 'var(--primary)' : 'transparent',
                transition: 'background var(--dur-fast)',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
