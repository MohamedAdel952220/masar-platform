const { useState: useStateF, useRef: useRefF, useEffect: useEffectF } = React;

/* ====================================================================
   Masar — Dashboard · Shared form primitives
   Fields, select, map picker, dropdown menu, confirm dialog, toast.
   Exposes window.DForms = { ... }
   ==================================================================== */

const DF_MGR = 'var(--role-manager)';

const fieldStyle = { width: '100%', padding: '11px 13px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };

function PField({ label, required, hint, children, span }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : 'auto' }}>
      {label && <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)', marginBottom: 6 }}>{label}{required && <span style={{ color: 'var(--danger-500)' }}> *</span>}</label>}
      {children}
      {hint && <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
function PInput({ value, onChange, placeholder, type = 'text', icon }) {
  return (
    <div style={{ position: 'relative' }}>
      {icon && <Icon name={icon} size={16} color="var(--text-subtle)" style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)' }} />}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...fieldStyle, paddingInlineStart: icon ? 38 : 13 }} />
    </div>
  );
}
function PTextarea({ value, onChange, placeholder, rows = 3 }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...fieldStyle, minHeight: rows * 22, resize: 'none', lineHeight: 1.5 }} />;
}
function PSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
      {options.map(o => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  );
}
function PSeg({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: 6, background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', padding: 4 }}>
      {options.map(o => {
        const v = typeof o === 'string' ? o : o.v; const label = typeof o === 'string' ? o : o.label; const on = value === v;
        return <button key={v} onClick={() => onChange(v)} style={{ flex: 1, height: 38, borderRadius: 'var(--radius-sm)', border: 'none', background: on ? 'var(--surface-card)' : 'transparent', boxShadow: on ? 'var(--shadow-sm)' : 'none', color: on ? DF_MGR : 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>;
      })}
    </div>
  );
}

/* Photo upload circle */
function PPhoto({ name, photo, onChange, color = DF_MGR }) {
  const fileRef = useRefF(null);
  const onFile = (e) => { const f = e.target.files && e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => onChange(ev.target.result); r.readAsDataURL(f); } };
  return (
    <div onClick={() => fileRef.current && fileRef.current.click()} style={{ position: 'relative', cursor: 'pointer', width: 'fit-content' }}>
      <Avatar name={name || '?'} src={photo} size={76} />
      <span style={{ position: 'absolute', bottom: -2, insetInlineEnd: -2, width: 28, height: 28, borderRadius: '50%', background: color, border: '2px solid var(--surface-card)', display: 'grid', placeItems: 'center' }}><Icon name="camera" size={14} color="#fff" /></span>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
    </div>
  );
}

/* Section heading inside a form */
function PSection({ icon, title, children }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '6px 0 14px' }}>
        <span style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: 'var(--teal-50)', color: DF_MGR, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={16} /></span>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-strong)' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

/* Modal shell with sticky header/footer */
function PModal({ icon, title, subtitle, onClose, footer, width = 640, children, accent = DF_MGR }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 90, padding: 28 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', width, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--border-subtle)', flex: 'none' }}>
          <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={21} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-strong)' }}>{title}</h3>
            {subtitle && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--surface-raised)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}><Icon name="x" size={18} color="var(--text-body)" /></button>
        </div>
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border-subtle)', flex: 'none' }}>{footer}</div>}
      </div>
    </div>
  );
}

/* Clickable map pin-picker (mock streets) */
function MapPicker({ value, onChange }) {
  const ref = useRefF(null);
  const pick = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    // map to plausible Cairo coords
    const lat = (30.10 - y * 0.14).toFixed(5);
    const lng = (31.30 + x * 0.16).toFixed(5);
    onChange({ x, y, lat, lng });
  };
  return (
    <div>
      <div ref={ref} onClick={pick} style={{ position: 'relative', height: 200, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)', cursor: 'crosshair' }}>
        <svg width="100%" height="100%" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
          <rect width="600" height="200" fill="#E9EEE8" />
          <rect x="30" y="20" width="150" height="60" rx="8" fill="#D7E5D4" /><rect x="380" y="120" width="180" height="70" rx="8" fill="#D7E5D4" />
          <rect x="220" y="30" width="120" height="50" rx="6" fill="#E6E2D6" /><rect x="60" y="120" width="120" height="60" rx="6" fill="#E6E2D6" />
          <g stroke="#fff" strokeWidth="14" strokeLinecap="round"><line x1="-5" y1="100" x2="605" y2="100" /><line x1="200" y1="-5" x2="200" y2="205" /><line x1="420" y1="-5" x2="420" y2="205" /></g>
          <g stroke="#fff" strokeWidth="8" strokeLinecap="round"><line x1="-5" y1="50" x2="605" y2="50" /><line x1="-5" y1="150" x2="605" y2="150" /></g>
        </svg>
        {value && value.x != null && (
          <span style={{ position: 'absolute', left: `${value.x * 100}%`, top: `${value.y * 100}%`, transform: 'translate(-50%,-100%)', pointerEvents: 'none' }}>
            <Icon name="map-pin" size={32} color="var(--danger-500)" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.3))' }} />
          </span>
        )}
        <div style={{ position: 'absolute', top: 10, insetInlineStart: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 'var(--radius-pill)', background: 'rgba(255,255,255,.92)', boxShadow: 'var(--shadow-sm)', fontSize: 11.5, fontWeight: 700, color: 'var(--text-body)' }}>
          <Icon name="hand-pointer" size={13} color={DF_MGR} />Tap map to set location
        </div>
      </div>
      {value && value.lat && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12.5, color: 'var(--text-muted)' }}>
          <Icon name="navigation" size={14} color="var(--success-500)" />
          <span style={{ fontFamily: 'var(--font-mono)' }}>{value.lat}, {value.lng}</span>
          <span style={{ marginInlineStart: 'auto', color: 'var(--success-600)', fontWeight: 700 }}>Pin dropped</span>
        </div>
      )}
    </div>
  );
}

/* Dropdown menu anchored to a trigger button */
function Menu({ items, accent = DF_MGR }) {
  const [open, setOpen] = useStateF(false);
  const ref = useRefF(null);
  useEffectF(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: 'none', background: open ? 'var(--surface-raised)' : 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
        <Icon name="more-horizontal" size={18} color="var(--text-subtle)" />
      </button>
      {open && (
        <div style={{ position: 'absolute', insetInlineEnd: 0, top: 36, width: 216, background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xl)', padding: 6, zIndex: 50 }}>
          {items.map((it, i) => it.divider ? <div key={i} style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 4px' }} /> : (
            <button key={i} onClick={() => { setOpen(false); it.onClick && it.onClick(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'start', color: it.danger ? 'var(--danger-600)' : 'var(--text-body)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-raised)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Icon name={it.icon} size={17} color={it.danger ? 'var(--danger-600)' : (it.color || 'var(--text-muted)')} />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Confirm dialog */
function ConfirmDialog({ icon = 'alert-triangle', tone = 'danger', title, message, confirmLabel = 'Confirm', onConfirm, onClose }) {
  const c = tone === 'danger' ? 'var(--danger-500)' : tone === 'amber' ? 'var(--amber-500)' : DF_MGR;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 95, padding: 28 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', width: 420, maxWidth: '100%', padding: 26, textAlign: 'center' }}>
        <span style={{ width: 60, height: 60, borderRadius: '50%', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}><Icon name={icon} size={30} /></span>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-strong)' }}>{title}</h3>
        <p style={{ margin: '10px auto 22px', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: 320 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <button onClick={() => { onConfirm && onConfirm(); onClose(); }} style={{ flex: 1, height: 44, borderRadius: 'var(--radius-md)', border: 'none', background: c, color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* Toast */
function Toast({ icon = 'check', tone = 'success', message, onDone }) {
  useEffectF(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, []);
  const c = tone === 'success' ? 'var(--success-500)' : tone === 'amber' ? 'var(--amber-500)' : DF_MGR;
  return (
    <div style={{ position: 'fixed', bottom: 28, insetInlineStart: '50%', transform: 'translateX(-50%)', zIndex: 99, display: 'flex', alignItems: 'center', gap: 11, padding: '13px 20px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-dark, #14201E)', boxShadow: 'var(--shadow-xl)', animation: 'dfToast .3s var(--ease-out)' }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={15} color="#fff" /></span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F5F3EE', fontFamily: 'var(--font-sans)' }}>{message}</span>
    </div>
  );
}

/* Profile drawer shell (slides from end) */
function ProfileDrawer({ onClose, children, accent = DF_MGR }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', zIndex: 88, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 560, maxWidth: '100%', height: '100%', background: 'var(--bg-app)', boxShadow: 'var(--shadow-xl)', overflowY: 'auto', animation: 'dfDrawer .32s var(--ease-out)' }}>{children}</div>
    </div>
  );
}

/* ---------------- Account activation (no plaintext secrets, ever) ----------------
   A person's account is created without a usable password. Instead, a one-time
   activation link is sent directly to their own phone (WhatsApp/SMS) — the
   Dashboard never generates, displays, or shares a password on their behalf. */
function makeAccount({ app, login, name, userId }) {
  return { app, login, name, userId, activationSent: true, created: true };
}

const APP_META = {
  parent: { label: 'Parent App', icon: 'users', color: 'var(--primary)' },
  teacher: { label: 'Teacher App', icon: 'graduation-cap', color: 'var(--role-teacher)' },
  reception: { label: 'Reception App', icon: 'concierge-bell', color: 'var(--role-supervisor)' },
  driver: { label: 'Driver App', icon: 'bus', color: 'var(--role-driver)' },
};

/* Dialog shown after creating a person — confirms an activation link was sent
   directly to them; no credential is ever generated, shown, or shared here. */
function AccountCreatedDialog({ account, onClose, onToast }) {
  const meta = APP_META[account.app] || APP_META.parent;
  const [resent, setResent] = useStateF(false);
  const note = `Masar — ${meta.label}\nHi ${account.name}, an activation link has been sent to your phone. Open it to set your own password and sign in.`;
  // regenerate-activation-link (Epic 1 Edge Function) needs the account's real
  // Auth user id. Only accounts created via the live provision-tenant flow
  // carry one (account.userId); staff/teacher accounts created locally have
  // none yet since staff provisioning is Epic 3 scope — see
  // EPIC_1_INTEGRATION_REPORT.md.
  const triggerResend = async (channelMsg) => {
    if (!account.userId) { onToast && onToast(channelMsg); return; }
    try {
      await window.MasarClient.regenerateActivationLink(account.userId);
      onToast && onToast(channelMsg);
    } catch (err) {
      onToast && onToast(window.MasarClient.getErrorMessage(err, 'en'));
    }
  };
  const wa = () => { window.open(`https://wa.me/?text=${encodeURIComponent(note)}`, '_blank'); triggerResend('Activation link resent via WhatsApp'); };
  const sms = () => { triggerResend('Activation link resent by SMS'); };
  const resend = () => { setResent(true); setTimeout(() => setResent(false), 1600); triggerResend('Activation link resent'); };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 96, padding: 28 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', width: 440, maxWidth: '100%', overflow: 'hidden' }}>
        <div style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${meta.color} 92%, #000), color-mix(in srgb, ${meta.color} 70%, #000))`, padding: '26px 24px', textAlign: 'center' }}>
          <span style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(245,243,238,.18)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><Icon name="send" size={30} color="#F5F3EE" /></span>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#F5F3EE' }}>Activation link sent</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(245,243,238,.8)' }}>{account.name} can set their own password and sign in to the {meta.label}</p>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${meta.color} 9%, transparent)`, marginBottom: 16 }}>
            <Icon name={meta.icon} size={18} color={meta.color} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{meta.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <Icon name="at-sign" size={16} color="var(--text-subtle)" />
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)', minWidth: 86 }}>Login</span>
            <span style={{ marginInlineStart: 'auto', fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>{account.login}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 18px', fontSize: 12, color: 'var(--text-muted)' }}>
            <Icon name="shield-check" size={14} color="var(--success-600)" />
            <span>No password is generated or shown here — {account.name} sets their own from the link sent to their phone.</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <button onClick={wa} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '11px 6px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--surface-raised)', cursor: 'pointer' }}><span style={{ width: 36, height: 36, borderRadius: '50%', background: '#25D366', display: 'grid', placeItems: 'center' }}><Icon name="message-circle" size={18} color="#fff" /></span><span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-body)' }}>WhatsApp</span></button>
            <button onClick={sms} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '11px 6px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--surface-raised)', cursor: 'pointer' }}><span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--info-500)', display: 'grid', placeItems: 'center' }}><Icon name="message-square" size={18} color="#fff" /></span><span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-body)' }}>SMS</span></button>
            <button onClick={resend} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '11px 6px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--surface-raised)', cursor: 'pointer' }}><span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--neutral-700)', display: 'grid', placeItems: 'center' }}><Icon name={resent ? 'check' : 'refresh-cw'} size={18} color="#fff" /></span><span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-body)' }}>{resent ? 'Sent' : 'Resend'}</span></button>
          </div>
          <Button variant="primary" fullWidth onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

if (!document.getElementById('df-anim')) {
  const s = document.createElement('style'); s.id = 'df-anim';
  s.textContent = '@keyframes dfToast{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}@keyframes dfDrawer{from{transform:translateX(100%)}to{transform:translateX(0)}}';
  document.head.appendChild(s);
}

window.DForms = { PField, PInput, PTextarea, PSelect, PSeg, PPhoto, PSection, PModal, MapPicker, Menu, ConfirmDialog, Toast, ProfileDrawer, AccountCreatedDialog, makeAccount, fieldStyle };
