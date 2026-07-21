import { Button } from '@masar/design-system';
import type { ReactNode } from 'react';

/**
 * Dense read-only table for the admin console.
 *
 * Composed from tokens + the design system's Button only — it introduces no new
 * visual language. Logical properties (`inset-inline`, `text-align: start`) are
 * used throughout so one implementation serves LTR and RTL (§20).
 *
 * Pagination is cursor/keyset based, matching the api-client read builders —
 * there is no page-number affordance because the backend has no stable offsets.
 */

export interface Column<TRow> {
  key: string;
  header: string;
  /** Cell renderer. Receives the whole row so it can compose badges. */
  render: (row: TRow) => ReactNode;
  /** Right-align numeric columns (start/end aware). */
  numeric?: boolean;
  width?: string;
}

export interface DataTableProps<TRow> {
  columns: Column<TRow>[];
  rows: TRow[];
  rowKey: (row: TRow) => string;
  /** Cursor pagination — omit to render a static table. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  caption?: string;
}

export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  hasMore,
  onLoadMore,
  isLoadingMore,
  caption,
}: DataTableProps<TRow>) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {caption ? (
            <caption
              style={{
                captionSide: 'top',
                textAlign: 'start',
                padding: 'var(--space-4) var(--space-5)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-caps)',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              {caption}
            </caption>
          ) : null}
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={{
                    textAlign: col.numeric ? 'end' : 'start',
                    padding: 'var(--space-3) var(--space-5)',
                    background: 'var(--bg-sunken)',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 'var(--text-2xs)',
                    fontWeight: 'var(--weight-bold)',
                    letterSpacing: 'var(--tracking-caps)',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    width: col.width,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      textAlign: col.numeric ? 'end' : 'start',
                      padding: 'var(--space-3) var(--space-5)',
                      borderBottom: '1px solid var(--border-subtle)',
                      color: 'var(--text-body)',
                      verticalAlign: 'middle',
                      fontVariantNumeric: col.numeric ? 'tabular-nums' : 'normal',
                    }}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && onLoadMore ? (
        <div style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'center' }}>
          <Button variant="secondary" size="sm" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
