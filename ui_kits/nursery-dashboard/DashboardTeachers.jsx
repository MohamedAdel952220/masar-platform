const { useState: useStateT } = React;

/* ====================================================================
   Masar — Dashboard · Teachers (full CRUD + profile + leave + report)
   ==================================================================== */
const DT_MGR = 'var(--role-manager)';
const SUBJECT_OPTS = ['English', 'Math', 'Arabic', 'Science', 'Art', 'Music', 'Play', 'Phonics'];
const ROOM_OPTS = ['KG2 · Sunflower', 'KG1 · Tulip', 'KG2 · Rose', 'KG1 · Daisy'];

const SEED_TEACHERS = [
  {
    id: 't1', name: 'Sara Mahmoud', subjects: ['English', 'Math'], room: 'KG2 · Sunflower', children: 18, reportsState: 'ok', photo: null,
    phone: '+20 109 876 5432', email: 'sara.m@sunrise.edu', nid: '28805121900713', joinDate: '2022-09-01', status: 'active',
    classes: [
      { room: 'KG2 · Sunflower', subject: 'English', days: 'Sun–Thu', sessions: 5 },
      { room: 'KG2 · Sunflower', subject: 'Math', days: 'Sun, Tue, Thu', sessions: 3 },
      { room: 'KG2 · Rose', subject: 'English', days: 'Mon, Wed', sessions: 2 },
    ],
    daysPerWeek: 5, sessionsPerWeek: 10, rating: 4.8,
    complaints: [],
    commends: [{ from: 'Mohamed Adel', text: 'Yousef loves her English class — wonderful teacher.', date: 'Jun 18' }],
  },
  {
    id: 't2', name: 'Hala Nabil', subjects: ['Arabic', 'Art'], room: 'KG1 · Tulip', children: 16, reportsState: 'pending', photo: null,
    phone: '+20 100 444 3322', email: 'hala.n@sunrise.edu', nid: '29002182100415', joinDate: '2023-02-15', status: 'active',
    classes: [
      { room: 'KG1 · Tulip', subject: 'Arabic', days: 'Sun–Thu', sessions: 5 },
      { room: 'KG1 · Tulip', subject: 'Art', days: 'Mon, Wed', sessions: 2 },
      { room: 'KG1 · Daisy', subject: 'Art', days: 'Tue', sessions: 1 },
    ],
    daysPerWeek: 5, sessionsPerWeek: 8, rating: 4.2,
    complaints: [{ from: 'Tarek Nabil', subject: 'Behavior', text: 'Felt Malak’s concern wasn’t followed up quickly.', level: 'attention', date: 'Jun 22' }],
    commends: [],
  },
  {
    id: 't3', name: 'Mona Saleh', subjects: ['Music', 'Play'], room: 'KG1 · Daisy', children: 15, reportsState: 'ok', photo: null,
    phone: '+20 102 777 1199', email: 'mona.s@sunrise.edu', nid: '28709231800621', joinDate: '2021-09-01', status: 'active',
    classes: [
      { room: 'KG1 · Daisy', subject: 'Music', days: 'Sun, Tue, Thu', sessions: 3 },
      { room: 'KG1 · Tulip', subject: 'Music', days: 'Mon', sessions: 1 },
      { room: 'KG2 · Sunflower', subject: 'Play', days: 'Wed', sessions: 1 },
    ],
    daysPerWeek: 4, sessionsPerWeek: 5, rating: 4.9,
    complaints: [],
    commends: [{ from: 'Mostafa Ali', text: 'Jana sings her songs all weekend!', date: 'Jun 10' }],
  },
  {
    id: 't4', name: 'Yasmin Adel', subjects: ['Science'], room: 'KG2 · Rose', children: 17, reportsState: 'ok', photo: null,
    phone: '+20 106 222 8844', email: 'yasmin.a@sunrise.edu', nid: '29105142000913', joinDate: '2023-09-01', status: 'leave',
    leave: { from: 'Jun 24', to: 'Jun 28', reason: 'Family emergency', sub: 'Mona Saleh' },
    classes: [
      { room: 'KG2 · Rose', subject: 'Science', days: 'Sun–Thu', sessions: 5 },
      { room: 'KG2 · Sunflower', subject: 'Science', days: 'Mon, Wed', sessions: 2 },
    ],
    daysPerWeek: 5, sessionsPerWeek: 7, rating: 4.6,
    complaints: [],
    commends: [],
  },
  {
    id: 't5', name: 'Dina Saad', role: 'reception', subjects: [], room: 'Reception', children: 0, reportsState: 'ok', photo: null,
    phone: '+20 100 321 6677', email: 'dina.s@sunrise.edu', nid: '29203051900512', joinDate: '2023-01-10', status: 'active',
    classes: [], daysPerWeek: 6, sessionsPerWeek: 0, rating: 4.9, complaints: [], commends: [],
  },
];

/* ---------------- Add / Edit form ---------------- */
function TeacherForm({ initial, onClose, onSave }) {
  const F = window.DForms;
  const [t, setT] = useStateT(initial || { name: '', role: 'teacher', subjects: [], room: ROOM_OPTS[0], phone: '', email: '', nid: '', joinDate: '', photo: '', children: 0 });
  const set = (k, v) => setT(p => ({ ...p, [k]: v }));
  const toggleSubj = (s) => setT(p => ({ ...p, subjects: p.subjects.includes(s) ? p.subjects.filter(x => x !== s) : [...p.subjects, s] }));
  const isReception = t.role === 'reception';
  const valid = t.name.trim() && t.phone.trim() && (isReception || t.subjects.length);
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 };
  const accent = isReception ? 'var(--role-supervisor)' : 'var(--role-teacher)';
  const accentSoft = isReception ? '#F6E7DC' : '#EDE8F8';

  return (
    <F.PModal icon={initial ? 'user-pen' : 'user-plus'} title={initial ? (isReception ? 'Edit staff' : 'Edit teacher') : 'Add staff member'} subtitle={initial ? t.name : 'Role, contact & access'} onClose={onClose} accent={accent}
      footer={<React.Fragment>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" fullWidth disabled={!valid} iconLeft={<Icon name="check" size={16} />} onClick={() => onSave(t)}>{initial ? 'Save changes' : (isReception ? 'Add staff' : 'Add teacher')}</Button>
      </React.Fragment>}>

      {/* Role selector */}
      <F.PSection icon="id-card" title="Role & app access">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
          {[
            { v: 'teacher', icon: 'graduation-cap', label: 'Teacher', desc: 'Teaches classes · Teacher App', c: 'var(--role-teacher)' },
            { v: 'reception', icon: 'concierge-bell', label: 'Reception staff', desc: 'Front desk · Reception App', c: 'var(--role-supervisor)' },
          ].map(o => {
            const on = t.role === o.v;
            return (
              <button key={o.v} onClick={() => set('role', o.v)} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 15px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? o.c : 'var(--border-subtle)'}`, background: on ? `color-mix(in srgb, ${o.c} 9%, transparent)` : 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${o.c} 14%, transparent)`, color: o.c, display: 'grid', placeItems: 'center' }}><Icon name={o.icon} size={19} /></span>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${on ? o.c : 'var(--border-strong)'}`, display: 'grid', placeItems: 'center' }}>{on && <span style={{ width: 10, height: 10, borderRadius: '50%', background: o.c }} />}</span>
                </span>
                <span><span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)' }}>{o.label}</span><span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{o.desc}</span></span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12, padding: '10px 13px', borderRadius: 'var(--radius-md)', background: accentSoft }}>
          <Icon name="key-round" size={16} color={accent} />
          <span style={{ fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.5 }}>A sign-in account for the <b>{isReception ? 'Reception App' : 'Teacher App'}</b> is created automatically and sent to this person.</span>
        </div>
      </F.PSection>

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0' }} />

      <F.PSection icon={isReception ? 'concierge-bell' : 'graduation-cap'} title={isReception ? 'Staff details' : 'Teacher details'}>
        <div style={{ display: 'flex', gap: 18, marginBottom: 18 }}>
          <F.PPhoto name={t.name} photo={t.photo} onChange={v => set('photo', v)} color={accent} />
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <F.PField label="Full name" required span={2}><F.PInput value={t.name} onChange={v => set('name', v)} placeholder="Full name" /></F.PField>
            <F.PField label="Phone" required><F.PInput value={t.phone} onChange={v => set('phone', v)} placeholder="+20 …" icon="phone" /></F.PField>
            <F.PField label="Email"><F.PInput value={t.email} onChange={v => set('email', v)} placeholder="name@nursery.edu" icon="mail" /></F.PField>
          </div>
        </div>
        <div style={grid2}>
          <F.PField label="National ID"><F.PInput value={t.nid} onChange={v => set('nid', v)} placeholder="14 digits" /></F.PField>
          <F.PField label="Join date"><F.PInput type="date" value={t.joinDate} onChange={v => set('joinDate', v)} /></F.PField>
        </div>
      </F.PSection>

      {!isReception && <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0' }} />}

      {!isReception && (
      <F.PSection icon="book-open" title="Subjects & assignment">
        <F.PField label="Subjects taught" required hint="Tap all that apply">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
            {SUBJECT_OPTS.map(s => {
              const on = t.subjects.includes(s);
              return <button key={s} onClick={() => toggleSubj(s)} style={{ height: 36, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: `1.5px solid ${on ? 'var(--role-teacher)' : 'var(--border-subtle)'}`, background: on ? '#EDE8F8' : 'var(--surface-card)', color: on ? 'var(--role-teacher)' : 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{on && <Icon name="check" size={14} />}{s}</button>;
            })}
          </div>
        </F.PField>
        <div style={{ marginTop: 18 }}>
          <F.PField label="Primary classroom" hint="Where this teacher is mainly based"><F.PSelect value={t.room} onChange={v => set('room', v)} options={ROOM_OPTS} /></F.PField>
        </div>
      </F.PSection>
      )}
    </F.PModal>
  );
}

/* ---------------- Leave form ---------------- */
function LeaveForm({ teacher, onClose, onSave }) {
  const F = window.DForms;
  const [from, setFrom] = useStateT('');
  const [to, setTo] = useStateT('');
  const [reason, setReason] = useStateT('Annual leave');
  const [note, setNote] = useStateT('');
  const [sub, setSub] = useStateT('');
  const valid = from && to;
  const others = SEED_TEACHERS.filter(x => x.id !== teacher.id).map(x => x.name);

  return (
    <F.PModal icon="plane" title="Schedule leave" subtitle={teacher.name} width={520} onClose={onClose} accent="var(--amber-600)"
      footer={<React.Fragment>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" fullWidth disabled={!valid} iconLeft={<Icon name="check" size={16} />} onClick={() => onSave({ from, to, reason, note, sub })}>Confirm leave</Button>
      </React.Fragment>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <F.PField label="From" required><F.PInput type="date" value={from} onChange={setFrom} /></F.PField>
        <F.PField label="To" required><F.PInput type="date" value={to} onChange={setTo} /></F.PField>
      </div>
      <div style={{ marginBottom: 18 }}>
        <F.PField label="Reason"><F.PSelect value={reason} onChange={setReason} options={['Annual leave', 'Sick leave', 'Family emergency', 'Maternity', 'Personal', 'Other']} /></F.PField>
      </div>
      <div style={{ marginBottom: 18 }}>
        <F.PField label="Note (optional)"><F.PTextarea value={note} onChange={setNote} placeholder="Any details for records…" rows={2} /></F.PField>
      </div>
      <F.PField label="Covering teacher" hint="Optional — who takes the classes meanwhile">
        <F.PSelect value={sub} onChange={setSub} options={[{ v: '', label: 'No cover assigned' }, ...others.map(n => ({ v: n, label: n }))]} />
      </F.PField>
    </F.PModal>
  );
}

/* ---------------- Profile drawer with work report ---------------- */
function TInfoRow({ icon, label, value, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <Icon name={icon} size={16} color="var(--text-subtle)" style={{ flex: 'none' }} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 'none', minWidth: 110 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', textAlign: 'end', marginInlineStart: 'auto' }}>{value || '—'}</span>
    </div>
  );
}
function TPCard({ icon, title, action, children }) {
  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: '16px 18px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <Icon name={icon} size={17} color="var(--role-teacher)" />
        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)' }}>{title}</span>
        {action && <span style={{ marginInlineStart: 'auto' }}>{action}</span>}
      </div>
      {children}
    </div>
  );
}

function TeacherProfile({ teacher, onClose, onEdit, onLeave, onDelete }) {
  const F = window.DForms;
  const t = teacher;
  const onLeaveNow = t.status === 'leave';
  return (
    <F.ProfileDrawer onClose={onClose}>
      <div style={{ background: 'linear-gradient(150deg, #4B3B8F, #3C2E78)', padding: '40px 26px 24px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 22, insetInlineEnd: 22, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(245,243,238,.14)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="x" size={19} color="#F5F3EE" /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={t.name} src={t.photo} size={72} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F3EE' }}>{t.name}</div>
            <div style={{ fontSize: 13.5, color: 'rgba(245,243,238,.75)', marginTop: 3 }}>{t.subjects.join(' · ')}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <Badge tone={onLeaveNow ? 'amber' : 'success'} solid>{onLeaveNow ? 'On leave' : 'Active'}</Badge>
              <Badge tone="violet" solid>★ {t.rating}</Badge>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Button variant="amber" size="sm" iconLeft={<Icon name="user-pen" size={15} />} onClick={onEdit}>Edit details</Button>
          <button onClick={onLeave} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,243,238,.25)', background: 'rgba(245,243,238,.1)', color: '#F5F3EE', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}><Icon name="plane" size={15} />Schedule leave</button>
        </div>
      </div>

      <div style={{ padding: 22 }}>
        {onLeaveNow && t.leave && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 'var(--radius-md)', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', marginBottom: 16 }}>
            <Icon name="plane" size={20} color="var(--amber-700)" style={{ flex: 'none' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--amber-700)' }}>On leave · {t.leave.from} → {t.leave.to}</div>
              <div style={{ fontSize: 12.5, color: 'var(--amber-700)' }}>{t.leave.reason}{t.leave.sub ? ` · covered by ${t.leave.sub}` : ' · no cover'}</div>
            </div>
          </div>
        )}

        {/* work report stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
          {[[t.classes.length, 'Classes'], [t.daysPerWeek + ' d', 'Days / week'], [t.sessionsPerWeek, 'Sessions / wk']].map(([v, l], i) => (
            <div key={i} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--role-teacher)' }}>{v}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        <TPCard icon="contact" title="Contact & record">
          <TInfoRow icon="phone" label="Phone" value={t.phone} mono />
          <TInfoRow icon="mail" label="Email" value={t.email} />
          <TInfoRow icon="id-card" label="National ID" value={t.nid} mono />
          <TInfoRow icon="calendar" label="Joined" value={t.joinDate} />
        </TPCard>

        <TPCard icon="layout-grid" title="Teaching load">
          {t.classes.map((cl, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < t.classes.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: '#EDE8F8', color: 'var(--role-teacher)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="door-open" size={16} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{cl.room} · {cl.subject}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cl.days}</div>
              </div>
              <Badge tone="neutral">{cl.sessions}/wk</Badge>
            </div>
          ))}
        </TPCard>

        <TPCard icon="message-square-warning" title="Parent feedback" action={<Badge tone={t.complaints.length ? 'amber' : 'success'} dot>{t.complaints.length ? `${t.complaints.length} concern${t.complaints.length > 1 ? 's' : ''}` : 'All clear'}</Badge>}>
          {t.complaints.length === 0 && t.commends.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '6px 0' }}>No complaints or concerns on record.</div>}
          {t.complaints.map((c, i) => (
            <div key={'c' + i} style={{ display: 'flex', gap: 11, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--amber-50)', color: 'var(--amber-700)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="flag" size={15} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>{c.subject} · <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{c.from}</span> <span style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>· {c.date}</span></div>
                <div style={{ fontSize: 12.5, color: 'var(--text-body)', marginTop: 2, lineHeight: 1.5 }}>{c.text}</div>
              </div>
            </div>
          ))}
          {t.commends.map((c, i) => (
            <div key={'k' + i} style={{ display: 'flex', gap: 11, padding: '10px 0', borderBottom: i < t.commends.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--success-50)', color: 'var(--success-600)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="heart" size={15} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{c.from}</span> <span style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>· {c.date}</span></div>
                <div style={{ fontSize: 12.5, color: 'var(--text-body)', marginTop: 2, lineHeight: 1.5 }}>{c.text}</div>
              </div>
            </div>
          ))}
        </TPCard>

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <Button variant="secondary" fullWidth iconLeft={<Icon name="file-text" size={15} />}>Export report</Button>
          <button onClick={onDelete} style={{ flex: 1, height: 44, borderRadius: 'var(--radius-md)', border: '1px solid var(--danger-200)', background: 'var(--danger-50)', color: 'var(--danger-600)', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><Icon name="user-minus" size={15} />Suspend account</button>
        </div>
      </div>
    </F.ProfileDrawer>
  );
}

/* ---------------- Teachers view ---------------- */
function TeachersView() {
  const F = window.DForms;
  const [list, setList] = useStateT(SEED_TEACHERS);
  const [form, setForm] = useStateT(null);
  const [profile, setProfile] = useStateT(null);
  const [leave, setLeave] = useStateT(null);
  const [confirm, setConfirm] = useStateT(null);
  const [toast, setToast] = useStateT(null);
  const [account, setAccount] = useStateT(null);

  const save = (t) => {
    if (form.mode === 'edit') { setList(prev => prev.map(x => x.id === t.id ? t : x)); if (profile) setProfile(t); setToast({ msg: 'Staff details updated', icon: 'check' }); }
    else {
      const nt = { ...t, id: 't' + Date.now(), reportsState: 'ok', status: 'active', classes: [], daysPerWeek: 0, sessionsPerWeek: 0, rating: 5.0, complaints: [], commends: [] };
      setList(prev => [nt, ...prev]);
      const app = t.role === 'reception' ? 'reception' : 'teacher';
      const login = (t.email && t.email.trim()) || (t.phone && t.phone.trim()) || t.name;
      setAccount(window.DForms.makeAccount({ app, login, name: t.name }));
    }
    setForm(null);
  };
  const saveLeave = (lv) => {
    setList(prev => prev.map(x => x.id === leave.id ? { ...x, status: 'leave', leave: lv } : x));
    const nt = { ...leave, status: 'leave', leave: lv };
    if (profile) setProfile(nt);
    setLeave(null);
    setToast({ msg: `Leave scheduled for ${leave.name}`, icon: 'plane', tone: 'amber' });
  };
  // suspend-staff-account / reactivate-staff-account (Epic 1 Edge Functions).
  // Suspension now flips status in place (rather than removing the row) so a
  // "Reactivate" touchpoint is meaningful, mirroring the suspend/reactivate
  // button-swap already used for schools in PlatformAdmin's SchoolDetail.
  const doSuspend = async (t) => {
    try {
      await window.MasarClient.suspendStaffAccount(t.id, 'Removed by manager');
      setList(prev => prev.map(x => x.id === t.id ? { ...x, status: 'suspended' } : x));
      setProfile(null);
      setToast({ msg: `${t.name} suspended`, icon: 'user-minus', tone: 'amber' });
    } catch (err) {
      setToast({ msg: window.MasarClient.getErrorMessage(err, 'en'), icon: 'circle-alert', tone: 'amber' });
    }
  };
  const doReactivate = async (t) => {
    try {
      await window.MasarClient.reactivateStaffAccount(t.id);
      setList(prev => prev.map(x => x.id === t.id ? { ...x, status: 'active' } : x));
      setToast({ msg: `${t.name} reactivated`, icon: 'user-check' });
    } catch (err) {
      setToast({ msg: window.MasarClient.getErrorMessage(err, 'en'), icon: 'circle-alert', tone: 'amber' });
    }
  };

  const menuFor = (t) => [
    { icon: 'id-card', label: 'Open profile', onClick: () => setProfile(t) },
    { icon: 'user-pen', label: 'Edit details', onClick: () => setForm({ mode: 'edit', teacher: t }) },
    { icon: 'plane', label: 'Schedule leave', color: 'var(--amber-600)', onClick: () => setLeave(t) },
    { icon: 'file-text', label: 'View work report', onClick: () => setProfile(t) },
    { divider: true },
    t.status === 'suspended'
      ? { icon: 'user-check', label: 'Reactivate account', onClick: () => doReactivate(t) }
      : { icon: 'user-minus', label: 'Suspend account', danger: true, onClick: () => setConfirm(t) },
  ];

  const pending = list.filter(t => t.reportsState === 'pending').length;
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        <StatCard label="Teachers" value={list.length} accent={DT_MGR} icon={<Icon name="graduation-cap" size={16} />} />
        <StatCard label="On leave" value={list.filter(t => t.status === 'leave').length} accent="var(--amber-600)" icon={<Icon name="plane" size={16} />} />
        <StatCard label="Reports pending" value={pending} accent="var(--amber-600)" icon={<Icon name="file-pen" size={16} />} />
      </div>
      <Card padding="none" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Staff</h3>
          <Button variant="primary" size="sm" iconLeft={<Icon name="user-plus" size={16} />} style={{ marginInlineStart: 'auto' }} onClick={() => setForm({ mode: 'add' })}>Add staff</Button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
          <thead><tr style={{ background: 'var(--bg-app)' }}>{['Name', 'Role', 'Subjects / Desk', 'Classroom', 'Reports', ''].map((h, i) => <th key={i} style={{ textAlign: 'start', padding: '11px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>{h}</th>)}</tr></thead>
          <tbody>{list.map(t => { const isRec = t.role === 'reception'; return (
            <tr key={t.id} style={{ borderTop: '1px solid var(--border-subtle)', opacity: t.status === 'leave' || t.status === 'suspended' ? 0.62 : 1 }}>
              <td style={{ padding: '12px 20px' }}><div onClick={() => setProfile(t)} style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }}><Avatar name={t.name} src={t.photo} size={36} /><div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>{t.name}</div>{t.status === 'leave' && <div style={{ fontSize: 11.5, color: 'var(--amber-700)', fontWeight: 600 }}>On leave</div>}{t.status === 'suspended' && <div style={{ fontSize: 11.5, color: 'var(--danger-700)', fontWeight: 600 }}>Suspended</div>}</div></div></td>
              <td style={{ padding: '12px 20px' }}>{isRec ? <Badge tone="amber">Reception</Badge> : <Badge tone="violet">Teacher</Badge>}</td>
              <td style={{ padding: '12px 20px', fontSize: 13.5, color: 'var(--text-body)' }}>{isRec ? 'Front desk' : t.subjects.join(' & ')}</td>
              <td style={{ padding: '12px 20px', fontSize: 13.5, color: 'var(--text-body)' }}>{isRec ? 'Reception' : t.room}</td>
              <td style={{ padding: '12px 20px' }}>{isRec ? <span style={{ fontSize: 13, color: 'var(--text-subtle)' }}>—</span> : t.reportsState === 'pending' ? <Badge tone="amber" dot>Pending</Badge> : <Badge tone="success" dot>Up to date</Badge>}</td>
              <td style={{ padding: '8px 14px', textAlign: 'end' }}><F.Menu items={menuFor(t)} /></td>
            </tr>
          ); })}</tbody>
        </table>
      </Card>

      {form && <TeacherForm initial={form.mode === 'edit' ? form.teacher : null} onClose={() => setForm(null)} onSave={save} />}
      {leave && <LeaveForm teacher={leave} onClose={() => setLeave(null)} onSave={saveLeave} />}
      {profile && <TeacherProfile teacher={profile} onClose={() => setProfile(null)} onEdit={() => setForm({ mode: 'edit', teacher: profile })} onLeave={() => setLeave(profile)} onDelete={() => setConfirm(profile)} />}
      {confirm && <F.ConfirmDialog icon="user-minus" tone="danger" title={`Suspend ${confirm.name}?`} message="This immediately suspends the account and revokes all active sessions. The teacher will no longer be able to sign in until reactivated." confirmLabel="Suspend account" onConfirm={() => { doSuspend(confirm); setConfirm(null); }} onClose={() => setConfirm(null)} />}
      {toast && <F.Toast message={toast.msg} icon={toast.icon} tone={toast.tone} onDone={() => setToast(null)} />}
      {account && <F.AccountCreatedDialog account={account} onClose={() => { setAccount(null); setToast({ msg: 'Staff added · account ready', icon: 'user-plus' }); }} onToast={(m) => setToast({ msg: m, icon: 'send' })} />}
    </div>
  );
}

window.TeachersView = TeachersView;
