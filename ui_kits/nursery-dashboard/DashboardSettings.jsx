const { useState: useStateDSet, useRef: useRefDSet } = React;

/* ====================================================================
   Masar — Dashboard · Settings (profile, password, prefs, about, support)
   Exposes window.DashboardSettings({ onLogout })
   ==================================================================== */
const DS_MGR = 'var(--role-manager)';

function DSToggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width: 46, height: 28, borderRadius: 'var(--radius-pill)', border: 'none', background: on ? DS_MGR : 'var(--neutral-300)', position: 'relative', cursor: 'pointer', flex: 'none', padding: 0 }}>
      <span style={{ position: 'absolute', top: 3, insetInlineStart: on ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'inset-inline-start .2s' }} />
    </button>
  );
}
function DSGroup({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>{title}</div>
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}
function DSRow({ icon, iconBg, iconColor, label, sub, right, onClick, danger, last }) {
  return (
    <button onClick={onClick} disabled={!onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: last ? 'none' : '1px solid var(--border-subtle)', cursor: onClick ? 'pointer' : 'default', textAlign: 'start' }}>
      {icon && <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: iconBg || 'var(--surface-raised)', color: danger ? 'var(--danger-500)' : (iconColor || 'var(--text-body)'), display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={19} /></span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: danger ? 'var(--danger-500)' : 'var(--text-strong)' }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</span>}
      </span>
      {right}
    </button>
  );
}

const dsField = { width: '100%', padding: '12px 14px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14.5, fontFamily: 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };
const dsLbl = { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)', marginBottom: 7 };

/* ---- Edit profile ---- */
function DSEditProfile({ profile, onClose, onSave }) {
  const F = window.DForms;
  const [p, setP] = useStateDSet(profile);
  const fileRef = useRefDSet(null);
  const onFile = (e) => { const f = e.target.files && e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => setP(x => ({ ...x, photo: ev.target.result })); r.readAsDataURL(f); } };
  return (
    <F.PModal icon="user-pen" title="Edit profile" subtitle={p.name} width={520} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" fullWidth iconLeft={<Icon name="check" size={16} />} onClick={() => onSave(p)}>Save changes</Button></React.Fragment>}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
        <div onClick={() => fileRef.current && fileRef.current.click()} style={{ position: 'relative', cursor: 'pointer' }}>
          <Avatar name={p.name} src={p.photo} size={88} />
          <span style={{ position: 'absolute', bottom: 0, insetInlineEnd: 0, width: 30, height: 30, borderRadius: '50%', background: DS_MGR, border: '2px solid var(--surface-card)', display: 'grid', placeItems: 'center' }}><Icon name="camera" size={15} color="#fff" /></span>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}><label style={dsLbl}>Full name</label><input value={p.name} onChange={e => setP(x => ({ ...x, name: e.target.value }))} style={dsField} /></div>
      <div style={{ marginBottom: 16 }}><label style={dsLbl}>Role / title</label><input value={p.role} onChange={e => setP(x => ({ ...x, role: e.target.value }))} style={dsField} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div><label style={dsLbl}>Email</label><input value={p.email} onChange={e => setP(x => ({ ...x, email: e.target.value }))} style={dsField} /></div>
        <div><label style={dsLbl}>Phone</label><input value={p.phone} onChange={e => setP(x => ({ ...x, phone: e.target.value }))} style={dsField} /></div>
      </div>
    </F.PModal>
  );
}

/* ---- Change password ---- */
function DSChangePassword({ onClose, onSaved }) {
  const F = window.DForms;
  const [cur, setCur] = useStateDSet('');
  const [nw, setNw] = useStateDSet('');
  const [cf, setCf] = useStateDSet('');
  const [show, setShow] = useStateDSet(false);
  const strong = nw.length >= 8;
  const match = nw && nw === cf;
  const valid = cur && strong && match;
  const fld = (val, set, ph) => (
    <div style={{ position: 'relative' }}>
      <input type={show ? 'text' : 'password'} value={val} onChange={e => set(e.target.value)} placeholder={ph} style={{ ...dsField, paddingInlineEnd: 44 }} />
    </div>
  );
  return (
    <F.PModal icon="lock-keyhole" title="Change password" subtitle="Keep your console secure" width={480} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="primary" fullWidth disabled={!valid} iconLeft={<Icon name="check" size={16} />} onClick={onSaved}>Update password</Button></React.Fragment>}>
      <div style={{ marginBottom: 16 }}><label style={dsLbl}>Current password</label>{fld(cur, setCur, '••••••••')}</div>
      <div style={{ marginBottom: 16 }}><label style={dsLbl}>New password</label>{fld(nw, setNw, 'At least 8 characters')}
        {nw && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: strong ? 'var(--success-500)' : 'var(--amber-600)' }}><Icon name={strong ? 'check' : 'info'} size={13} color={strong ? 'var(--success-500)' : 'var(--amber-600)'} />{strong ? 'Strong enough' : 'Use 8+ characters'}</div>}
      </div>
      <div style={{ marginBottom: 8 }}><label style={dsLbl}>Confirm new password</label>
        <input type={show ? 'text' : 'password'} value={cf} onChange={e => setCf(e.target.value)} placeholder="Repeat new password" style={{ ...dsField, borderColor: cf && !match ? 'var(--danger-500)' : 'var(--border-subtle)' }} />
        {cf && !match && <div style={{ fontSize: 12, color: 'var(--danger-500)', marginTop: 6 }}>Passwords don’t match</div>}
      </div>
      <button onClick={() => setShow(s => !s)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}><Icon name={show ? 'eye-off' : 'eye'} size={15} color="var(--text-muted)" />{show ? 'Hide' : 'Show'} passwords</button>
    </F.PModal>
  );
}

/* ---- About us ---- */
function DSAbout({ onClose }) {
  const F = window.DForms;
  const stats = [['120+', 'Nurseries'], ['8K+', 'Children'], ['6', 'Cities']];
  return (
    <F.PModal icon="info" title="About Masar" subtitle="The platform behind your console" width={560} onClose={onClose}
      footer={<Button variant="primary" fullWidth onClick={onClose}>Close</Button>}>
      <div style={{ textAlign: 'center', padding: '8px 0 18px' }}>
        <div style={{ width: 76, height: 76, borderRadius: 22, background: 'linear-gradient(160deg, #0F3D38, #0B2E2A)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><MasarMark size={42} light /></div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-strong)' }}>Masar</div>
        <p style={{ margin: '6px auto 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-muted)', maxWidth: 380 }}>One connected platform for nurseries — children, staff, attendance, buses, payments and AI reports, linking managers, teachers, drivers, reception and parents.</p>
      </div>
      <div style={{ display: 'flex', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 16 }}>
        {stats.map(([v, l], i) => <div key={i} style={{ flex: 1, padding: '14px 8px', textAlign: 'center', borderInlineStart: i ? '1px solid var(--border-subtle)' : 'none' }}><div style={{ fontSize: 20, fontWeight: 800, color: DS_MGR }}>{v}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div></div>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {[['globe', 'masar.app', 'Website'], ['mail', 'hello@masar.app', 'General'], ['map-pin', 'New Cairo, Egypt', 'Headquarters']].map(([ic, val, sub], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface-card)' }}>
            <Icon name={ic} size={17} color={DS_MGR} /><div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{val}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{sub}</div></div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>Console v2.4.0 · © 2026 Masar</div>
    </F.PModal>
  );
}

/* ---- Support ---- */
function DSSupport({ onClose, onToast }) {
  const F = window.DForms;
  const [subject, setSubject] = useStateDSet('');
  const [msg, setMsg] = useStateDSet('');
  const faqs = [
    ['How do I add a new child?', 'Go to Children → Add child and fill the enrolment form. A parent account is created automatically.'],
    ['How are AI reports generated?', 'AI Reports → New AI report. Pick a class or children and a topic; AI drafts from evaluations & attendance.'],
    ['Can I schedule announcements?', 'Yes — Overview → Announce lets you pick audience, channels and a send date.'],
  ];
  const [open, setOpen] = useStateDSet(-1);
  return (
    <F.PModal icon="life-buoy" title="Help & support" subtitle="We usually reply within an hour" width={560} onClose={onClose}
      footer={<React.Fragment><Button variant="secondary" onClick={onClose}>Close</Button><Button variant="primary" fullWidth disabled={!subject.trim() || !msg.trim()} iconLeft={<Icon name="send" size={16} />} onClick={() => { onToast('Support request sent — we’ll reply by email'); onClose(); }}>Send request</Button></React.Fragment>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[['message-circle', 'Live chat', '#25D366'], ['phone', 'Call us', DS_MGR]].map(([ic, label, c], i) => (
          <button key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 15px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
            <span style={{ width: 38, height: 38, borderRadius: '50%', background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c, display: 'grid', placeItems: 'center' }}><Icon name={ic} size={19} /></span>
            <div><div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{label}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{i ? '+20 100 000 1234' : 'Mon–Fri, 9–6'}</div></div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Common questions</div>
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 20 }}>
        {faqs.map(([q, a], i) => (
          <div key={i} style={{ borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
            <button onClick={() => setOpen(open === i ? -1 : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'start' }}>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{q}</span>
              <Icon name={open === i ? 'chevron-up' : 'chevron-down'} size={17} color="var(--text-subtle)" />
            </button>
            {open === i && <div style={{ padding: '0 14px 13px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>{a}</div>}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Or send us a message</div>
      <div style={{ marginBottom: 12 }}><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" style={dsField} /></div>
      <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Describe your question or issue…" style={{ ...dsField, minHeight: 96, resize: 'none', lineHeight: 1.5 }} />
    </F.PModal>
  );
}

/* ---- Main settings screen ---- */
function DashboardSettings({ onLogout, profile, setProfile }) {
  const F = window.DForms;
  const [modal, setModal] = useStateDSet(null);
  const [toast, setToast] = useStateDSet(null);
  const [prefs, setPrefs] = useStateDSet({ emailAlerts: true, smsAlerts: false, weeklyDigest: true, twoFA: true, autoReports: false });
  const setPref = (k, v) => setPrefs(p => ({ ...p, [k]: v }));

  return (
    <div style={{ padding: 32, maxWidth: 760 }}>
      {/* profile header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '22px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--teal-50), color-mix(in srgb, var(--amber-50) 60%, transparent))', border: '1px solid var(--border-subtle)', marginBottom: 24 }}>
        <Avatar name={profile.name} src={profile.photo} size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-strong)' }}>{profile.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{profile.role} · Sunrise Nursery</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-subtle)', marginTop: 3 }}>{profile.email} · {profile.phone}</div>
        </div>
        <Button variant="primary" iconLeft={<Icon name="user-pen" size={16} />} onClick={() => setModal('profile')}>Edit profile</Button>
      </div>

      <DSGroup title="Account">
        <DSRow icon="user-round" iconBg="var(--teal-50)" iconColor={DS_MGR} label="Profile details" sub="Name, photo, contact" onClick={() => setModal('profile')} right={<Icon name="chevron-right" size={18} color="var(--text-subtle)" />} />
        <DSRow icon="lock-keyhole" label="Change password" sub="Update your sign-in password" onClick={() => setModal('password')} right={<Icon name="chevron-right" size={18} color="var(--text-subtle)" />} />
        <DSRow icon="shield-check" label="Two-factor authentication" sub="Extra security on sign-in" right={<DSToggle on={prefs.twoFA} onChange={v => setPref('twoFA', v)} />} last />
      </DSGroup>

      <DSGroup title="Notifications">
        <DSRow icon="mail" label="Email alerts" sub="Approvals, payments & concerns" right={<DSToggle on={prefs.emailAlerts} onChange={v => setPref('emailAlerts', v)} />} />
        <DSRow icon="message-square" label="SMS alerts" sub="Urgent items only" right={<DSToggle on={prefs.smsAlerts} onChange={v => setPref('smsAlerts', v)} />} />
        <DSRow icon="calendar-days" label="Weekly digest" sub="Monday summary email" right={<DSToggle on={prefs.weeklyDigest} onChange={v => setPref('weeklyDigest', v)} />} />
        <DSRow icon="sparkles" label="Auto-generate AI reports" sub="Draft monthly reports automatically" right={<DSToggle on={prefs.autoReports} onChange={v => setPref('autoReports', v)} />} last />
      </DSGroup>

      <DSGroup title="Support & info">
        <DSRow icon="life-buoy" iconBg="var(--teal-50)" iconColor={DS_MGR} label="Help & support" sub="Chat, call or send a request" onClick={() => setModal('support')} right={<Icon name="chevron-right" size={18} color="var(--text-subtle)" />} />
        <DSRow icon="info" label="About Masar" sub="Company, contact & version" onClick={() => setModal('about')} right={<Icon name="chevron-right" size={18} color="var(--text-subtle)" />} />
        <DSRow icon="file-text" label="Terms & privacy" onClick={() => setToast('Opening terms…')} right={<Icon name="external-link" size={16} color="var(--text-subtle)" />} last />
      </DSGroup>

      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <DSRow icon="log-out" iconBg="var(--danger-50)" label="Log out" danger onClick={onLogout} last />
      </div>
      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>Masar Console · v2.4.0</div>

      {modal === 'profile' && <DSEditProfile profile={profile} onClose={() => setModal(null)} onSave={(p) => { setProfile(p); setModal(null); setToast('Profile updated'); }} />}
      {modal === 'password' && <DSChangePassword onClose={() => setModal(null)} onSaved={() => { setModal(null); setToast('Password updated'); }} />}
      {modal === 'about' && <DSAbout onClose={() => setModal(null)} />}
      {modal === 'support' && <DSSupport onClose={() => setModal(null)} onToast={(m) => setToast(m)} />}
      {toast && <F.Toast message={toast} icon="check" onDone={() => setToast(null)} />}
    </div>
  );
}

window.DashboardSettings = DashboardSettings;
