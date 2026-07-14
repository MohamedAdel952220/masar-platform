const { useState: usePAX } = React;

/* ====================================================================
   Masar — Platform Admin · Extra SaaS-operator views
   Support tickets · System health · Broadcast · Audit log
   Exposes window.{PSupportView, PHealthView, PBroadcastView, PAuditView}
   ==================================================================== */
const PAX = '#4F46B5';
function paxTone(t) { return ({ success: 'var(--success-500)', amber: 'var(--amber-500)', danger: 'var(--danger-500)', info: 'var(--info-500)', teal: 'var(--teal-600)' })[t] || 'var(--neutral-500)'; }

/* ---------------- SUPPORT TICKETS ---------------- */
const SEED_TICKETS = [
  { id: 'T-1042', school: 'Little Stars KG', subject: 'Reception camera feed offline', sev: 'high', status: 'open', cat: 'Technical', ago: '2h', by: 'Omar Sherif' },
  { id: 'T-1041', school: 'Bright Minds', subject: 'How do I bulk-import children?', sev: 'low', status: 'open', cat: 'How-to', ago: '5h', by: 'Rana Adel' },
  { id: 'T-1039', school: 'Sunrise Nursery', subject: 'Add a second bus route', sev: 'med', status: 'progress', cat: 'Request', ago: '1d', by: 'Nadia Fouad' },
  { id: 'T-1035', school: 'Green Valley', subject: 'Parent app login email not received', sev: 'high', status: 'progress', cat: 'Technical', ago: '1d', by: 'Sara Nabil' },
  { id: 'T-1028', school: 'Sunrise Nursery', subject: 'Invoice PDF formatting', sev: 'low', status: 'resolved', cat: 'Billing', ago: '3d', by: 'Nadia Fouad' },
];
const SEV_META = { high: ['danger', 'High'], med: ['amber', 'Medium'], low: ['info', 'Low'] };
const TSTATUS = { open: ['amber', 'Open'], progress: ['info', 'In progress'], resolved: ['success', 'Resolved'] };

function PSupportView({ toast }) {
  const [tickets, setTickets] = usePAX(SEED_TICKETS);
  const [filter, setFilter] = usePAX('open');
  const setStatus = (id, status) => { setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t)); toast && toast(`Ticket ${id} → ${TSTATUS[status][1]}`); };
  const shown = tickets.filter(t => filter === 'all' ? true : filter === 'open' ? t.status !== 'resolved' : t.status === filter);
  const openCount = tickets.filter(t => t.status !== 'resolved').length;

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
        <StatCard label="Open tickets" value={openCount} accent="var(--amber-600)" icon={<Icon name="ticket" size={16} />} />
        <StatCard label="High priority" value={tickets.filter(t => t.sev === 'high' && t.status !== 'resolved').length} accent="var(--danger-500)" icon={<Icon name="flame" size={16} />} />
        <StatCard label="Avg. first reply" value="42" unit="min" accent="var(--teal-600)" icon={<Icon name="timer" size={16} />} />
        <StatCard label="Resolved · 30d" value={128} accent="var(--success-500)" icon={<Icon name="check-check" size={16} />} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[['open', 'Open'], ['progress', 'In progress'], ['resolved', 'Resolved'], ['all', 'All']].map(([v, l]) => {
          const on = filter === v;
          return <button key={v} onClick={() => setFilter(v)} style={{ height: 38, padding: '0 16px', borderRadius: 'var(--radius-pill)', border: `1px solid ${on ? PAX : 'var(--border-subtle)'}`, background: on ? PAX : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>{l}</button>;
        })}
      </div>
      <Card padding="none" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
          <thead><tr style={{ background: 'var(--bg-app)' }}>{['Ticket', 'School', 'Subject', 'Priority', 'Status', ''].map((h, i) => <th key={i} style={{ textAlign: 'start', padding: '11px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {shown.map(t => {
              const [sc, sl] = SEV_META[t.sev]; const [stc, stl] = TSTATUS[t.status];
              return (
                <tr key={t.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '13px 20px', fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>{t.id}</td>
                  <td style={{ padding: '13px 20px', fontSize: 13.5, color: 'var(--text-body)' }}>{t.school}</td>
                  <td style={{ padding: '13px 20px', fontSize: 13.5, color: 'var(--text-strong)', fontWeight: 600 }}>{t.subject}<div style={{ fontSize: 11.5, color: 'var(--text-subtle)', fontWeight: 400, marginTop: 2 }}>{t.cat} · {t.by} · {t.ago} ago</div></td>
                  <td style={{ padding: '13px 20px' }}><Badge tone={sc} dot>{sl}</Badge></td>
                  <td style={{ padding: '13px 20px' }}><Badge tone={stc} dot>{stl}</Badge></td>
                  <td style={{ padding: '10px 16px', textAlign: 'end' }}>
                    {t.status === 'open' && <Button variant="secondary" size="sm" onClick={() => setStatus(t.id, 'progress')}>Take</Button>}
                    {t.status === 'progress' && <Button variant="primary" size="sm" style={{ background: PAX }} onClick={() => setStatus(t.id, 'resolved')}>Resolve</Button>}
                    {t.status === 'resolved' && <span style={{ fontSize: 12.5, color: 'var(--text-subtle)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={14} color="var(--success-500)" />Done</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------------- SYSTEM HEALTH ---------------- */
const SERVICES = [
  { name: 'API Gateway', status: 'up', uptime: '99.98%', latency: '82ms' },
  { name: 'Parent App', status: 'up', uptime: '99.95%', latency: '120ms' },
  { name: 'Teacher App', status: 'up', uptime: '99.97%', latency: '110ms' },
  { name: 'Reception / QR service', status: 'up', uptime: '99.92%', latency: '95ms' },
  { name: 'Driver GPS stream', status: 'degraded', uptime: '99.10%', latency: '410ms' },
  { name: 'Camera relay (CCTV)', status: 'up', uptime: '99.80%', latency: '160ms' },
  { name: 'Notifications (Push/SMS/WA)', status: 'up', uptime: '99.99%', latency: '70ms' },
  { name: 'Payments & billing', status: 'up', uptime: '100%', latency: '90ms' },
];
const SVC_STATUS = { up: ['success', 'Operational'], degraded: ['amber', 'Degraded'], down: ['danger', 'Outage'] };

function PHealthView() {
  const allUp = SERVICES.every(s => s.status === 'up');
  const bars = [98, 100, 100, 99, 100, 97, 100, 100, 99, 100, 96, 100, 100, 100, 99, 100, 100, 98, 100, 100, 99, 100, 100, 100, 92, 100, 100, 99, 100, 100];
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card padding="lg" style={{ display: 'flex', alignItems: 'center', gap: 16, background: allUp ? 'var(--success-50)' : 'var(--amber-50)', border: `1px solid ${allUp ? 'var(--success-100)' : 'var(--amber-200)'}` }}>
        <span style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--surface-card)', color: allUp ? 'var(--success-600)' : 'var(--amber-600)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={allUp ? 'shield-check' : 'triangle-alert'} size={28} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)' }}>{allUp ? 'All systems operational' : 'Partial degradation — Driver GPS stream'}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Platform-wide uptime 99.94% over the last 30 days</div>
        </div>
        <Badge tone={allUp ? 'success' : 'amber'} solid>{allUp ? 'Healthy' : '1 degraded'}</Badge>
      </Card>

      <Card padding="none" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Services</h3></div>
        {SERVICES.map((s, i) => {
          const [tc, tl] = SVC_STATUS[s.status];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: paxTone(tc), flex: 'none' }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>{s.name}</span>
              <span style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 22 }}>
                {bars.map((b, j) => <span key={j} style={{ width: 3, height: `${b * 0.22}px`, borderRadius: 1, background: b < 95 ? 'var(--amber-500)' : 'var(--success-400, var(--success-500))', opacity: 0.5 + (j / 60) }} />)}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: 64, textAlign: 'end' }}>{s.uptime}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', minWidth: 56, textAlign: 'end' }}>{s.latency}</span>
              <Badge tone={tc} dot>{tl}</Badge>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/* ---------------- BROADCAST ---------------- */
function PBroadcastView({ toast, canManage }) {
  const [audience, setAudience] = usePAX('all');
  const [channel, setChannel] = usePAX({ inapp: true, email: true });
  const [title, setTitle] = usePAX('');
  const [body, setBody] = usePAX('');
  const [sent, setSent] = usePAX(false);
  const aud = [
    { v: 'all', label: 'All schools', n: 5 },
    { v: 'premium', label: 'Premium plan', n: 2 },
    { v: 'overdue', label: 'Overdue accounts', n: 1 },
    { v: 'trial', label: 'Trial accounts', n: 1 },
  ];
  const reach = aud.find(a => a.v === audience).n;
  const field = { width: '100%', padding: '12px 14px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14.5, fontFamily: 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };

  if (sent) {
    return (
      <div style={{ padding: 32, display: 'grid', placeItems: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <span style={{ width: 78, height: 78, borderRadius: '50%', background: 'var(--success-50)', color: 'var(--success-600)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}><Icon name="send" size={38} /></span>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-strong)' }}>Broadcast sent</h2>
          <p style={{ margin: '10px 0 24px', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.55 }}>Delivered to <b>{reach} school{reach > 1 ? 's' : ''}</b> via {[channel.inapp && 'in-app', channel.email && 'email'].filter(Boolean).join(' + ')}.</p>
          <Button variant="secondary" onClick={() => { setSent(false); setTitle(''); setBody(''); }}>New broadcast</Button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: 32, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card padding="lg">
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)', marginBottom: 8 }}>Audience</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {aud.map(a => { const on = audience === a.v; return (
            <button key={a.v} onClick={() => setAudience(a.v)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? PAX : 'var(--border-subtle)'}`, background: on ? 'color-mix(in srgb, #4F46B5 8%, transparent)' : 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${on ? PAX : 'var(--border-strong)'}`, display: 'grid', placeItems: 'center', flex: 'none' }}>{on && <span style={{ width: 10, height: 10, borderRadius: '50%', background: PAX }} />}</span>
              <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{a.label}</span><span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{a.n} recipient{a.n > 1 ? 's' : ''}</span></span>
            </button>
          ); })}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)', marginBottom: 8 }}>Channels</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[['inapp', 'In-app notice', 'bell'], ['email', 'Email', 'mail']].map(([k, label, ic]) => { const on = channel[k]; return (
            <button key={k} onClick={() => setChannel(c => ({ ...c, [k]: !c[k] }))} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 'var(--radius-pill)', border: `1.5px solid ${on ? PAX : 'var(--border-subtle)'}`, background: on ? 'color-mix(in srgb, #4F46B5 8%, transparent)' : 'var(--surface-card)', color: on ? PAX : 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}><Icon name={on ? 'check' : ic} size={16} color={on ? PAX : 'var(--text-muted)'} />{label}</button>
          ); })}
        </div>
        <div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)', marginBottom: 7 }}>Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Scheduled maintenance this Friday" style={field} /></div>
        <div><label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)', marginBottom: 7 }}>Message</label><textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write the announcement to your schools…" style={{ ...field, minHeight: 110, resize: 'none', lineHeight: 1.5 }} /></div>
      </Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Reaching <b style={{ color: 'var(--text-strong)' }}>{reach}</b> school{reach > 1 ? 's' : ''}</span>
        {canManage
          ? <Button variant="primary" style={{ marginInlineStart: 'auto', background: PAX }} disabled={!title.trim() || !body.trim() || (!channel.inapp && !channel.email)} iconLeft={<Icon name="send" size={17} />} onClick={() => setSent(true)}>Send broadcast</Button>
          : <span style={{ marginInlineStart: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: 'var(--text-subtle)' }}><Icon name="lock" size={14} color="var(--text-subtle)" />Platform-wide broadcast requires Owner or Admin access</span>}
      </div>
    </div>
  );
}

/* ---------------- AUDIT LOG ---------------- */
const SEED_AUDIT = [
  { icon: 'building-2', c: 'teal', actor: 'Tarek Owner', action: 'provisioned new school', target: 'Bright Minds', ago: '2h', ip: '41.x.x.18' },
  { icon: 'credit-card', c: 'success', actor: 'System', action: 'recorded payment', target: 'Sunrise Nursery · EGP 11,000', ago: '5h', ip: '—' },
  { icon: 'mail', c: 'amber', actor: 'Tarek Owner', action: 'sent overdue notice', target: 'Little Stars KG', ago: '1d', ip: '41.x.x.18' },
  { icon: 'toggle-right', c: 'info', actor: 'Tarek Owner', action: 'enabled Driver App feature', target: 'Green Valley', ago: '1d', ip: '41.x.x.18' },
  { icon: 'user-plus', c: 'teal', actor: 'System', action: 'created app accounts', target: 'Bright Minds · 4 portals', ago: '2d', ip: '—' },
  { icon: 'shield', c: 'danger', actor: 'Tarek Owner', action: 'suspended tenant', target: 'Old Oak KG (non-payment)', ago: '4d', ip: '41.x.x.18' },
  { icon: 'settings', c: 'info', actor: 'Mona Admin', action: 'changed plan', target: 'Little Stars KG → Growth', ago: '5d', ip: '196.x.x.7' },
];
function PAuditView() {
  const [q, setQ] = usePAX('');
  const rows = SEED_AUDIT.filter(a => !q || (a.actor + a.action + a.target).toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ padding: 32, maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', width: 300 }}>
        <Icon name="search" size={16} color="var(--text-subtle)" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search audit log…" style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: 13.5, width: '100%', color: 'var(--text-strong)' }} />
      </div>
      <Card padding="none" style={{ overflow: 'hidden' }}>
        {rows.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
            <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${paxTone(a.c)} 12%, transparent)`, color: paxTone(a.c), display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={a.icon} size={19} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: 'var(--text-strong)' }}><b>{a.actor}</b> {a.action} <b>{a.target}</b></div>
              <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{a.ago} ago · IP {a.ip}</div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No matching entries.</div>}
      </Card>
    </div>
  );
}

Object.assign(window, { PSupportView, PHealthView, PBroadcastView, PAuditView });
