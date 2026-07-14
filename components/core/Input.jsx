import React from 'react';

/**
 * Labeled text input with optional leading icon, helper/error text, and RTL
 * support. Pass dir="rtl" on a parent to flip alignment.
 */
export function Input({ label, hint, error, iconLeft = null, id, style = {}, ...rest }) {
  const inputId = id || `in-${Math.random().toString(36).slice(2, 8)}`;
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-sans)', ...style }}>
      {label && (
        <label htmlFor={inputId} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-body)' }}>{label}</label>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9, height: 44, padding: '0 14px',
        background: 'var(--surface-card)', borderRadius: 'var(--radius-md)',
        border: `1.5px solid ${error ? 'var(--danger-500)' : focus ? 'var(--border-focus)' : 'var(--border-subtle)'}`,
        boxShadow: focus && !error ? 'var(--shadow-focus)' : 'none',
        transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)',
      }}>
        {iconLeft && <span style={{ color: 'var(--text-subtle)', display: 'inline-flex' }}>{iconLeft}</span>}
        <input id={inputId} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'inherit', fontSize: 'var(--text-base)', color: 'var(--text-strong)', minWidth: 0,
          }} {...rest} />
      </div>
      {(hint || error) && (
        <span style={{ fontSize: 'var(--text-xs)', color: error ? 'var(--danger-700)' : 'var(--text-muted)' }}>{error || hint}</span>
      )}
    </div>
  );
}
