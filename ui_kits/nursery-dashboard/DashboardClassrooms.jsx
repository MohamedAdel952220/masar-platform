const { useState: useStateCls } = React;

/* ====================================================================
   Masar — Dashboard · Classrooms (cards + rich detail page + CRUD)
   ==================================================================== */
const CL_MGR = 'var(--role-manager)';
function clTone(t) { return ({ teal: 'var(--teal-600)', amber: 'var(--amber-600)', info: 'var(--info-500)', violet: 'var(--role-teacher)' })[t] || 'var(--teal-600)'; }

const SEED_ROOMS = [
  { id: 'rm1', name: 'Sunflower', grade: 'KG2', age: '4–5 yrs', teacher: 'Sara Mahmoud', children: 18, cap: 20, tone: 'teal' },
  { id: 'rm2', name: 'Tulip', grade: 'KG1', age: '3–4 yrs', teacher: 'Hala Nabil', children: 16, cap: 20, tone: 'violet' },
  { id: 'rm3', name: 'Daisy', grade: 'KG1', age: '3–4 yrs', teacher: 'Mona Saleh', children: 15, cap: 18, tone: 'amber' },
  { id: 'rm4', name: 'Rose', grade: 'KG2', age: '4–5 yrs', teacher: 'Yasmin Adel', children: 17, cap: 20, tone: 'info' },
];
const GRADE_OPTS = ['KG1', 'KG2', 'Pre-KG', 'Nursery'];
const AGE_OPTS = ['2–3 yrs', '3–4 yrs', '4–5 yrs', '5–6 yrs'];
const TEACHER_OPTS = ['Sara Mahmoud', 'Hala Nabil', 'Mona Saleh', 'Yasmin Adel'];

/* Roster per room (sample names; present/absent vary by day) */
const ROOM_ROSTER = {
  rm1: ['Yousef Adel', 'Omar Khaled', 'Jana Mostafa', 'Adam Sherif', 'Malak Tarek', 'Hana Sami', 'Ziad Amr', 'Retal Hossam', 'Karim Wael', 'Mariam Adel', 'Tia Nader', 'Seif Ehab', 'Laila Magdy', 'Nour Tamer', 'Yahia Ashraf', 'Farida Hany', 'Aly Sherif', 'Kenzy Mostafa'],
  rm2: ['Lina Adel', 'Hamza Tarek', 'Salma Ayman', 'Yassin Fady', 'Talia Ramy', 'Joud Karim', 'Maya Sherif', 'Zeina Adham', 'Omar Hany', 'Layan Sami', 'Adam Wael', 'Sila Nader', 'Kareem Ehab', 'Judy Magdy', 'Nada Tamer', 'Ali Ashraf'],
  rm3: ['Tameem Adel', 'Lara Khaled', 'Yahya Mostafa', 'Celine Sherif', 'Malek Tarek', 'Hayat Sami', 'Zein Amr', 'Reem Hossam', 'Khaled Wael', 'Maria Adel', 'Tara Nader', 'Sama Ehab', 'Lina Magdy', 'Nour Tamer', 'Yousef Ashraf'],
  rm4: ['Adam Sherif', 'Kenzy Tarek', 'Yassin Mostafa', 'Jana Sherif', 'Malak Adel', 'Hana Sami', 'Ziad Amr', 'Retal Hossam', 'Karim Wael', 'Mariam Nader', 'Tia Ehab', 'Seif Magdy', 'Laila Tamer', 'Nour Ashraf', 'Yahia Hany', 'Farida Sami', 'Aly Adel'],
};

/* Day log generator — deterministic per room+date */
const DAYS = [
  { key: '2026-06-23', label: 'Today', sub: 'Tue · Jun 23' },
  { key: '2026-06-22', label: 'Yesterday', sub: 'Mon · Jun 22' },
  { key: '2026-06-21', label: 'Sun', sub: 'Sun · Jun 21' },
  { key: '2026-06-18', label: 'Thu', sub: 'Thu · Jun 18' },
];
const SUBJECTS_BANK = [
  { time: '8:15', subject: 'English', topic: 'Letter Sounds — M', icon: 'book-open', tone: 'teal', teacher: 'Sara Mahmoud' },
  { time: '9:00', subject: 'Arabic', topic: 'حرف الميم', icon: 'pen-tool', tone: 'violet', teacher: 'Hala Nabil' },
  { time: '9:45', subject: 'Math', topic: 'Counting to 20', icon: 'calculator', tone: 'info', teacher: 'Sara Mahmoud' },
  { time: '10:30', subject: 'Music', topic: 'Morning songs', icon: 'music', tone: 'amber', teacher: 'Mona Saleh' },
  { time: '11:15', subject: 'Art', topic: 'Finger painting', icon: 'palette', tone: 'amber', teacher: 'Yasmin Adel' },
];
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function dayLog(roomId, dateKey) {
  const roster = ROOM_ROSTER[roomId] || [];
  const seed = hashStr(roomId + dateKey);
  const absent = [];
  roster.forEach((n, i) => { if ((hashStr(n + dateKey) % 11) === 0) absent.push(n); });
  const nSub = 4 + (seed % 2);
  const subjects = SUBJECTS_BANK.slice(0, nSub);
  const teachers = [...new Set(subjects.map(s => s.teacher))];
  return { roster, absent, present: roster.filter(n => !absent.includes(n)), subjects, teachers };
}
function prettyDate(key) {
  try { const d = new Date(key + 'T00:00:00'); return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return key; }
}
function relLabel(key) {
  if (key === '2026-06-23') return 'Today';
  if (key === '2026-06-22') return 'Yesterday';
  return prettyDate(key).split(',')[0];
}

/* ---------------- Add / Edit form ---------------- */
function ClassroomForm({ initial, onClose, onSave }) {
  const F = window.DForms;
  const cams = (window.MASAR_CAMERAS || []);
  const [r, setR] = useStateCls(initial
    ? { ...initial, cameraIds: initial.cameraIds || cams.filter(c => c.room === `${initial.grade} · ${initial.name}`).map(c => c.id) }
    : { name: '', grade: 'KG2', age: '4–5 yrs', teacher: TEACHER_OPTS[0], cap: 20, tone: 'teal', cameraIds: [] });
  const set = (k, v) => setR(p => ({ ...p, [k]: v }));
  const toggleCam = (id) => setR(p => { const ids = p.cameraIds || []; return { ...p, cameraIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] }; });
  const valid = r.name.trim() && r.cap > 0;
  const selectedIds = r.cameraIds || [];

  return (
    <F.PModal icon={initial ? 'pen' : 'plus'} title={initial ? 'Edit classroom' : 'New classroom'} subtitle={initial ? `${initial.grade} · ${initial.name} Room` : 'Set up a class'} width={560} onClose={onClose}
      footer={<React.Fragment>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" fullWidth disabled={!valid} iconLeft={<Icon name="check" size={16} />} onClick={() => onSave(r)}>{initial ? 'Save changes' : 'Create classroom'}</Button>
      </React.Fragment>}>
      <F.PSection icon="door-open" title="Classroom details">
        <div style={{ marginBottom: 18 }}><F.PField label="Room name" required hint="e.g. Sunflower, Tulip"><F.PInput value={r.name} onChange={v => set('name', v)} placeholder="Room name" /></F.PField></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          <F.PField label="Grade / Level"><F.PSelect value={r.grade} onChange={v => set('grade', v)} options={GRADE_OPTS} /></F.PField>
          <F.PField label="Age range"><F.PSelect value={r.age} onChange={v => set('age', v)} options={AGE_OPTS} /></F.PField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          <F.PField label="Coordinator" hint="Class isn’t tied to one subject"><F.PSelect value={r.teacher} onChange={v => set('teacher', v)} options={TEACHER_OPTS} /></F.PField>
          <F.PField label="Capacity (seats)" hint="Max children"><F.PInput type="number" value={r.cap} onChange={v => set('cap', parseInt(v) || 0)} placeholder="20" /></F.PField>
        </div>
        <F.PField label="Colour tag">
          <div style={{ display: 'flex', gap: 10 }}>
            {['teal', 'violet', 'amber', 'info'].map(t => { const on = r.tone === t; return <button key={t} onClick={() => set('tone', t)} style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', border: `2px solid ${on ? 'var(--text-strong)' : 'transparent'}`, background: clTone(t), cursor: 'pointer' }} />; })}
          </div>
        </F.PField>
      </F.PSection>

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '18px 0' }} />

      <F.PSection icon="video" title="Cameras in this room">
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>Select which cameras belong to this classroom. Parents of this class will see exactly these feeds.</div>
        {cams.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cams.map(c => {
              const on = selectedIds.includes(c.id);
              return (
                <button key={c.id} onClick={() => toggleCam(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? CL_MGR : 'var(--border-subtle)'}`, background: on ? 'var(--teal-50)' : 'var(--surface-card)', cursor: 'pointer', textAlign: 'start', width: '100%' }}>
                  <span style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', color: CL_MGR, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="video" size={16} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{c.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>{c.zone} · {c.res} · {c.online ? 'Online' : 'Offline'}</div></div>
                  <span style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? CL_MGR : 'var(--border-strong)'}`, background: on ? CL_MGR : 'transparent', display: 'grid', placeItems: 'center', flex: 'none' }}>{on && <Icon name="check" size={14} color="#fff" />}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 0' }}>No cameras registered yet. Add cameras from the Cameras tab first.</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '11px 14px', borderRadius: 'var(--radius-md)', background: 'var(--teal-50)', border: '1px solid var(--teal-100)' }}>
          <Icon name="shield-check" size={17} color="var(--teal-600)" />
          <span style={{ fontSize: 12.5, color: 'var(--teal-800)', lineHeight: 1.5 }}><b>{selectedIds.length} selected.</b> Only parents of children in this room can view these cameras in the Parent App.</span>
        </div>
      </F.PSection>
    </F.PModal>
  );
}

/* ---------------- Detail page ---------------- */
function ClassroomDetail({ room, onBack, onEdit }) {
  const F = window.DForms;
  const [dayKey, setDayKey] = useStateCls(DAYS[0].key);
  const [viewCam, setViewCam] = useStateCls(null);
  const col = clTone(room.tone);
  const roomLabel = `${room.grade} · ${room.name}`;
  const allCams = (window.MASAR_CAMERAS || []);
  const cams = room.cameraIds ? allCams.filter(c => room.cameraIds.includes(c.id)) : allCams.filter(c => c.room === roomLabel);
  const log = dayLog(room.id, dayKey);
  const seatsFree = room.cap - room.children;
  const dayLbl = relLabel(dayKey);
  const attendPct = Math.round(log.present.length / log.roster.length * 100);

  return (
    <div>
      {/* hero header */}
      <div style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${col} 92%, #000), color-mix(in srgb, ${col} 70%, #000))`, padding: '22px 32px 26px' }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 13px', borderRadius: 'var(--radius-pill)', border: '1px solid rgba(245,243,238,.28)', background: 'rgba(245,243,238,.12)', color: '#F5F3EE', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 18 }}><Icon name="arrow-left" size={16} color="#F5F3EE" />All classrooms</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ width: 60, height: 60, borderRadius: 'var(--radius-lg)', background: 'rgba(245,243,238,.16)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="door-open" size={30} color="#F5F3EE" /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#F5F3EE' }}>{room.name} Room</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6, fontSize: 13.5, color: 'rgba(245,243,238,.85)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="graduation-cap" size={15} color="rgba(245,243,238,.85)" />{room.grade} · {room.age}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="user-round" size={15} color="rgba(245,243,238,.85)" />Coordinator: {room.teacher}</span>
            </div>
          </div>
          <Button variant="amber" iconLeft={<Icon name="pen" size={16} />} onClick={onEdit}>Edit classroom</Button>
        </div>
      </div>

      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* capacity / seats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
          <StatCard label="Capacity" value={room.cap} unit="seats" accent={CL_MGR} icon={<Icon name="layout-grid" size={16} />} />
          <StatCard label="Enrolled" value={room.children} accent={col} icon={<Icon name="users" size={16} />} />
          <StatCard label="Seats free" value={seatsFree} accent={seatsFree > 0 ? 'var(--success-500)' : 'var(--danger-500)'} icon={<Icon name="user-plus" size={16} />} />
          <StatCard label="Cameras" value={cams.length} accent="var(--teal-600)" icon={<Icon name="video" size={16} />} />
        </div>

        {/* capacity bar */}
        <Card padding="lg">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-strong)' }}>Capacity</span>
            <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>{room.children}/{room.cap} · <b style={{ color: seatsFree > 0 ? 'var(--success-600)' : 'var(--danger-600)' }}>{seatsFree > 0 ? `${seatsFree} seats available` : 'Full'}</b></span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: room.cap }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 26, borderRadius: 4, background: i < room.children ? col : 'var(--bg-sunken)', border: i < room.children ? 'none' : '1px dashed var(--border-strong)', display: 'grid', placeItems: 'center' }}>
                {i < room.children ? <Icon name="user" size={12} color="#fff" /> : <Icon name="plus" size={11} color="var(--text-subtle)" />}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 8 }}>Filled seats show enrolled children · dashed seats are open — you can add up to {seatsFree} more.</div>
        </Card>

        {/* day selector + daily log */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Daily log</h3>
            <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 7, alignItems: 'center' }}>
              {DAYS.slice(0, 2).map(d => { const on = dayKey === d.key; return <button key={d.key} onClick={() => setDayKey(d.key)} style={{ padding: '7px 13px', borderRadius: 'var(--radius-md)', border: `1px solid ${on ? CL_MGR : 'var(--border-subtle)'}`, background: on ? CL_MGR : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-body)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 800 }}>{d.label}</button>; })}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 12px', borderRadius: 'var(--radius-md)', border: `1px solid ${(dayKey !== DAYS[0].key && dayKey !== DAYS[1].key) ? CL_MGR : 'var(--border-subtle)'}`, background: 'var(--surface-card)' }}>
                <Icon name="calendar-search" size={15} color={CL_MGR} />
                <input type="date" max="2026-06-23" value={dayKey} onChange={e => e.target.value && setDayKey(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', cursor: 'pointer' }} />
              </div>
            </div>
          </div>

          {/* teachers who came in that day */}
          <Card padding="md" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)', display: 'inline-flex', alignItems: 'center', gap: 7 }}><Icon name="users-round" size={16} color={CL_MGR} />Teachers in · {dayLbl}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {log.teachers.map((tn, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px 5px 5px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
                  <Avatar name={tn} size={24} /><span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong)' }}>{tn}</span>
                </span>
              ))}
            </div>
            <span style={{ marginInlineStart: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>{prettyDate(dayKey)}</span>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 18 }}>
            {/* attendance */}
            <Card padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-strong)' }}>Attendance · {dayLbl}</span>
                <Badge tone={attendPct >= 90 ? 'success' : 'amber'} solid>{attendPct}%</Badge>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--success-50)', textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success-700)' }}>{log.present.length}</div><div style={{ fontSize: 11.5, color: 'var(--success-700)', fontWeight: 600 }}>Present</div></div>
                <div style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--danger-600)' }}>{log.absent.length}</div><div style={{ fontSize: 11.5, color: 'var(--danger-600)', fontWeight: 600 }}>Absent</div></div>
              </div>
              <div style={{ maxHeight: 230, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {log.roster.map((n, i) => { const absent = log.absent.includes(n); return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 'var(--radius-sm)' }}>
                    <Avatar name={n} size={28} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: absent ? 'var(--text-subtle)' : 'var(--text-strong)', textDecoration: absent ? 'line-through' : 'none' }}>{n}</span>
                    {absent ? <Badge tone="danger" dot>Absent</Badge> : <Icon name="check" size={16} color="var(--success-500)" />}
                  </div>
                ); })}
              </div>
            </Card>

            {/* schedule + teachers */}
            <Card padding="lg">
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-strong)', display: 'block', marginBottom: 14 }}>Schedule · {dayLbl}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {log.subjects.map((s, i) => { const c = clTone(s.tone); return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 13px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', flex: 'none', width: 42 }}>{s.time}</span>
                    <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={s.icon} size={19} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>{s.subject}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{s.topic}</div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flex: 'none' }}>
                      <Avatar name={s.teacher} size={24} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-body)' }}>{s.teacher.split(' ')[0]}</span>
                    </span>
                  </div>
                ); })}
              </div>
              <div style={{ marginTop: 14, padding: '11px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="clipboard-check" size={17} color={CL_MGR} />
                <span style={{ fontSize: 12.5, color: 'var(--text-body)' }}><b>{log.subjects.length} sessions</b> by <b>{log.teachers.length} teachers</b> · {dayLbl.toLowerCase()}</span>
              </div>
            </Card>
          </div>
        </div>

        {/* linked cameras */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Linked cameras</h3>
            <Badge tone="neutral" style={{ marginInlineStart: 10 }}>{cams.length}</Badge>
          </div>
          {cams.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
              {cams.map(cam => (
                <Card key={cam.id} padding="none" style={{ overflow: 'hidden' }}>
                  <div onClick={() => cam.online && setViewCam(cam)} style={{ position: 'relative', aspectRatio: '16 / 10', cursor: cam.online ? 'pointer' : 'default' }}>
                    <window.CamFeed label={null} online={cam.online} room={cam.room} />
                  </div>
                  <div style={{ padding: '11px 13px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{cam.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: cam.online ? 'var(--success-500)' : 'var(--danger-500)' }} />{cam.online ? 'Online' : 'Offline'} · {cam.res}</div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card padding="lg" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No cameras linked to this room yet. Add one from the Cameras tab.</Card>
          )}
        </div>
      </div>

      {viewCam && (
        <div onClick={() => setViewCam(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(8,23,21,.86)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 92, padding: 32 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 760, maxWidth: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 18, fontWeight: 800, color: '#F5F3EE' }}>{viewCam.name}</div><div style={{ fontSize: 13, color: 'rgba(245,243,238,.6)' }}>{viewCam.zone} · {viewCam.res}</div></div>
              <button onClick={() => setViewCam(null)} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(245,243,238,.14)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="x" size={19} color="#F5F3EE" /></button>
            </div>
            <div style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid rgba(245,243,238,.12)' }}><window.CamFeed label={viewCam.name} online={viewCam.online} big room={viewCam.room} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Classrooms view (cards) ---------------- */
function ClassroomsView() {
  const F = window.DForms;
  const [list, setList] = useStateCls(SEED_ROOMS);
  const [open, setOpen] = useStateCls(null);     // room being viewed
  const [form, setForm] = useStateCls(null);     // {mode, room}
  const [toast, setToast] = useStateCls(null);

  const save = (r) => {
    if (form.mode === 'edit') {
      const nr = { ...form.room, ...r };
      setList(prev => prev.map(x => x.id === nr.id ? nr : x));
      if (open) setOpen(nr);
      setToast({ msg: 'Classroom updated', icon: 'check' });
    } else {
      const nr = { ...r, id: 'rm' + Date.now(), children: 0 };
      setList(prev => [...prev, nr]);
      setToast({ msg: `${r.name} Room created`, icon: 'door-open' });
    }
    setForm(null);
  };

  if (open) {
    return (
      <React.Fragment>
        <ClassroomDetail room={open} onBack={() => setOpen(null)} onEdit={() => setForm({ mode: 'edit', room: open })} />
        {form && <ClassroomForm initial={form.room} onClose={() => setForm(null)} onSave={save} />}
        {toast && <F.Toast message={toast.msg} icon={toast.icon} tone={toast.tone} onDone={() => setToast(null)} />}
      </React.Fragment>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>{list.length} classrooms · KG1 &amp; KG2</h3>
        <Button variant="primary" size="sm" iconLeft={<Icon name="plus" size={16} />} style={{ marginInlineStart: 'auto' }} onClick={() => setForm({ mode: 'add' })}>New classroom</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        {list.map(c => {
          const col = clTone(c.tone); const pct = Math.round(c.children / c.cap * 100); const free = c.cap - c.children;
          const cams = c.cameraIds ? (window.MASAR_CAMERAS || []).filter(x => c.cameraIds.includes(x.id)) : (window.MASAR_CAMERAS || []).filter(x => x.room === `${c.grade} · ${c.name}`);
          return (
            <Card key={c.id} padding="lg" interactive onClick={() => setOpen(c)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${col} 12%, transparent)`, color: col, display: 'grid', placeItems: 'center' }}><Icon name="door-open" size={22} /></span>
                <Badge tone={c.tone === 'violet' ? 'violet' : c.tone}>{c.grade}</Badge>
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)' }}>{c.name} Room</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}><Avatar name={c.teacher} size={22} />{c.teacher}</div>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>Capacity</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>{c.children}/{c.cap} · {free} free</span>
              </div>
              <div style={{ height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--bg-sunken)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 'var(--radius-pill)' }} /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', fontSize: 12.5, color: 'var(--text-muted)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="cake" size={14} color="var(--text-subtle)" />{c.age}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="video" size={14} color="var(--text-subtle)" />{cams.length} cameras</span>
                <span style={{ marginInlineStart: 'auto', color: col, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Open<Icon name="arrow-right" size={14} color={col} /></span>
              </div>
            </Card>
          );
        })}
      </div>

      {form && <ClassroomForm initial={form.mode === 'edit' ? form.room : null} onClose={() => setForm(null)} onSave={save} />}
      {toast && <F.Toast message={toast.msg} icon={toast.icon} tone={toast.tone} onDone={() => setToast(null)} />}
    </div>
  );
}

window.ClassroomsView = ClassroomsView;
/* expose shared classroom data so Attendance can reuse it */
window.MASAR_ROOMS = SEED_ROOMS;
window.MASAR_ROOM_ROSTER = ROOM_ROSTER;
window.MASAR_dayLog = dayLog;
window.MASAR_clTone = clTone;
