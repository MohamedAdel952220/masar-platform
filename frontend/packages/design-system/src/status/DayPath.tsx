import { Fragment, type CSSProperties } from 'react';

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
  style?: CSSProperties;
}

/**
 * DayPath — Masar's signature component. Renders a child's day as a horizontal
 * (or vertical) sequence of dots: completed steps in teal, the live step in a
 * pulsing amber, upcoming steps hollow. The brand mark, made functional.
 */
export function DayPath({
  steps = [],
  orientation = 'horizontal',
  showLabels = true,
  showTime = true,
  style = {},
}: DayPathProps) {
  const vertical = orientation === 'vertical';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        alignItems: vertical ? 'flex-start' : 'center',
        gap: 0,
        fontFamily: 'var(--font-sans)',
        flexWrap: vertical ? 'nowrap' : 'wrap',
        ...style,
      }}
    >
      {steps.map((s, i) => {
        const state = s.state || 'pending';
        const color =
          state === 'done'
            ? 'var(--status-done)'
            : state === 'live'
              ? 'var(--status-live)'
              : 'var(--status-pending)';
        const last = i === steps.length - 1;
        return (
          <Fragment key={i}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                flexDirection: vertical ? 'row' : 'column',
                minWidth: vertical ? 0 : 56,
              }}
            >
              <span
                style={{
                  width: state === 'live' ? 17 : 13,
                  height: state === 'live' ? 17 : 13,
                  borderRadius: '50%',
                  background: state === 'pending' ? 'transparent' : color,
                  border: `2px solid ${color}`,
                  boxShadow: state === 'live' ? 'var(--shadow-amber)' : 'none',
                  flex: 'none',
                  transition: 'all var(--dur-base) var(--ease-out)',
                }}
              />
              {showLabels && (
                <span
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    textAlign: vertical ? 'start' : 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: state === 'live' ? 'var(--weight-bold)' : 'var(--weight-semibold)',
                      color: state === 'pending' ? 'var(--text-subtle)' : 'var(--text-strong)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.label}
                  </span>
                  {showTime && s.time && (
                    <span
                      style={{
                        fontSize: 'var(--text-2xs)',
                        color: 'var(--text-subtle)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {s.time}
                    </span>
                  )}
                </span>
              )}
            </div>
            {!last && (
              <span
                style={{
                  background: state === 'done' ? 'var(--status-done)' : 'var(--border-subtle)',
                  opacity: state === 'done' ? 0.4 : 1,
                  ...(vertical
                    ? { width: 2, height: 22, marginInlineStart: 7 }
                    : { height: 2, flex: 1, minWidth: 18, marginTop: showLabels ? -18 : 0 }),
                }}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
