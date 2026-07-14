const { useState: useStateAtt } = React;

/* ====================================================================
   Masar — Dashboard · Attendance (per-classroom, subjects, notify parents)
   ==================================================================== */
const ATT_MGR = 'var(--role-manager)';
function attTone(t) { return ({ teal: 'var(--teal-600)', amber: 'var(--amber-600)', info: 'var(--info-500)', violet: 'var(--role-teacher)' })[t] || 'var(--teal-600)'; }

/* Per-child: which subjects they attended today (absent children attend none) */
function childSubjects(childName, dateKey, subjects, absent) {
  if (absent.includes(childName)) return [];
  // a present child may still miss the odd late session — deterministic
  const h = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return Math.abs(x); };
  return subjects.filter((s, i) => (h(childName + s.subject + dateKey) % 9) !== 0);
}

function AttendanceView() {
  const rooms = window.MASAR_ROOMS || [];
  const dayLog = window.MASAR_dayLog;
  const clTone = window.MASAR_clTone || attTone;
  const F = window.DForms;

  // Build last 14 school days (skip Fri/Sat)
  const allDays = [];
  { const base = new Date('2026-06-23T00:00:00'); let added = 0, off = 0;
    while (added < 14) { const d = new Date(base); d.setDate(base.getDate() - off); const dow = d.getDay(); off++; if (dow === 5 || dow === 6) continue; allDays.push(d); added++; } }
  const fmtKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayMeta = (d) => { const key = fmtKey(d); const rel = key === '2026-06-23' ? 'Today' : key === '2026-06-22' ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'short' }); return { key, rel, sub: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }; };

  const [dayKey, setDayKey] = useStateAtt('2026-06-23');
  const [openRoom, setOpenRoom] = useStateAtt(null);
  const [notified, setNotified] = useStateAtt({});       // key roomId:dayKey -> true
  const [toast, setToast] = useStateAtt(null);
  const [confirm, setConfirm] = useStateAtt(null);

  // aggregate totals for the selected day
  const perRoom = rooms.map(r => { const log = dayLog(r.id, dayKey); return { room: r, log }; });
  const totPresent = perRoom.reduce((n, x) => n + x.log.present.length, 0);
  const totAbsent = perRoom.reduce((n, x) => n + x.log.absent.length, 0);
  const totAll = totPresent + totAbsent;

  const notifyRoom = (roomId, dayKey, roomName) => {
    setNotified(prev => ({ ...prev, [roomId + ':' + dayKey]: true }));
    setToast({ msg: `Attendance sent to ${roomName} parents`, icon: 'send' });
  };
  const notifyAll = () => {
    const next = { ...notified };
    rooms.forEach(r => { next[r.id + ':' + dayKey] = true; });
    setNotified(next);
    setToast({ msg: `Daily attendance sent to all parents`, icon: 'send' });
  };

  /* ---- Detail: one classroom ---- */
  if (openRoom) {
    const r = rooms.find(x => x.id === openRoom);
    const log = dayLog(r.id, dayKey);
    const col = clTone(r.tone);
    const dm = dayMeta(new Date(dayKey + 'T00:00:00'));
    const sent = notified[r.id + ':' + dayKey];
    return (
      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <button onClick={() => setOpenRoom(null)} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}><Icon name="arrow-left" size={16} color="var(--text-body)" />All classrooms</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${col} 12%, transparent)`, color: col, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="door-open" size={26} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--text-strong)' }}>{r.name} Room · {dm.rel}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{r.grade} · {log.present.length} present · {log.absent.length} absent · {log.subjects.length} subjects</div>
          </div>
          {sent ? <Badge tone="success" dot>Parents notified</Badge>
            : <Button variant="primary" iconLeft={<Icon name="send" size={16} />} onClick={() => setConfirm({ roomId: r.id, name: r.name })}>Notify parents</Button>}
        </div>

        {/* subjects strip */}
        <Card padding="lg">
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)', marginBottom: 12 }}>Subjects delivered today</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {log.subjects.map((s, i) => { const c = attTone(s.tone); return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 13px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)' }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c, display: 'grid', placeItems: 'center' }}><Icon name={s.icon} size={14} /></span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong)' }}>{s.subject}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>{s.time}</span>
              </div>
            ); })}
          </div>
        </Card>

        {/* roster table: per child present/absent + subjects attended */}
        <Card padding="none" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-strong)' }}>Roster &amp; sessions attended</h3>
            <span style={{ marginInlineStart: 'auto', fontSize: 12.5, color: 'var(--text-muted)' }}>What each child attended is sent to their parents</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
            <thead><tr style={{ background: 'var(--bg-app)' }}>
              <th style={{ textAlign: 'start', padding: '10px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>Child</th>
              <th style={{ textAlign: 'start', padding: '10px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>Status</th>
              <th style={{ textAlign: 'start', padding: '10px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>Subjects attended</th>
            </tr></thead>
            <tbody>
              {log.roster.map((name, i) => {
                const absent = log.absent.includes(name);
                const attended = childSubjects(name, dayKey, log.subjects, log.absent);
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)', background: absent ? 'color-mix(in srgb, var(--danger-50) 50%, transparent)' : 'transparent' }}>
                    <td style={{ padding: '11px 20px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={name} size={32} /><span style={{ fontSize: 13.5, fontWeight: 700, color: absent ? 'var(--text-muted)' : 'var(--text-strong)' }}>{name}</span></div></td>
                    <td style={{ padding: '11px 20px' }}>{absent ? <Badge tone="danger" dot>Absent</Badge> : <Badge tone="success" dot>Present</Badge>}</td>
                    <td style={{ padding: '11px 20px' }}>
                      {absent ? <span style={{ fontSize: 12.5, color: 'var(--text-subtle)' }}>—</span> : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {attended.map((s, j) => { const c = attTone(s.tone); return <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 'var(--radius-pill)', background: `color-mix(in srgb, ${c} 10%, transparent)`, color: c, fontSize: 11.5, fontWeight: 700 }}><Icon name={s.icon} size={12} />{s.subject}</span>; })}
                          {attended.length < log.subjects.length && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-50)', color: 'var(--amber-700)', fontSize: 11.5, fontWeight: 700 }}><Icon name="clock" size={11} />missed {log.subjects.length - attended.length}</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {confirm && <F.ConfirmDialog icon="send" tone="manager" title={`Notify ${confirm.name} parents?`} message={`Each parent gets today's attendance for their child — present/absent and exactly which subjects (and topics) they attended. Sent to the Parent app.`} confirmLabel="Send to parents" onConfirm={() => notifyRoom(confirm.roomId, dayKey, confirm.name)} onClose={() => setConfirm(null)} />}
        {toast && <F.Toast message={toast.msg} icon={toast.icon} tone={toast.tone} onDone={() => setToast(null)} />}
      </div>
    );
  }

  /* ---- Overview: all classrooms for the chosen day ---- */
  const allSent = rooms.length && rooms.every(r => notified[r.id + ':' + dayKey]);
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* date timeline (go back in time) */}
      <Card padding="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Icon name="calendar-days" size={17} color={ATT_MGR} />
          <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)' }}>Pick a day</span>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)', marginInlineStart: 'auto' }}>Scroll back through school days</span>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {allDays.map((d, i) => { const dm = dayMeta(d); const on = dayKey === dm.key; return (
            <button key={i} onClick={() => setDayKey(dm.key)} style={{ flex: 'none', minWidth: 72, padding: '9px 12px', borderRadius: 'var(--radius-md)', border: `1px solid ${on ? ATT_MGR : 'var(--border-subtle)'}`, background: on ? ATT_MGR : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-body)', cursor: 'pointer', textAlign: 'center', lineHeight: 1.25 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800 }}>{dm.rel}</div>
              <div style={{ fontSize: 10.5, opacity: 0.8 }}>{dm.sub}</div>
            </button>
          ); })}
        </div>
      </Card>

      {/* totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
        <StatCard label="Present" value={totPresent} accent="var(--success-500)" icon={<Icon name="check" size={16} />} />
        <StatCard label="Absent" value={totAbsent} accent="var(--danger-500)" icon={<Icon name="x" size={16} />} />
        <StatCard label="Classrooms" value={rooms.length} accent={ATT_MGR} icon={<Icon name="door-open" size={16} />} />
        <StatCard label="% Present" value={totAll ? Math.round(totPresent / totAll * 100) : 0} unit="%" accent="var(--teal-600)" icon={<Icon name="trending-up" size={16} />} />
      </div>

      {/* notify all */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 'var(--radius-lg)', background: 'var(--teal-50)', border: '1px solid var(--teal-100)' }}>
        <Icon name="send" size={20} color="var(--teal-700)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--teal-800)' }}>Send today’s attendance to all parents</div>
          <div style={{ fontSize: 12.5, color: 'var(--teal-700)' }}>Each parent receives their child’s status and the subjects they attended.</div>
        </div>
        {allSent ? <Badge tone="success" dot>All sent</Badge> : <Button variant="primary" iconLeft={<Icon name="send" size={16} />} onClick={notifyAll}>Notify all</Button>}
      </div>

      {/* per classroom cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
        {perRoom.map(({ room: r, log }) => {
          const col = clTone(r.tone); const pct = Math.round(log.present.length / log.roster.length * 100); const sent = notified[r.id + ':' + dayKey];
          return (
            <Card key={r.id} padding="lg" interactive onClick={() => setOpenRoom(r.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${col} 12%, transparent)`, color: col, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="door-open" size={21} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text-strong)' }}>{r.name} Room</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{r.grade} · {log.subjects.length} subjects today</div>
                </div>
                <Badge tone={pct >= 90 ? 'success' : 'amber'} solid>{pct}%</Badge>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--success-50)', textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success-700)' }}>{log.present.length}</div><div style={{ fontSize: 11, color: 'var(--success-700)', fontWeight: 600 }}>Present</div></div>
                <div style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger-600)' }}>{log.absent.length}</div><div style={{ fontSize: 11, color: 'var(--danger-600)', fontWeight: 600 }}>Absent</div></div>
              </div>
              {/* absent names preview */}
              {log.absent.length > 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, color: 'var(--danger-600)' }}>Absent: </span>{log.absent.slice(0, 3).join(', ')}{log.absent.length > 3 ? ` +${log.absent.length - 3}` : ''}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                {sent ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--success-600)' }}><Icon name="check-check" size={15} color="var(--success-500)" />Parents notified</span>
                  : <button onClick={(e) => { e.stopPropagation(); setConfirm({ roomId: r.id, name: r.name }); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}><Icon name="send" size={14} />Notify parents</button>}
                <span style={{ marginInlineStart: 'auto', color: col, fontWeight: 700, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Open<Icon name="arrow-right" size={14} color={col} /></span>
              </div>
            </Card>
          );
        })}
      </div>

      {confirm && <F.ConfirmDialog icon="send" tone="manager" title={`Notify ${confirm.name} parents?`} message="Each parent gets today's attendance for their child — present/absent and exactly which subjects (and topics) they attended. Sent to the Parent app." confirmLabel="Send to parents" onConfirm={() => notifyRoom(confirm.roomId, dayKey, confirm.name)} onClose={() => setConfirm(null)} />}
      {toast && <F.Toast message={toast.msg} icon={toast.icon} tone={toast.tone} onDone={() => setToast(null)} />}
    </div>
  );
}

window.AttendanceView = AttendanceView;
