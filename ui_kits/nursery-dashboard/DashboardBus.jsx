const { useState: useStateBus } = React;

/* ====================================================================
   Masar — Dashboard · Bus management
   Multiple buses · add bus · bus profile (driver, students by area,
   live map, per-student pickup status)
   ==================================================================== */
const BUS_MGR = 'var(--role-manager)';
const BUS_BLUE = 'var(--role-driver)';

const SEED_BUSES = [
  {
    id: 'b3', no: '3', plate: '4281', capacity: 14, area: 'Dokki · Mohandessin',
    driver: { name: 'Tarek Saeed', phone: '+20 100 555 7788', nid: '28604121900713', photo: null },
    leg: 'am', // am = to school, pm = to home, idle
    status: 'moving',
    students: [
      { name: 'Yousef Adel', area: 'Dokki', addr: '12 El-Nasr St', picked: true },
      { name: 'Adam Sherif', area: 'Mohandessin', addr: '8 Gamal St', picked: true },
      { name: 'Hana Sami', area: 'Dokki', addr: '4 Tahrir St', picked: true },
      { name: 'Ziad Amr', area: 'Mohandessin', addr: '22 Lebnan St', picked: false },
      { name: 'Mariam Adel', area: 'Dokki', addr: '9 Dokki Sq', picked: false },
    ],
  },
  {
    id: 'b1', no: '1', plate: '3190', capacity: 12, area: 'Maadi · Zahraa',
    driver: { name: 'Sayed Ali', phone: '+20 101 222 3344', nid: '28801052000511', photo: null },
    leg: 'am', status: 'moving',
    students: [
      { name: 'Omar Khaled', area: 'Maadi', addr: '5 Tahrir St', picked: true },
      { name: 'Lina Adel', area: 'Maadi', addr: '12 El-Nasr St', picked: true },
      { name: 'Karim Wael', area: 'Zahraa', addr: '30 Zahraa St', picked: false },
      { name: 'Tia Nader', area: 'Maadi', addr: '17 Nasr Rd', picked: false },
    ],
  },
  {
    id: 'b2', no: '2', plate: '5523', capacity: 16, area: '6 October',
    driver: { name: 'Reda Kamal', phone: '+20 102 888 9900', nid: '28709231800621', photo: null },
    leg: 'idle', status: 'idle',
    students: [
      { name: 'Jana Mostafa', area: '6 October', addr: '3 Nile St', picked: false },
      { name: 'Malak Tarek', area: '6 October', addr: '20 Lotus St', picked: false },
      { name: 'Seif Ehab', area: '6 October', addr: '11 Hadaba St', picked: false },
    ],
  },
];

const LEG_META = {
  am: { label: 'Morning · to nursery', tone: 'amber', icon: 'sunrise' },
  pm: { label: 'Afternoon · to home', tone: 'info', icon: 'sunset' },
  idle: { label: 'Idle', tone: 'neutral', icon: 'circle-pause' },
};
const AREA_OPTS = ['Dokki · Mohandessin', 'Maadi · Zahraa', '6 October', 'Nasr City', 'New Cairo', 'Zamalek'];

/* ---------------- Add / Edit bus form ---------------- */
function BusForm({ initial, onClose, onSave }) {
  const F = window.DForms;
  const [b, setB] = useStateBus(initial || { no: '', plate: '', capacity: 14, area: AREA_OPTS[0], driver: { name: '', phone: '', nid: '', photo: null }, leg: 'idle', status: 'idle', students: [] });
  const [q, setQ] = useStateBus('');
  const set = (k, v) => setB(p => ({ ...p, [k]: v }));
  const setD = (k, v) => setB(p => ({ ...p, driver: { ...p.driver, [k]: v } }));
  const valid = b.no.trim() && b.plate.trim() && b.driver.name.trim() && b.driver.phone.trim();
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 };

  // all enrolled children to assign
  const all = (window.MASAR_childrenForBus ? window.MASAR_childrenForBus() : []);
  const chosen = b.students.map(s => s.name);
  const isOn = (name) => chosen.includes(name);
  const toggle = (kid) => {
    setB(p => {
      const on = p.students.some(s => s.name === kid.name);
      if (on) return { ...p, students: p.students.filter(s => s.name !== kid.name) };
      if (p.students.length >= p.capacity) return p; // respect capacity
      return { ...p, students: [...p.students, { name: kid.name, area: kid.area, addr: kid.addr, picked: false }] };
    });
  };
  const filtered = all.filter(k => !q || k.name.toLowerCase().includes(q.toLowerCase()) || k.area.toLowerCase().includes(q.toLowerCase()));
  // suggest children whose area matches the bus service area
  const areaWords = b.area.toLowerCase().split(/[·,&]/).map(s => s.trim()).filter(Boolean);
  const suggested = (k) => areaWords.some(w => k.area.toLowerCase().includes(w) || w.includes(k.area.toLowerCase()));

  return (
    <F.PModal icon={initial ? 'pen' : 'plus'} title={initial ? 'Edit bus' : 'Add bus'} subtitle={initial ? `Bus ${initial.no}` : 'Register a bus, driver & riders'} width={600} onClose={onClose} accent={BUS_BLUE}
      footer={<React.Fragment>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" fullWidth disabled={!valid} iconLeft={<Icon name="check" size={16} />} onClick={() => onSave(b)}>{initial ? 'Save bus' : 'Create bus & account'}</Button>
      </React.Fragment>}>
      <F.PSection icon="bus" title="Bus details">
        <div style={grid2}>
          <F.PField label="Bus number" required><F.PInput value={b.no} onChange={v => set('no', v)} placeholder="e.g. 5" /></F.PField>
          <F.PField label="Plate" required><F.PInput value={b.plate} onChange={v => set('plate', v)} placeholder="e.g. 4281" /></F.PField>
          <F.PField label="Capacity (seats)"><F.PInput type="number" value={b.capacity} onChange={v => set('capacity', parseInt(v) || 0)} placeholder="14" /></F.PField>
          <F.PField label="Service area" hint="Children in this area ride this bus"><F.PSelect value={b.area} onChange={v => set('area', v)} options={AREA_OPTS} /></F.PField>
        </div>
      </F.PSection>
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '18px 0' }} />
      <F.PSection icon="user-round" title="Driver">
        <div style={{ display: 'flex', gap: 18, marginBottom: 18 }}>
          <F.PPhoto name={b.driver.name} photo={b.driver.photo} onChange={v => setD('photo', v)} color={BUS_BLUE} />
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <F.PField label="Driver name" required span={2}><F.PInput value={b.driver.name} onChange={v => setD('name', v)} placeholder="Full name" /></F.PField>
            <F.PField label="Phone" required><F.PInput value={b.driver.phone} onChange={v => setD('phone', v)} placeholder="+20 …" icon="phone" /></F.PField>
            <F.PField label="National ID"><F.PInput value={b.driver.nid} onChange={v => setD('nid', v)} placeholder="14 digits" /></F.PField>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--radius-md)', background: 'color-mix(in srgb, var(--role-driver) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--role-driver) 22%, transparent)' }}>
          <Icon name="smartphone" size={17} color={BUS_BLUE} />
          <span style={{ fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.5 }}>A driver account is created on save — an activation link is sent straight to the driver's phone so they can set their own password and sign in to the Driver app.</span>
        </div>
      </F.PSection>
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '18px 0' }} />
      <F.PSection icon="users" title="Assign riders">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', flex: 1 }}>
            <Icon name="search" size={16} color="var(--text-subtle)" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search child or area…" style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: 13.5, width: '100%', color: 'var(--text-strong)' }} />
          </div>
          <Badge tone={b.students.length >= b.capacity ? 'amber' : 'teal'}>{b.students.length}/{b.capacity} seats</Badge>
        </div>
        <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
          {filtered.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No children match.</div>}
          {filtered.map((k, i) => {
            const on = isOn(k.name); const full = !on && b.students.length >= b.capacity;
            return (
              <button key={k.id} onClick={() => toggle(k)} disabled={full} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: 'none', borderTop: i ? '1px solid var(--border-subtle)' : 'none', background: on ? 'color-mix(in srgb, var(--role-driver) 8%, transparent)' : 'transparent', cursor: full ? 'not-allowed' : 'pointer', textAlign: 'start', opacity: full ? 0.5 : 1 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? BUS_BLUE : 'var(--border-strong)'}`, background: on ? BUS_BLUE : 'transparent', display: 'grid', placeItems: 'center', flex: 'none' }}>{on && <Icon name="check" size={13} color="#fff" />}</span>
                <Avatar name={k.name} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{k.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}><Icon name="map-pin" size={11} color="var(--text-subtle)" style={{ verticalAlign: '-1px', marginInlineEnd: 3 }} />{k.area} · {k.addr}</div>
                </div>
                {suggested(k) && !on && <Badge tone="teal">Same area</Badge>}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 8 }}>Selected children appear in the driver’s app with their address, in pickup order. “Same area” marks children matching this bus’s service area.</div>
      </F.PSection>
    </F.PModal>
  );
}

/* ---------------- Driver activation (after creating a bus) ----------------
   No password is generated or shown — an activation link is sent straight to
   the driver's own phone, matching the account-creation pattern used for
   parent and staff accounts elsewhere in the Dashboard (see DForms.AccountCreatedDialog). */
function CredRow({ label, value, icon }) {
  const [copied, setCopied] = useStateBus(false);
  const copy = () => { if (navigator.clipboard) navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1400); };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
      <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'color-mix(in srgb, var(--role-driver) 12%, transparent)', color: BUS_BLUE, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={18} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>{value}</div>
      </div>
      <button onClick={copy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: copied ? 'var(--success-50)' : 'var(--surface-raised)', color: copied ? 'var(--success-700)' : 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>
        <Icon name={copied ? 'check' : 'copy'} size={14} color={copied ? 'var(--success-600)' : 'var(--text-muted)'} />{copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
function DriverCredentials({ bus, onClose }) {
  const F = window.DForms;
  const username = bus.account.username;
  const [resent, setResentBus] = useStateBus(false);
  const shareText = `Masar Driver login for Bus ${bus.no}:\nHi ${bus.driver.name}, an activation link has been sent to your phone. Open it to set your own password and sign in to the Masar Driver app.`;
  // regenerate-activation-link (Epic 1 Edge Function) needs the driver's real
  // Auth user id (bus.account.userId). Driver accounts are still created
  // locally here (staff provisioning is Epic 3 scope), so no id exists yet —
  // see EPIC_1_INTEGRATION_REPORT.md.
  const triggerResend = async () => {
    if (!bus.account.userId) return;
    try { await window.MasarClient.regenerateActivationLink(bus.account.userId); } catch (err) { /* surfaced via button state only */ }
  };
  const wa = () => { window.open(`https://wa.me/${(bus.driver.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(shareText)}`, '_blank'); triggerResend(); };
  const resend = () => { setResentBus(true); setTimeout(() => setResentBus(false), 1600); triggerResend(); };
  return (
    <F.PModal icon="send" title="Activation link sent" subtitle={`Bus ${bus.no} · ${bus.driver.name}`} width={520} onClose={onClose} accent="var(--success-500)"
      footer={<React.Fragment>
        <Button variant="secondary" iconLeft={<Icon name="message-circle" size={16} />} onClick={wa}>Send via WhatsApp</Button>
        <Button variant="primary" fullWidth iconLeft={<Icon name="check" size={16} />} onClick={onClose}>Done</Button>
      </React.Fragment>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 'var(--radius-md)', background: 'var(--success-50)', border: '1px solid var(--success-100)', marginBottom: 18 }}>
        <Icon name="party-popper" size={20} color="var(--success-600)" />
        <span style={{ fontSize: 13, color: 'var(--success-800)', lineHeight: 1.5 }}>Bus <b>{bus.no}</b> is ready with <b>{bus.students.length}</b> riders assigned. {bus.driver.name} can set their own password and sign in.</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CredRow label="Username" value={username} icon="user-round" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 4px', fontSize: 12, color: 'var(--text-muted)' }}>
        <Icon name="shield-check" size={14} color="var(--success-600)" />
        <span>No password is generated or shown here — {bus.driver.name} sets their own from the activation link.</span>
      </div>
      <button onClick={resend} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 10, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
        <Icon name={resent ? 'check' : 'refresh-cw'} size={14} color="var(--text-muted)" />{resent ? 'Link resent' : 'Resend activation link'}
      </button>
    </F.PModal>
  );
}

/* ---------------- Live map for a bus ---------------- */
function BusLiveMap({ bus }) {
  const picked = bus.students.filter(s => s.picked).length;
  const route = 'M30 200 C 90 180, 110 120, 180 124 S 300 96, 330 50';
  return (
    <div style={{ position: 'relative', height: 280, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
      <svg width="100%" height="100%" viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
        <rect width="400" height="280" fill="#E9EEE8" />
        <rect x="24" y="20" width="120" height="74" rx="8" fill="#D7E5D4" /><rect x="250" y="170" width="130" height="90" rx="8" fill="#D7E5D4" />
        <rect x="170" y="30" width="90" height="56" rx="6" fill="#E6E2D6" /><rect x="40" y="150" width="100" height="64" rx="6" fill="#E6E2D6" />
        <g stroke="#fff" strokeWidth="13" strokeLinecap="round"><line x1="-5" y1="124" x2="405" y2="124" /><line x1="-5" y1="210" x2="405" y2="210" /><line x1="150" y1="-5" x2="150" y2="285" /><line x1="320" y1="-5" x2="320" y2="285" /></g>
        <path d={route} fill="none" stroke={BUS_BLUE} strokeWidth="4" strokeLinecap="round" />
        <path d={route} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 10" opacity="0.8" />
        {/* student stops */}
        {bus.students.map((s, i) => { const t = (i + 1) / (bus.students.length + 1); const x = 30 + t * 300; const y = 200 - t * 150 + (i % 2 ? 18 : -12); return <circle key={i} cx={x} cy={y} r="6" fill={s.picked ? BUS_BLUE : '#fff'} stroke={BUS_BLUE} strokeWidth="2.5" />; })}
      </svg>
      {/* nursery pin */}
      <span style={{ position: 'absolute', right: 56, top: 30 }}><Icon name="school" size={26} color="var(--teal-700)" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.25))' }} /></span>
      {/* moving bus */}
      <span style={{ position: 'absolute', width: 36, height: 36, borderRadius: '50%', background: 'var(--amber-500)', display: 'grid', placeItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.25), 0 0 0 6px rgba(239,159,39,.22)', offsetPath: `path('${route}')`, animation: 'busDashMove 7s ease-in-out infinite alternate' }}><Icon name="bus" size={18} color="#1C1C1A" /></span>
      <span style={{ position: 'absolute', top: 12, insetInlineStart: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 'var(--radius-pill)', background: 'rgba(255,255,255,.92)', boxShadow: 'var(--shadow-sm)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--amber-500)', animation: 'busDashBlink 1.4s infinite' }} /><span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-strong)' }}>LIVE · {picked}/{bus.students.length} on board</span></span>
    </div>
  );
}
if (!document.getElementById('busdash-anim')) { const s = document.createElement('style'); s.id = 'busdash-anim'; s.textContent = '@keyframes busDashMove{from{offset-distance:8%}to{offset-distance:90%}}@keyframes busDashBlink{0%,100%{opacity:1}50%{opacity:.3}}'; document.head.appendChild(s); }

/* ---------------- Bus profile ---------------- */
function BusProfile({ bus, onBack, onEdit, setBuses, buses }) {
  const lm = LEG_META[bus.leg];
  const picked = bus.students.filter(s => s.picked).length;
  const pending = bus.students.filter(s => !s.picked);
  const onboard = bus.students.filter(s => s.picked);
  // group students by area
  const byArea = {};
  bus.students.forEach(s => { (byArea[s.area] = byArea[s.area] || []).push(s); });

  const togglePicked = (name) => {
    setBuses(buses.map(b => b.id === bus.id ? { ...b, students: b.students.map(s => s.name === name ? { ...s, picked: !s.picked } : s) } : b));
  };
  // bus reference after update
  const live = buses.find(b => b.id === bus.id) || bus;
  const livePicked = live.students.filter(s => s.picked).length;

  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #2D6CB5, #1E4E86)', padding: '22px 32px 26px' }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 13px', borderRadius: 'var(--radius-pill)', border: '1px solid rgba(245,243,238,.28)', background: 'rgba(245,243,238,.12)', color: '#F5F3EE', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 18 }}><Icon name="arrow-left" size={16} color="#F5F3EE" />All buses</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ width: 60, height: 60, borderRadius: 'var(--radius-lg)', background: 'rgba(245,243,238,.16)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="bus" size={30} color="#F5F3EE" /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#F5F3EE' }}>Bus {bus.no}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6, fontSize: 13.5, color: 'rgba(245,243,238,.85)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="hash" size={14} color="rgba(245,243,238,.85)" />Plate {bus.plate}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="map-pin" size={14} color="rgba(245,243,238,.85)" />{bus.area}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="users" size={14} color="rgba(245,243,238,.85)" />{bus.students.length}/{bus.capacity}</span>
            </div>
          </div>
          <Button variant="amber" iconLeft={<Icon name="pen" size={16} />} onClick={onEdit}>Edit bus</Button>
        </div>
      </div>

      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* driver + status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Card padding="lg" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar name={bus.driver.name} src={bus.driver.photo} size={54} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>Driver</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>{bus.driver.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{bus.driver.phone}</div>
            </div>
            <Button size="sm" variant="secondary" iconLeft={<Icon name="phone" size={15} />}>Call</Button>
          </Card>
          <Card padding="lg" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 48, height: 48, borderRadius: '50%', background: lm.tone === 'amber' ? 'var(--amber-50)' : lm.tone === 'info' ? 'var(--info-50)' : 'var(--bg-sunken)', color: lm.tone === 'amber' ? 'var(--amber-600)' : lm.tone === 'info' ? 'var(--info-500)' : 'var(--text-subtle)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={lm.icon} size={24} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>Current trip</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>{lm.label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{livePicked}/{bus.students.length} children on board</div>
            </div>
          </Card>
        </div>

        {/* live map (only when not idle) */}
        {bus.leg !== 'idle' && (
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Live location</h3>
            <BusLiveMap bus={live} />
          </div>
        )}

        {/* on board / pending summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
          <StatCard label="On board" value={livePicked} accent="var(--success-500)" icon={<Icon name="user-check" size={16} />} />
          <StatCard label="Not yet picked" value={bus.students.length - livePicked} accent="var(--amber-600)" icon={<Icon name="user-round" size={16} />} />
          <StatCard label="Seats free" value={bus.capacity - bus.students.length} accent={BUS_MGR} icon={<Icon name="armchair" size={16} />} />
        </div>

        {/* students grouped by area, per-student pickup status */}
        <Card padding="none" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-strong)' }}>Students on this bus</h3>
            <span style={{ marginInlineStart: 'auto', fontSize: 12.5, color: 'var(--text-muted)' }}>Grouped by area · toggle pickup to simulate</span>
          </div>
          {Object.entries(byArea).map(([area, kids], gi) => (
            <div key={gi}>
              <div style={{ padding: '8px 20px', background: 'var(--bg-app)', fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="map-pin" size={13} color="var(--text-subtle)" />{area}</div>
              {kids.map((s, i) => {
                const liveStudent = live.students.find(x => x.name === s.name) || s;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                    <Avatar name={s.name} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.addr}</div>
                    </div>
                    {liveStudent.picked
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--success-700)', background: 'var(--success-50)', padding: '5px 11px', borderRadius: 'var(--radius-pill)' }}><Icon name="check-check" size={14} color="var(--success-600)" />On board</span>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--amber-700)', background: 'var(--amber-50)', padding: '5px 11px', borderRadius: 'var(--radius-pill)' }}><Icon name="clock" size={14} color="var(--amber-600)" />Waiting</span>}
                    <button onClick={() => togglePicked(s.name)} style={{ height: 32, padding: '0 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{liveStudent.picked ? 'Undo' : 'Mark picked'}</button>
                  </div>
                );
              })}
            </div>
          ))}
        </Card>

        {/* progress message */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 'var(--radius-lg)', background: 'var(--teal-50)', border: '1px solid var(--teal-100)' }}>
          <Icon name="info" size={20} color="var(--teal-700)" />
          <span style={{ fontSize: 12.5, color: 'var(--teal-800)', lineHeight: 1.5 }}>
            {pending.length === 0
              ? <React.Fragment><b>All children picked up.</b> Each parent was notified the moment their child boarded; reception confirms arrival at the nursery.</React.Fragment>
              : <React.Fragment>Bus has <b>{onboard.map(s => s.name.split(' ')[0]).join(', ') || 'no one'}</b>. Still to pick up: <b>{pending.map(s => s.name.split(' ')[0]).join(', ')}</b>. Parents are notified per child on pickup.</React.Fragment>}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Buses list view ---------------- */
function BusView() {
  const F = window.DForms;
  const [buses, setBuses] = useStateBus(SEED_BUSES);
  const [open, setOpen] = useStateBus(null);
  const [form, setForm] = useStateBus(null);
  const [confirm, setConfirm] = useStateBus(null);
  const [toast, setToast] = useStateBus(null);
  const [cred, setCred] = useStateBus(null);

  const save = (b) => {
    if (form.mode === 'edit') { setBuses(prev => prev.map(x => x.id === b.id ? b : x)); if (open) setOpen(b); setToast({ msg: `Bus ${b.no} updated`, icon: 'check' }); setForm(null); }
    else {
      const account = { username: ('driver.bus' + b.no).toLowerCase().replace(/\s+/g, ''), activationSent: true };
      const nb = { ...b, id: 'b' + Date.now(), account };
      setBuses(prev => [...prev, nb]);
      setForm(null);
      setCred(nb);
    }
  };
  const del = (b) => { setBuses(prev => prev.filter(x => x.id !== b.id)); setOpen(null); setToast({ msg: `Bus ${b.no} removed`, icon: 'trash-2', tone: 'amber' }); };

  const inTransit = buses.filter(b => b.leg !== 'idle');
  const childrenInTransit = inTransit.reduce((n, b) => n + b.students.filter(s => s.picked).length, 0);

  if (open) {
    const liveBus = buses.find(b => b.id === open.id) || open;
    return (
      <React.Fragment>
        <BusProfile bus={liveBus} buses={buses} setBuses={setBuses} onBack={() => setOpen(null)} onEdit={() => setForm({ mode: 'edit', bus: liveBus })} />
        {form && <BusForm initial={form.bus} onClose={() => setForm(null)} onSave={save} />}
        {toast && <F.Toast message={toast.msg} icon={toast.icon} tone={toast.tone} onDone={() => setToast(null)} />}
      </React.Fragment>
    );
  }

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
        <StatCard label="Buses" value={buses.length} accent={BUS_MGR} icon={<Icon name="bus" size={16} />} />
        <StatCard label="In transit" value={inTransit.length} accent="var(--amber-600)" icon={<Icon name="navigation" size={16} />} />
        <StatCard label="Children riding" value={childrenInTransit} accent={BUS_BLUE} icon={<Icon name="users" size={16} />} />
        <StatCard label="Drivers" value={buses.length} accent="var(--success-500)" icon={<Icon name="user-round" size={16} />} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Fleet</h3>
        <Button variant="primary" size="sm" iconLeft={<Icon name="plus" size={16} />} style={{ marginInlineStart: 'auto' }} onClick={() => setForm({ mode: 'add' })}>Add bus</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        {buses.map(b => {
          const lm = LEG_META[b.leg]; const picked = b.students.filter(s => s.picked).length; const seatsFree = b.capacity - b.students.length;
          return (
            <Card key={b.id} padding="none" style={{ overflow: 'hidden' }}>
              <div onClick={() => setOpen(b)} style={{ cursor: 'pointer' }}>
                <div style={{ padding: '16px 18px', background: b.leg === 'idle' ? 'var(--bg-app)' : 'linear-gradient(135deg, color-mix(in srgb, var(--role-driver) 14%, transparent), transparent)', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ width: 46, height: 46, borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', color: BUS_BLUE, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 18, border: '1px solid var(--border-subtle)' }}>{b.no}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text-strong)' }}>Bus {b.no}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.area}</div>
                  </div>
                  <Badge tone={lm.tone === 'neutral' ? 'neutral' : lm.tone} dot>{b.leg === 'idle' ? 'Idle' : b.leg === 'am' ? 'To nursery' : 'To home'}</Badge>
                </div>
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Avatar name={b.driver.name} src={b.driver.photo} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>{b.driver.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>{b.plate}</div>
                    </div>
                  </div>
                  {/* seat fill */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{b.students.length}/{b.capacity} assigned · {seatsFree} free</span>
                    {b.leg !== 'idle' && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber-700)' }}>{picked}/{b.students.length} on board</span>}
                  </div>
                  <div style={{ height: 7, borderRadius: 'var(--radius-pill)', background: 'var(--bg-sunken)', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${b.students.length / b.capacity * 100}%`, background: BUS_BLUE }} />
                  </div>
                </div>
                <div style={{ padding: '11px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}><Icon name="users" size={13} color="var(--text-subtle)" style={{ verticalAlign: '-2px', marginInlineEnd: 4 }} />{b.students.length} students</span>
                  <span style={{ marginInlineStart: 'auto', color: BUS_BLUE, fontWeight: 700, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>View<Icon name="arrow-right" size={14} color={BUS_BLUE} /></span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {form && <BusForm initial={form.mode === 'edit' ? form.bus : null} onClose={() => setForm(null)} onSave={save} />}
      {cred && <DriverCredentials bus={cred} onClose={() => { setCred(null); setToast({ msg: `Bus ${cred.no} added · driver account created`, icon: 'bus' }); }} />}
      {confirm && <F.ConfirmDialog icon="trash-2" tone="danger" title={`Remove Bus ${confirm.no}?`} message="This unassigns its students and removes the driver account. This cannot be undone." confirmLabel="Remove bus" onConfirm={() => del(confirm)} onClose={() => setConfirm(null)} />}
      {toast && <F.Toast message={toast.msg} icon={toast.icon} tone={toast.tone} onDone={() => setToast(null)} />}
    </div>
  );
}

window.BusView = BusView;
