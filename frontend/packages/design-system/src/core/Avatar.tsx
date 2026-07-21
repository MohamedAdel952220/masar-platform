import { type CSSProperties } from 'react';

export interface AvatarProps {
  /** Full name — drives initials + deterministic color. */
  name?: string;
  /** Photo URL; falls back to initials when absent. */
  src?: string | null;
  /** Pixel size. @default 40 */
  size?: number;
  /** Corner status dot. */
  status?: 'present' | 'live' | 'absent' | 'offline' | null;
  style?: CSSProperties;
}

/**
 * Avatar for a child or staff member. Falls back to initials on a deterministic
 * tinted background. status adds a small corner indicator dot.
 */
export function Avatar({
  name = '',
  src = null,
  size = 40,
  status = null,
  style = {},
  ...rest
}: AvatarProps) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase() || '–';
  const palette = [
    'var(--teal-600)',
    'var(--role-teacher)',
    'var(--role-driver)',
    'var(--role-supervisor)',
    'var(--role-accountant)',
    'var(--role-support)',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const bg = palette[h % palette.length] ?? 'var(--teal-600)';
  const statusColors = {
    present: 'var(--success-500)',
    live: 'var(--amber-500)',
    absent: 'var(--danger-500)',
    offline: 'var(--neutral-400)',
  };
  const ring = Math.max(8, size * 0.28);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flex: 'none', ...style }} {...rest}>
      {src ? (
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
            display: 'block',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06)',
          }}
        />
      ) : (
        <span
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: bg,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-sans)',
            fontWeight: 'var(--weight-bold)',
            fontSize: size * 0.4,
            letterSpacing: '.01em',
          }}
        >
          {initials}
        </span>
      )}
      {status && (
        <span
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: ring,
            height: ring,
            borderRadius: '50%',
            background: statusColors[status] || 'var(--neutral-400)',
            boxShadow: '0 0 0 2px var(--surface-card)',
          }}
        />
      )}
    </span>
  );
}
