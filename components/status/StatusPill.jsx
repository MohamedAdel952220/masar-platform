import React from 'react';

const STATUS = {
  'at-home':   { label: 'At Home',     ar: 'في المنزل',     tone: 'neutral' },
  'in-bus':    { label: 'In Bus',      ar: 'في الباص',      tone: 'amber'   },
  'arrived':   { label: 'Arrived',     ar: 'وصل',           tone: 'teal'    },
  'classroom': { label: 'In Classroom',ar: 'في الفصل',      tone: 'teal'    },
  'playing':   { label: 'Playing',     ar: 'يلعب',          tone: 'teal'    },
  'nap':       { label: 'Nap Time',    ar: 'وقت القيلولة',  tone: 'info'    },
  'left':      { label: 'Left Nursery',ar: 'غادر الحضانة',  tone: 'amber'   },
  'delivered': { label: 'Delivered',   ar: 'تم التسليم',    tone: 'success' },
};

/**
 * StatusPill — the child's current day-state as a colored pill with a live dot.
 * Pass a known status key; set lang="ar" for the Arabic label.
 */
export function StatusPill({ status = 'classroom', lang = 'en', size = 'md', style = {} }) {
  const s = STATUS[status] || STATUS.classroom;
  const tones = {
    neutral: ['var(--neutral-200)', 'var(--neutral-700)', 'var(--neutral-500)'],
    teal:    ['var(--teal-50)', 'var(--teal-700)', 'var(--teal-500)'],
    amber:   ['var(--amber-50)', 'var(--amber-700)', 'var(--amber-500)'],
    info:    ['var(--info-50)', 'var(--info-700)', 'var(--info-500)'],
    success: ['var(--success-50)', 'var(--success-700)', 'var(--success-500)'],
  };
  const [bg, fg, dot] = tones[s.tone];
  const live = s.tone === 'amber';
  const dims = size === 'sm' ? { h: 24, fs: 'var(--text-xs)', pad: '0 10px' } : { h: 30, fs: 'var(--text-sm)', pad: '0 13px' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, height: dims.h, padding: dims.pad,
      background: bg, color: fg, borderRadius: 'var(--radius-pill)',
      fontFamily: lang === 'ar' ? 'var(--font-arabic)' : 'var(--font-sans)',
      fontSize: dims.fs, fontWeight: 'var(--weight-bold)', whiteSpace: 'nowrap', ...style,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: dot, flex: 'none',
        boxShadow: live ? '0 0 0 3px rgba(239,159,39,.22)' : 'none',
      }} />
      {lang === 'ar' ? s.ar : s.label}
    </span>
  );
}
