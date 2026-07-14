const { useState: useStateDV } = React;

/* ====================================================================
   Masar — Nursery Dashboard · Views
   Approvals (teacher requests) · Bus management · Teachers · Classrooms · AI Reports
   Exposes window.{ApprovalsView, BusView, TeachersView, ClassroomsView, ReportsView}
   ==================================================================== */

const MGR_C = 'var(--role-manager)';
function dvTone(t) { return ({ teal: 'var(--teal-600)', amber: 'var(--amber-600)', info: 'var(--info-500)', violet: 'var(--role-teacher)', success: 'var(--success-500)', danger: 'var(--danger-500)' })[t] || 'var(--teal-600)'; }

/* ---------------- APPROVALS (teacher requests land here) ---------------- */
const SEED_APPROVALS = [
  { id: 'r1', type: 'exam', examKind: 'weekly', title: 'English — Weekly Quiz', teacher: 'Sara Mahmoud', subject: 'English', classroom: 'KG2 · Sunflower', date: 'Sun · Jun 29', time: '9:00 AM', note: 'Letters M, N, O + sight words. Paper attached.', hasFile: true, status: 'pending' },
  { id: 'r2', type: 'trip', title: 'Aquarium Visit', teacher: 'Hala Nabil', place: 'Grand Aquarium', price: 250, classroom: 'KG1 · Tulip', date: 'Mon · Jun 30', time: '9:30 AM', note: 'Guided visit, lunch included. Needs 1 bus + 2 assistants.', hasFile: false, status: 'pending' },
  { id: 'r3', type: 'event', title: 'English Reading Corner', teacher: 'Sara Mahmoud', classroom: 'KG2 · Sunflower', date: 'Wed · Jul 2', time: '11:00 AM', note: 'In-class parent reading morning.', hasFile: false, status: 'pending' },
  { id: 'r4', type: 'exam', examKind: 'monthly', title: 'Math — Monthly Test', teacher: 'Sara Mahmoud', subject: 'Math', classroom: 'KG2 · Sunflower', date: 'Wed · Jul 2', time: '9:45 AM', note: 'Counting 1–20 and shapes. Paper attached.', hasFile: true, status: 'approved' },
];
const TYPE_META = {
  exam: { icon: 'clipboard-list', tone: 'info', label: 'Exam' },
  trip: { icon: 'map', tone: 'amber', label: 'Trip' },
  event: { icon: 'party-popper', tone: 'violet', label: 'Event' },
};

function ApprovalsView() {
  const [items, setItems] = useStateDV(SEED_APPROVALS);
  const [filter, setFilter] = useStateDV('pending');
  const [preview, setPreview] = useStateDV(null);
  const decide = (id, status) => setItems(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  const shown = items.filter(r => filter === 'all' ? true : r.status === filter);
  const pendCount = items.filter(r => r.status === 'pending').length;

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
        <StatCard label="Pending" value={pendCount} accent="var(--amber-600)" icon={<Icon name="hourglass" size={16} />} />
        <StatCard label="Approved" value={items.filter(r => r.status === 'approved').length} accent="var(--success-500)" icon={<Icon name="check" size={16} />} />
        <StatCard label="Exams" value={items.filter(r => r.type === 'exam').length} accent="var(--info-500)" icon={<Icon name="clipboard-list" size={16} />} />
        <StatCard label="Trips & events" value={items.filter(r => r.type !== 'exam').length} accent="var(--role-teacher)" icon={<Icon name="party-popper" size={16} />} />
      </div>

      {/* filter tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']].map(([v, l]) => {
          const on = filter === v;
          return <button key={v} onClick={() => setFilter(v)} style={{ height: 38, padding: '0 16px', borderRadius: 'var(--radius-pill)', border: `1px solid ${on ? MGR_C : 'var(--border-subtle)'}`, background: on ? MGR_C : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>{l}{v === 'pending' && pendCount ? ` · ${pendCount}` : ''}</button>;
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {shown.length === 0 && <Card padding="lg" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No {filter} requests.</Card>}
        {shown.map(r => {
          const tm = TYPE_META[r.type]; const c = dvTone(tm.tone);
          return (
            <Card key={r.id} padding="lg">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <span style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={tm.icon} size={24} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>{r.title}</span>
                    <Badge tone={tm.tone}>{tm.label}{r.examKind ? ` · ${r.examKind}` : ''}</Badge>
                    {r.type === 'trip' && <Badge tone={r.price ? 'amber' : 'success'}>{r.price ? `${r.price} EGP` : 'Free'}</Badge>}
                    {r.status === 'approved' && <Badge tone="success" dot>Approved</Badge>}
                    {r.status === 'rejected' && <Badge tone="danger" dot>Rejected</Badge>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Avatar name={r.teacher} size={22} />{r.teacher}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="door-open" size={14} color="var(--text-subtle)" />{r.classroom}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="calendar" size={14} color="var(--text-subtle)" />{r.date}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="clock" size={14} color="var(--text-subtle)" />{r.time}</span>
                    {r.place && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="map-pin" size={14} color="var(--text-subtle)" />{r.place}</span>}
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.5 }}>{r.note}</p>
                  {r.hasFile && (
                    <button onClick={() => setPreview(r)} style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 13px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--text-body)' }}>
                      <Icon name="file-text" size={16} color={c} />View exam paper
                    </button>
                  )}
                </div>
                {r.status === 'pending' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
                    <Button variant="primary" size="sm" iconLeft={<Icon name="check" size={15} />} onClick={() => decide(r.id, 'approved')}>Approve</Button>
                    <Button variant="ghost" size="sm" iconLeft={<Icon name="x" size={15} />} onClick={() => decide(r.id, 'rejected')}>Reject</Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 80, padding: 32 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', width: 520, maxWidth: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>{preview.title} — exam paper</h3>
              <button onClick={() => setPreview(null)} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--surface-raised)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="x" size={18} color="var(--text-body)" /></button>
            </div>
            <div style={{ padding: 24, background: 'var(--bg-sunken)' }}>
              {/* mock scanned paper */}
              <div style={{ background: '#fff', borderRadius: 8, boxShadow: 'var(--shadow-md)', padding: '28px 30px', minHeight: 360 }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid #1C1C1A', paddingBottom: 12, marginBottom: 18 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1A' }}>Sunrise Nursery — {preview.subject}</div>
                  <div style={{ fontSize: 12.5, color: '#555', marginTop: 3 }}>{preview.examKind ? preview.examKind[0].toUpperCase() + preview.examKind.slice(1) : ''} Test · {preview.date}</div>
                </div>
                {[1, 2, 3, 4].map(n => (
                  <div key={n} style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1C1C1A', marginBottom: 8 }}>{n}. {['Circle the letter M.', 'Match the picture to its sound.', 'Count and write the number.', 'Trace the word.'][n - 1]}</div>
                    <div style={{ height: 8, background: '#EEE', borderRadius: 4, width: '88%', marginBottom: 6 }} />
                    <div style={{ height: 8, background: '#EEE', borderRadius: 4, width: '64%' }} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
              <Button variant="secondary" iconLeft={<Icon name="download" size={16} />}>Download</Button>
              {preview.status === 'pending' && <Button variant="primary" fullWidth iconLeft={<Icon name="check" size={16} />} onClick={() => { decide(preview.id, 'approved'); setPreview(null); }}>Approve request</Button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- BUS MANAGEMENT ---------------- */
const ROUTES = [
  { no: '3', driver: 'Tarek Saeed', plate: '4281', children: 8, onboard: 8, phase: 'At nursery', status: 'arrived', area: 'Dokki · Mohandessin' },
  { no: '1', driver: 'Sayed Ali', plate: '3190', children: 6, onboard: 4, phase: 'En route — AM', status: 'moving', area: 'Maadi · Zahraa' },
  { no: '2', driver: 'Reda Kamal', plate: '5523', children: 7, onboard: 0, phase: 'Idle', status: 'idle', area: '6 October' },
  { no: '4', driver: 'Magdy Nabil', plate: '7702', children: 5, onboard: 0, phase: 'Idle', status: 'idle', area: 'Nasr City' },
];
const ROUTE_STATUS = { arrived: ['success', 'Arrived'], moving: ['amber', 'On route'], idle: ['neutral', 'Idle'] };

function BusView() {
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
        <StatCard label="Routes" value={4} accent={MGR_C} icon={<Icon name="route" size={16} />} />
        <StatCard label="Drivers on shift" value={2} unit="/ 4" accent="var(--role-driver)" icon={<Icon name="bus" size={16} />} />
        <StatCard label="Children in transit" value={4} accent="var(--amber-600)" icon={<Icon name="users" size={16} />} />
        <StatCard label="Arrived safely" value={8} accent="var(--success-500)" icon={<Icon name="circle-check-big" size={16} />} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18 }}>
        <Card padding="none" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Routes &amp; drivers</h3>
            <Button variant="primary" size="sm" iconLeft={<Icon name="plus" size={16} />} style={{ marginInlineStart: 'auto' }}>Add route</Button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
            <thead><tr style={{ background: 'var(--bg-app)' }}>{['Route', 'Driver', 'Area', 'On board', 'Status'].map((h, i) => <th key={i} style={{ textAlign: 'start', padding: '11px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>{h}</th>)}</tr></thead>
            <tbody>{ROUTES.map((r, i) => {
              const [tone, label] = ROUTE_STATUS[r.status];
              return (
                <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '13px 20px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--teal-50)', color: MGR_C, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14 }}>{r.no}</span><span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>Bus {r.no}</span></div></td>
                  <td style={{ padding: '13px 20px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar name={r.driver} size={28} /><div><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}>{r.driver}</div><div style={{ fontSize: 11.5, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>{r.plate}</div></div></div></td>
                  <td style={{ padding: '13px 20px', fontSize: 13, color: 'var(--text-body)' }}>{r.area}</td>
                  <td style={{ padding: '13px 20px', fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{r.onboard}/{r.children}</td>
                  <td style={{ padding: '13px 20px' }}><Badge tone={tone} dot>{label}</Badge></td>
                </tr>
              );
            })}</tbody>
          </table>
        </Card>

        {/* mini live map */}
        <Card padding="none" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Live map</h3></div>
          <div style={{ position: 'relative', height: 300 }}>
            <svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
              <rect width="400" height="300" fill="#E9EEE8" />
              <rect x="20" y="20" width="120" height="80" rx="8" fill="#D7E5D4" /><rect x="260" y="180" width="120" height="100" rx="8" fill="#D7E5D4" />
              <g stroke="#fff" strokeWidth="12" strokeLinecap="round"><line x1="-5" y1="100" x2="405" y2="100" /><line x1="-5" y1="200" x2="405" y2="200" /><line x1="120" y1="-5" x2="120" y2="305" /><line x1="280" y1="-5" x2="280" y2="305" /></g>
            </svg>
            {/* nursery */}
            <span style={{ position: 'absolute', left: '70%', top: '66%', transform: 'translate(-50%,-50%)' }}><Icon name="school" size={26} color="var(--teal-700)" /></span>
            {/* buses */}
            <span style={{ position: 'absolute', left: '30%', top: '34%', transform: 'translate(-50%,-50%)', width: 30, height: 30, borderRadius: '50%', background: 'var(--amber-500)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 5px rgba(239,159,39,.22)' }}><Icon name="bus" size={15} color="#1C1C1A" /></span>
            <span style={{ position: 'absolute', left: '68%', top: '64%', transform: 'translate(-50%,-50%)', width: 30, height: 30, borderRadius: '50%', background: 'var(--success-500)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 5px rgba(31,138,91,.2)' }}><Icon name="bus" size={15} color="#fff" /></span>
            <span style={{ position: 'absolute', top: 12, insetInlineStart: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'rgba(255,255,255,.92)', boxShadow: 'var(--shadow-sm)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--amber-500)' }} /><span style={{ fontSize: 10.5, fontWeight: 800 }}>2 buses live</span></span>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- TEACHERS ---------------- */
const TEACHERS = [
  { name: 'Sara Mahmoud', subject: 'English & Math', rooms: 'KG2 Sunflower', children: 18, reports: 'Up to date', tone: 'success' },
  { name: 'Hala Nabil', subject: 'Arabic & Art', rooms: 'KG1 Tulip', children: 16, reports: '2 pending', tone: 'amber' },
  { name: 'Mona Saleh', subject: 'Music & Play', rooms: 'KG1 Daisy', children: 15, reports: 'Up to date', tone: 'success' },
  { name: 'Yasmin Adel', subject: 'Science', rooms: 'KG2 Tulip', children: 17, reports: 'Up to date', tone: 'success' },
];
function TeachersView() {
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        <StatCard label="Teachers" value={12} accent={MGR_C} icon={<Icon name="graduation-cap" size={16} />} />
        <StatCard label="Subjects" value={8} accent="var(--role-teacher)" icon={<Icon name="book-open" size={16} />} />
        <StatCard label="Reports pending" value={2} accent="var(--amber-600)" icon={<Icon name="file-pen" size={16} />} />
      </div>
      <Card padding="none" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Staff</h3>
          <Button variant="primary" size="sm" iconLeft={<Icon name="user-plus" size={16} />} style={{ marginInlineStart: 'auto' }}>Add teacher</Button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
          <thead><tr style={{ background: 'var(--bg-app)' }}>{['Teacher', 'Subjects', 'Classroom', 'Children', 'Reports', ''].map((h, i) => <th key={i} style={{ textAlign: 'start', padding: '11px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>{h}</th>)}</tr></thead>
          <tbody>{TEACHERS.map((t, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '12px 20px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><Avatar name={t.name} size={36} /><span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>{t.name}</span></div></td>
              <td style={{ padding: '12px 20px', fontSize: 13.5, color: 'var(--text-body)' }}>{t.subject}</td>
              <td style={{ padding: '12px 20px', fontSize: 13.5, color: 'var(--text-body)' }}>{t.rooms}</td>
              <td style={{ padding: '12px 20px', fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>{t.children}</td>
              <td style={{ padding: '12px 20px' }}><Badge tone={t.tone} dot>{t.reports}</Badge></td>
              <td style={{ padding: '12px 20px', textAlign: 'end' }}><Icon name="more-horizontal" size={18} color="var(--text-subtle)" /></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------------- CLASSROOMS ---------------- */
const CLASSROOMS = [
  { name: 'Sunflower', grade: 'KG2', teacher: 'Sara Mahmoud', children: 18, cap: 20, tone: 'teal' },
  { name: 'Tulip', grade: 'KG1', teacher: 'Hala Nabil', children: 16, cap: 20, tone: 'violet' },
  { name: 'Daisy', grade: 'KG1', teacher: 'Mona Saleh', children: 15, cap: 18, tone: 'amber' },
  { name: 'Rose', grade: 'KG2', teacher: 'Yasmin Adel', children: 17, cap: 20, tone: 'info' },
];
function ClassroomsView() {
  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>6 classrooms · KG1 &amp; KG2</h3>
        <Button variant="primary" size="sm" iconLeft={<Icon name="plus" size={16} />} style={{ marginInlineStart: 'auto' }}>New classroom</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        {CLASSROOMS.map((c, i) => {
          const col = dvTone(c.tone); const pct = Math.round(c.children / c.cap * 100);
          return (
            <Card key={i} padding="lg">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${col} 12%, transparent)`, color: col, display: 'grid', placeItems: 'center' }}><Icon name="door-open" size={22} /></span>
                <Badge tone={c.tone === 'violet' ? 'violet' : c.tone}>{c.grade}</Badge>
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)' }}>{c.name} Room</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}><Avatar name={c.teacher} size={22} />{c.teacher}</div>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>Capacity</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>{c.children}/{c.cap}</span>
              </div>
              <div style={{ height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--bg-sunken)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 'var(--radius-pill)' }} /></div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- AI REPORTS ---------------- */
const REPORT_BATCHES = [
  { room: 'KG2 · Sunflower', count: 18, ready: 18, status: 'ready' },
  { room: 'KG1 · Tulip', count: 16, ready: 16, status: 'ready' },
  { room: 'KG1 · Daisy', count: 15, ready: 12, status: 'partial' },
  { room: 'KG2 · Rose', count: 17, ready: 17, status: 'sent' },
];
function ReportsView() {
  const [batches, setBatches] = useStateDV(REPORT_BATCHES);
  const send = (room) => setBatches(prev => prev.map(b => b.room === room ? { ...b, status: 'sent' } : b));
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <Card padding="lg" style={{ background: 'var(--surface-dark)', border: 'none', display: 'flex', alignItems: 'center', gap: 20 }}>
        <span style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)', background: 'rgba(239,159,39,.18)', color: 'var(--amber-400)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="sparkles" size={26} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--neutral-100)' }}>AI compiles every report for you</div>
          <div style={{ fontSize: 13, color: 'var(--teal-100)', marginTop: 3 }}>Daily notes, monthly summaries, strengths and gaps — built from teacher evaluations, attendance and mood, ready to review and send to parents.</div>
        </div>
        <Button variant="amber" iconLeft={<Icon name="wand-2" size={17} />}>Generate all</Button>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        <StatCard label="Reports ready" value={63} accent="var(--success-500)" icon={<Icon name="file-check" size={16} />} />
        <StatCard label="Sent to parents" value={17} accent={MGR_C} icon={<Icon name="send" size={16} />} />
        <StatCard label="Awaiting evaluations" value={3} accent="var(--amber-600)" icon={<Icon name="hourglass" size={16} />} />
      </div>

      <Card padding="none" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Monthly report batches</h3></div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
          <thead><tr style={{ background: 'var(--bg-app)' }}>{['Classroom', 'Reports', 'Status', ''].map((h, i) => <th key={i} style={{ textAlign: 'start', padding: '11px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>{h}</th>)}</tr></thead>
          <tbody>{batches.map((b, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '13px 20px', fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>{b.room}</td>
              <td style={{ padding: '13px 20px', fontSize: 13.5, color: 'var(--text-body)' }}>{b.ready}/{b.count} ready</td>
              <td style={{ padding: '13px 20px' }}>{b.status === 'sent' ? <Badge tone="success" dot>Sent</Badge> : b.status === 'partial' ? <Badge tone="amber" dot>Partial</Badge> : <Badge tone="info" dot>Ready</Badge>}</td>
              <td style={{ padding: '10px 20px', textAlign: 'end' }}>
                {b.status === 'sent'
                  ? <span style={{ fontSize: 12.5, color: 'var(--text-subtle)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="check-check" size={15} color="var(--success-500)" />Delivered</span>
                  : <Button variant={b.status === 'partial' ? 'secondary' : 'primary'} size="sm" iconLeft={<Icon name="send" size={14} />} onClick={() => send(b.room)} disabled={b.status === 'partial'}>{b.status === 'partial' ? 'Waiting' : 'Review & send'}</Button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------------- ANNOUNCE (compose & broadcast) ---------------- */
const AUDIENCES = [
  { v: 'all', icon: 'users', label: 'Everyone', sub: 'All parents, teachers & staff', count: 312 },
  { v: 'parents', icon: 'baby', label: 'All parents', sub: 'Every enrolled family', count: 188 },
  { v: 'classroom', icon: 'door-open', label: 'A classroom', sub: 'Parents of one room', count: 18 },
  { v: 'teachers', icon: 'graduation-cap', label: 'Teachers', sub: 'Teaching staff only', count: 12 },
  { v: 'drivers', icon: 'bus', label: 'Drivers', sub: 'Bus drivers only', count: 6 },
];
const ANN_TEMPLATES = [
  { icon: 'calendar-off', label: 'Holiday notice', title: 'Nursery closed', body: 'Dear parents, the nursery will be closed on [date] for [occasion]. Regular hours resume the next day.' },
  { icon: 'cloud-rain', label: 'Weather / early close', title: 'Early dismissal today', body: 'Due to weather conditions, children will be dismissed early today at [time]. Buses will run accordingly.' },
  { icon: 'party-popper', label: 'Event reminder', title: 'Reminder: [event]', body: 'A friendly reminder that [event] takes place on [date] at [time]. We look forward to seeing you!' },
];
const CLASSROOM_OPTS = ['KG2 · Sunflower', 'KG1 · Tulip', 'KG1 · Daisy', 'KG2 · Rose'];

function AnnounceModal({ onClose }) {
  const [step, setStep] = useStateDV('compose'); // compose | review | sent
  const [aud, setAud] = useStateDV('all');
  const [room, setRoom] = useStateDV(CLASSROOM_OPTS[0]);
  const [title, setTitle] = useStateDV('');
  const [body, setBody] = useStateDV('');
  const [priority, setPriority] = useStateDV('normal');
  const [when, setWhen] = useStateDV('now');
  const [channels, setChannels] = useStateDV({ push: true, whatsapp: true, sms: false });
  const audObj = AUDIENCES.find(a => a.v === aud);
  const recipients = aud === 'classroom' ? 18 : audObj.count;
  const valid = title.trim() && body.trim();
  const toggleCh = (k) => setChannels(prev => ({ ...prev, [k]: !prev[k] }));

  const field = { width: '100%', padding: '12px 14px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14.5, fontFamily: 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };
  const lbl = { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)', marginBottom: 8 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 90, padding: 28 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', width: 580, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--teal-50)', color: MGR_C, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="megaphone" size={21} /></span>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-strong)' }}>{step === 'sent' ? 'Announcement sent' : 'New announcement'}</h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 1 }}>{step === 'compose' ? 'Compose and choose who hears it' : step === 'review' ? 'Review before broadcasting' : 'Delivered across Masar'}</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--surface-raised)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="x" size={18} color="var(--text-body)" /></button>
        </div>

        <div style={{ padding: 22, overflowY: 'auto' }}>
          {step === 'compose' && (
            <React.Fragment>
              {/* templates */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {ANN_TEMPLATES.map((t, i) => (
                  <button key={i} onClick={() => { setTitle(t.title); setBody(t.body); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)' }}>
                    <Icon name={t.icon} size={14} color={MGR_C} />{t.label}
                  </button>
                ))}
              </div>

              <label style={lbl}>Audience</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: aud === 'classroom' ? 12 : 18 }}>
                {AUDIENCES.map(a => {
                  const on = aud === a.v;
                  return (
                    <button key={a.v} onClick={() => setAud(a.v)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? MGR_C : 'var(--border-subtle)'}`, background: on ? 'var(--teal-50)' : 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
                      <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: on ? 'var(--surface-card)' : 'var(--surface-raised)', color: on ? MGR_C : 'var(--text-subtle)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={a.icon} size={17} /></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{a.label}</span>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {aud === 'classroom' && (
                <div style={{ marginBottom: 18 }}>
                  <select value={room} onChange={e => setRoom(e.target.value)} style={{ ...field, cursor: 'pointer' }}>
                    {CLASSROOM_OPTS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              <label style={lbl}>Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Nursery closed Thursday" style={{ ...field, marginBottom: 16 }} />

              <label style={lbl}>Message</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your announcement…" style={{ ...field, minHeight: 110, resize: 'none', lineHeight: 1.55, marginBottom: 18 }} />

              <label style={lbl}>Priority</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                {[['normal', 'Normal', 'var(--info-500)'], ['important', 'Important', 'var(--amber-500)'], ['urgent', 'Urgent', 'var(--danger-500)']].map(([v, l, c]) => {
                  const on = priority === v;
                  return <button key={v} onClick={() => setPriority(v)} style={{ flex: 1, height: 42, borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? c : 'var(--border-subtle)'}`, background: on ? `color-mix(in srgb, ${c} 12%, transparent)` : 'var(--surface-card)', color: on ? c : 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>;
                })}
              </div>

              <label style={lbl}>Delivery channels</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['push', 'In-app push', 'bell'], ['whatsapp', 'WhatsApp', 'message-circle'], ['sms', 'SMS', 'message-square']].map(([k, l, ic]) => {
                  const on = channels[k];
                  return <button key={k} onClick={() => toggleCh(k)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? MGR_C : 'var(--border-subtle)'}`, background: on ? 'var(--teal-50)' : 'var(--surface-card)', color: on ? MGR_C : 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}><Icon name={ic} size={15} />{l}</button>;
                })}
              </div>
            </React.Fragment>
          )}

          {step === 'review' && (
            <React.Fragment>
              {/* recipient summary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--teal-50)', border: '1px solid var(--teal-100)', marginBottom: 18 }}>
                <span style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--surface-card)', color: MGR_C, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={audObj.icon} size={21} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)' }}>{aud === 'classroom' ? room : audObj.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--teal-700)' }}>Reaching <b>{recipients}</b> recipients</div>
                </div>
                <Badge tone={priority === 'urgent' ? 'danger' : priority === 'important' ? 'amber' : 'info'} dot>{priority[0].toUpperCase() + priority.slice(1)}</Badge>
              </div>

              {/* preview card (as parent sees it) */}
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Preview</div>
              <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <MasarMark size={18} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>Sunrise Nursery</span>
                  <span style={{ marginInlineStart: 'auto', fontSize: 11.5, color: 'var(--text-subtle)' }}>now</span>
                </div>
                <div style={{ padding: '16px' }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text-strong)' }}>{title}</div>
                  <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-body)', whiteSpace: 'pre-wrap' }}>{body}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                {Object.entries(channels).filter(([, v]) => v).map(([k]) => (
                  <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}><Icon name={k === 'push' ? 'bell' : k === 'whatsapp' ? 'message-circle' : 'message-square'} size={14} color="var(--success-500)" />{k === 'push' ? 'In-app push' : k === 'whatsapp' ? 'WhatsApp' : 'SMS'}</span>
                ))}
              </div>
            </React.Fragment>
          )}

          {step === 'sent' && (
            <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
              <span style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--success-50)', color: 'var(--success-600)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}><Icon name="check-check" size={44} /></span>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-strong)' }}>Sent to {recipients} recipients</h3>
              <p style={{ margin: '10px auto 0', fontSize: 14, color: 'var(--text-muted)', maxWidth: 340, lineHeight: 1.55 }}>“{title}” is now in their Masar inboxes{channels.whatsapp ? ' and on WhatsApp' : ''}.</p>
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border-subtle)' }}>
          {step === 'compose' && (
            <React.Fragment>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button variant="primary" fullWidth disabled={!valid} iconRight={<Icon name="arrow-right" size={16} />} onClick={() => setStep('review')}>Review</Button>
            </React.Fragment>
          )}
          {step === 'review' && (
            <React.Fragment>
              <Button variant="secondary" iconLeft={<Icon name="arrow-left" size={16} />} onClick={() => setStep('compose')}>Edit</Button>
              <Button variant="primary" fullWidth iconLeft={<Icon name="send" size={16} />} onClick={() => setStep('sent')}>Send to {recipients}</Button>
            </React.Fragment>
          )}
          {step === 'sent' && <Button variant="primary" fullWidth onClick={onClose}>Done</Button>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ApprovalsView, BusView, TeachersView, ClassroomsView, ReportsView, AnnounceModal });
