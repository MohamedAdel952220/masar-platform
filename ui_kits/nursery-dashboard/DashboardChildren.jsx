const { useState: useStateC } = React;

/* ====================================================================
   Masar — Dashboard · Children (full CRUD + profile)
   ==================================================================== */
const DC_MGR = 'var(--role-manager)';
const CLS_OPTS = ['KG2 · Sunflower', 'KG1 · Tulip', 'KG2 · Rose', 'KG1 · Daisy'];
const PKG_OPTS = ['Full Day', 'Half Day'];

const SEED_CHILDREN = [
  {
    id: 'c1', name: 'Yousef Adel', cls: 'KG2 · Sunflower', status: 'classroom', att: 96, pkg: 'Full Day', photo: null,
    dob: '2021-03-14', gender: 'Male', blood: 'O+', allergies: 'None', notes: 'Loves story time. Wears glasses for reading.',
    father: { name: 'Mohamed Adel', phone: '+20 100 123 4567', job: 'Engineer', nid: '28903141200915' },
    mother: { name: 'Salma Hassan', phone: '+20 100 765 4321', job: 'Pharmacist', nid: '29001152300411' },
    emergency: { name: 'Adel Mahmoud', phone: '+20 101 555 7788', relation: 'Grandfather' },
    address: { street: '12 El-Nasr St', building: 'Bldg 4, Apt 9', area: 'Dokki', city: 'Giza', x: 0.32, y: 0.46, lat: '30.0381', lng: '31.3512' },
    billing: { fee: 2400, paid: 2400, balance: 0, status: 'active', cycle: 'Monthly', nextDue: 'Jul 1' },
  },
  {
    id: 'c2', name: 'Lina Adel', cls: 'KG1 · Tulip', status: 'playing', att: 92, pkg: 'Half Day', photo: null,
    dob: '2022-06-02', gender: 'Female', blood: 'A+', allergies: 'Peanuts', notes: 'Shy in the mornings, settles after circle time.',
    father: { name: 'Mohamed Adel', phone: '+20 100 123 4567', job: 'Engineer', nid: '28903141200915' },
    mother: { name: 'Salma Hassan', phone: '+20 100 765 4321', job: 'Pharmacist', nid: '29001152300411' },
    emergency: { name: 'Adel Mahmoud', phone: '+20 101 555 7788', relation: 'Grandfather' },
    address: { street: '12 El-Nasr St', building: 'Bldg 4, Apt 9', area: 'Dokki', city: 'Giza', x: 0.32, y: 0.46, lat: '30.0381', lng: '31.3512' },
    billing: { fee: 1600, paid: 1600, balance: 0, status: 'active', cycle: 'Monthly', nextDue: 'Jul 1' },
  },
  {
    id: 'c3', name: 'Omar Khaled', cls: 'KG2 · Sunflower', status: 'at-home', att: 78, pkg: 'Full Day', photo: null,
    dob: '2021-01-20', gender: 'Male', blood: 'B+', allergies: 'None', notes: 'Very active, enjoys outdoor play.',
    father: { name: 'Khaled Sami', phone: '+20 102 333 1122', job: 'Accountant', nid: '28701201400713' },
    mother: { name: 'Nada Fouad', phone: '+20 102 444 9988', job: 'Teacher', nid: '28905162100822' },
    emergency: { name: 'Sami Khaled', phone: '+20 103 222 3344', relation: 'Uncle' },
    address: { street: '5 Tahrir St', building: 'Bldg 11, Apt 3', area: 'Maadi', city: 'Cairo', x: 0.58, y: 0.62, lat: '30.0102', lng: '31.4012' },
    billing: { fee: 2400, paid: 1200, balance: 1200, status: 'overdue', cycle: 'Monthly', nextDue: 'Jun 1' },
  },
  {
    id: 'c4', name: 'Malak Tarek', cls: 'KG1 · Daisy', status: 'classroom', att: 88, pkg: 'Full Day', photo: null,
    dob: '2022-02-11', gender: 'Female', blood: 'AB+', allergies: 'Lactose', notes: 'Needs lactose-free milk.',
    father: { name: 'Tarek Nabil', phone: '+20 106 777 6655', job: 'Doctor', nid: '28503111600219' },
    mother: { name: 'Heba Samir', phone: '+20 106 888 4433', job: 'Dentist', nid: '28811042700121' },
    emergency: { name: 'Nabil Tarek', phone: '+20 107 111 2233', relation: 'Grandfather' },
    address: { street: '20 Lotus St', building: 'Villa 7', area: 'New Cairo', city: 'Cairo', x: 0.72, y: 0.3, lat: '30.0288', lng: '31.4719' },
    billing: { fee: 2400, paid: 2400, balance: 0, status: 'active', cycle: 'Yearly', nextDue: 'Sep 1' },
  },
  {
    id: 'c5', name: 'Adam Sherif', cls: 'KG2 · Rose', status: 'in-bus', att: 81, pkg: 'Half Day', photo: null,
    dob: '2021-09-09', gender: 'Male', blood: 'O-', allergies: 'None', notes: 'Rides Bus 3.',
    father: { name: 'Sherif Adel', phone: '+20 109 555 1212', job: 'Architect', nid: '28609092100517' },
    mother: { name: 'Mariam Adel', phone: '+20 109 666 3434', job: 'Designer', nid: '29002281900613' },
    emergency: { name: 'Adel Sherif', phone: '+20 100 999 8877', relation: 'Uncle' },
    address: { street: '8 Gamal St', building: 'Bldg 2, Apt 14', area: 'Mohandessin', city: 'Giza', x: 0.24, y: 0.36, lat: '30.0561', lng: '31.3289' },
    billing: { fee: 1600, paid: 0, balance: 1600, status: 'overdue', cycle: 'Monthly', nextDue: 'Jun 1' },
  },
  {
    id: 'c6', name: 'Jana Mostafa', cls: 'KG1 · Daisy', status: 'nap', att: 99, pkg: 'Full Day', photo: null,
    dob: '2022-04-25', gender: 'Female', blood: 'A-', allergies: 'None', notes: 'Top attendance this term.',
    father: { name: 'Mostafa Ali', phone: '+20 111 222 3333', job: 'Banker', nid: '28704251800915' },
    mother: { name: 'Yara Hany', phone: '+20 111 444 5555', job: 'Lawyer', nid: '29005121700821' },
    emergency: { name: 'Hany Mostafa', phone: '+20 112 333 4444', relation: 'Grandfather' },
    address: { street: '3 Nile St', building: 'Bldg 9, Apt 2', area: 'Zamalek', city: 'Cairo', x: 0.44, y: 0.5, lat: '30.0612', lng: '31.2201' },
    billing: { fee: 2400, paid: 2400, balance: 0, status: 'active', cycle: 'Monthly', nextDue: 'Jul 1' },
  },
];

function statusLabel(s) { return ({ classroom: 'In Classroom', playing: 'Playing', 'at-home': 'At Home', 'in-bus': 'In Bus', nap: 'Nap Time', delivered: 'Delivered', suspended: 'Suspended' })[s] || s; }

/* ---------------- Add / Edit form ---------------- */
function ChildForm({ initial, onClose, onSave }) {
  const F = window.DForms;
  const [c, setC] = useStateC(initial || {
    name: '', cls: CLS_OPTS[0], pkg: 'Full Day', dob: '', gender: 'Male', blood: '', allergies: '', notes: '', photo: null,
    father: { name: '', phone: '', job: '', nid: '' }, mother: { name: '', phone: '', job: '', nid: '' },
    emergency: { name: '', phone: '', relation: '' }, address: { street: '', building: '', area: '', city: 'Cairo' },
    billing: { fee: 2400, cycle: 'Monthly' },
  });
  const set = (k, v) => setC(p => ({ ...p, [k]: v }));
  const setN = (grp, k, v) => setC(p => ({ ...p, [grp]: { ...p[grp], [k]: v } }));
  const valid = c.name.trim() && c.father.name.trim() && c.father.phone.trim();
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 };

  return (
    <F.PModal icon={initial ? 'user-pen' : 'user-plus'} title={initial ? 'Edit child' : 'Add new child'} subtitle={initial ? c.name : 'Enrolment & guardian details'} onClose={onClose}
      footer={<React.Fragment>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" fullWidth disabled={!valid} iconLeft={<Icon name="check" size={16} />} onClick={() => onSave(c)}>{initial ? 'Save changes' : 'Add child'}</Button>
      </React.Fragment>}>

      {/* Child */}
      <F.PSection icon="baby" title="Child details">
        <div style={{ display: 'flex', gap: 18, marginBottom: 18 }}>
          <F.PPhoto name={c.name} photo={c.photo} onChange={v => set('photo', v)} />
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <F.PField label="Full name" required span={2}><F.PInput value={c.name} onChange={v => set('name', v)} placeholder="Child full name" /></F.PField>
            <F.PField label="Date of birth"><F.PInput type="date" value={c.dob} onChange={v => set('dob', v)} /></F.PField>
            <F.PField label="Gender"><F.PSelect value={c.gender} onChange={v => set('gender', v)} options={['Male', 'Female']} /></F.PField>
          </div>
        </div>
        <div style={grid2}>
          <F.PField label="Classroom"><F.PSelect value={c.cls} onChange={v => set('cls', v)} options={CLS_OPTS} /></F.PField>
          <F.PField label="Package"><F.PSeg value={c.pkg} onChange={v => set('pkg', v)} options={PKG_OPTS} /></F.PField>
          <F.PField label="Blood type"><F.PInput value={c.blood} onChange={v => set('blood', v)} placeholder="e.g. O+" /></F.PField>
          <F.PField label="Allergies"><F.PInput value={c.allergies} onChange={v => set('allergies', v)} placeholder="None / list" /></F.PField>
        </div>
        <F.PField label="Notes for staff"><F.PTextarea value={c.notes} onChange={v => set('notes', v)} placeholder="Medical, dietary or care notes…" /></F.PField>
      </F.PSection>

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0' }} />

      {/* Father */}
      <F.PSection icon="user-round" title="Father / Guardian 1">
        <div style={grid2}>
          <F.PField label="Name" required><F.PInput value={c.father.name} onChange={v => setN('father', 'name', v)} placeholder="Full name" /></F.PField>
          <F.PField label="Phone" required><F.PInput value={c.father.phone} onChange={v => setN('father', 'phone', v)} placeholder="+20 …" icon="phone" /></F.PField>
          <F.PField label="Occupation"><F.PInput value={c.father.job} onChange={v => setN('father', 'job', v)} placeholder="Job title" /></F.PField>
          <F.PField label="National ID"><F.PInput value={c.father.nid} onChange={v => setN('father', 'nid', v)} placeholder="14 digits" /></F.PField>
        </div>
      </F.PSection>

      {/* Mother */}
      <F.PSection icon="user-round" title="Mother / Guardian 2">
        <div style={grid2}>
          <F.PField label="Name"><F.PInput value={c.mother.name} onChange={v => setN('mother', 'name', v)} placeholder="Full name" /></F.PField>
          <F.PField label="Phone"><F.PInput value={c.mother.phone} onChange={v => setN('mother', 'phone', v)} placeholder="+20 …" icon="phone" /></F.PField>
          <F.PField label="Occupation"><F.PInput value={c.mother.job} onChange={v => setN('mother', 'job', v)} placeholder="Job title" /></F.PField>
          <F.PField label="National ID"><F.PInput value={c.mother.nid} onChange={v => setN('mother', 'nid', v)} placeholder="14 digits" /></F.PField>
        </div>
      </F.PSection>

      {/* Emergency */}
      <F.PSection icon="phone-call" title="Emergency contact">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
          <F.PField label="Name"><F.PInput value={c.emergency.name} onChange={v => setN('emergency', 'name', v)} placeholder="Full name" /></F.PField>
          <F.PField label="Phone"><F.PInput value={c.emergency.phone} onChange={v => setN('emergency', 'phone', v)} placeholder="+20 …" /></F.PField>
          <F.PField label="Relation"><F.PInput value={c.emergency.relation} onChange={v => setN('emergency', 'relation', v)} placeholder="e.g. Uncle" /></F.PField>
        </div>
      </F.PSection>

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '20px 0' }} />

      {/* Address + map */}
      <F.PSection icon="map-pin" title="Home address">
        <div style={grid2}>
          <F.PField label="Street"><F.PInput value={c.address.street} onChange={v => setN('address', 'street', v)} placeholder="Street name & no." /></F.PField>
          <F.PField label="Building / Apt"><F.PInput value={c.address.building} onChange={v => setN('address', 'building', v)} placeholder="Bldg, floor, apt" /></F.PField>
          <F.PField label="Area / District"><F.PInput value={c.address.area} onChange={v => setN('address', 'area', v)} placeholder="e.g. Dokki" /></F.PField>
          <F.PField label="City"><F.PInput value={c.address.city} onChange={v => setN('address', 'city', v)} placeholder="City" /></F.PField>
        </div>
        <F.PField label="Pin exact location" hint="Used for bus routing & pickup">
          <F.MapPicker value={c.address} onChange={loc => setC(p => ({ ...p, address: { ...p.address, ...loc } }))} />
        </F.PField>
      </F.PSection>
    </F.PModal>
  );
}

/* ---------------- Profile drawer ---------------- */
function InfoRow({ icon, label, value, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <Icon name={icon} size={16} color="var(--text-subtle)" style={{ flex: 'none' }} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 'none', minWidth: 110 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', textAlign: 'end', marginInlineStart: 'auto' }}>{value || '—'}</span>
    </div>
  );
}
function PCard({ icon, title, children, action }) {
  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: '16px 18px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        <Icon name={icon} size={17} color={DC_MGR} />
        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)' }}>{title}</span>
        {action && <span style={{ marginInlineStart: 'auto' }}>{action}</span>}
      </div>
      {children}
    </div>
  );
}

function ChildProfile({ child, onClose, onEdit, onRemind, onSuspend, onDelete }) {
  const F = window.DForms;
  const a = child.address || {};
  const b = child.billing || {};
  const suspended = b.status === 'suspended';
  return (
    <F.ProfileDrawer onClose={onClose}>
      {/* header */}
      <div style={{ background: 'linear-gradient(150deg, #0F3D38, #0B2E2A)', padding: '40px 26px 24px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 22, insetInlineEnd: 22, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(245,243,238,.14)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="x" size={19} color="#F5F3EE" /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={child.name} src={child.photo} size={72} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F3EE' }}>{child.name}</div>
            <div style={{ fontSize: 13.5, color: 'rgba(245,243,238,.75)', marginTop: 3 }}>{child.cls} · {child.pkg}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <Badge tone={suspended ? 'danger' : 'success'} solid>{suspended ? 'Suspended' : statusLabel(child.status)}</Badge>
              <Badge tone={b.balance > 0 ? 'amber' : 'teal'} solid>{b.balance > 0 ? `${b.balance} EGP due` : 'Paid up'}</Badge>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Button variant="amber" size="sm" iconLeft={<Icon name="user-pen" size={15} />} onClick={onEdit}>Edit details</Button>
          <button onClick={onRemind} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,243,238,.25)', background: 'rgba(245,243,238,.1)', color: '#F5F3EE', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}><Icon name="bell-ring" size={15} />Payment reminder</button>
        </div>
      </div>

      <div style={{ padding: 22 }}>
        {/* quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: child.att >= 85 ? 'var(--success-600)' : 'var(--amber-600)' }}>{child.att}%</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Attendance</div>
          </div>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-strong)' }}>{child.blood || '—'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Blood type</div>
          </div>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-strong)' }}>{b.cycle === 'Yearly' ? 'Yr' : 'Mo'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>Billing</div>
          </div>
        </div>

        <PCard icon="baby" title="Child details">
          <InfoRow icon="cake" label="Date of birth" value={child.dob} />
          <InfoRow icon="venus-mars" label="Gender" value={child.gender} />
          <InfoRow icon="triangle-alert" label="Allergies" value={child.allergies} />
          <InfoRow icon="sticky-note" label="Notes" value={child.notes} />
        </PCard>

        <PCard icon="users" title="Guardians">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '4px 0 2px' }}>Father</div>
          <InfoRow icon="user-round" label="Name" value={child.father.name} />
          <InfoRow icon="phone" label="Phone" value={child.father.phone} mono />
          <InfoRow icon="briefcase" label="Occupation" value={child.father.job} />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '12px 0 2px' }}>Mother</div>
          <InfoRow icon="user-round" label="Name" value={child.mother.name} />
          <InfoRow icon="phone" label="Phone" value={child.mother.phone} mono />
          <InfoRow icon="briefcase" label="Occupation" value={child.mother.job} />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '12px 0 2px' }}>Emergency</div>
          <InfoRow icon="phone-call" label={child.emergency.relation} value={`${child.emergency.name} · ${child.emergency.phone}`} />
        </PCard>

        <PCard icon="map-pin" title="Home address">
          <InfoRow icon="signpost" label="Street" value={a.street} />
          <InfoRow icon="building" label="Building" value={a.building} />
          <InfoRow icon="map" label="Area" value={`${a.area || ''}${a.city ? ', ' + a.city : ''}`} />
          {a.x != null && (
            <div style={{ marginTop: 12, position: 'relative', height: 130, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
              <svg width="100%" height="100%" viewBox="0 0 600 130" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
                <rect width="600" height="130" fill="#E9EEE8" /><rect x="30" y="14" width="150" height="44" rx="8" fill="#D7E5D4" /><rect x="380" y="74" width="180" height="46" rx="8" fill="#D7E5D4" />
                <g stroke="#fff" strokeWidth="12" strokeLinecap="round"><line x1="-5" y1="66" x2="605" y2="66" /><line x1="200" y1="-5" x2="200" y2="135" /><line x1="420" y1="-5" x2="420" y2="135" /></g>
              </svg>
              <span style={{ position: 'absolute', left: `${a.x * 100}%`, top: `${a.y * 100}%`, transform: 'translate(-50%,-100%)' }}><Icon name="map-pin" size={28} color="var(--danger-500)" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.3))' }} /></span>
              <span style={{ position: 'absolute', bottom: 8, insetInlineStart: 10, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-body)', background: 'rgba(255,255,255,.85)', padding: '2px 7px', borderRadius: 'var(--radius-pill)' }}>{a.lat}, {a.lng}</span>
            </div>
          )}
        </PCard>

        <PCard icon="credit-card" title="Billing" action={<Badge tone={b.balance > 0 ? 'amber' : 'success'} dot>{b.status === 'overdue' ? 'Overdue' : b.status === 'suspended' ? 'Suspended' : 'Active'}</Badge>}>
          <InfoRow icon="receipt" label="Fee" value={`${b.fee} EGP · ${b.cycle}`} />
          <InfoRow icon="circle-check-big" label="Paid" value={`${b.paid} EGP`} />
          <InfoRow icon="circle-alert" label="Balance" value={`${b.balance} EGP`} />
          <InfoRow icon="calendar" label="Next due" value={b.nextDue} />
        </PCard>

        {/* danger zone */}
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <Button variant="secondary" fullWidth iconLeft={<Icon name={suspended ? 'play' : 'pause'} size={15} />} onClick={onSuspend}>{suspended ? 'Reactivate' : 'Suspend'}</Button>
          <button onClick={onDelete} style={{ flex: 1, height: 44, borderRadius: 'var(--radius-md)', border: '1px solid var(--danger-200)', background: 'var(--danger-50)', color: 'var(--danger-600)', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><Icon name="trash-2" size={15} />Remove</button>
        </div>
      </div>
    </F.ProfileDrawer>
  );
}

/* ---------------- Children view ---------------- */
function ChildrenView() {
  const F = window.DForms;
  const [list, setList] = useStateC(SEED_CHILDREN);
  const [q, setQ] = useStateC('');
  const [filterCls, setFilterCls] = useStateC('all');
  const [filterPkg, setFilterPkg] = useStateC('all');
  const [filterPay, setFilterPay] = useStateC('all');
  const [showFilter, setShowFilter] = useStateC(false);
  const [form, setForm] = useStateC(null);       // {mode:'add'} | {mode:'edit', child}
  const [profile, setProfile] = useStateC(null);
  const [confirm, setConfirm] = useStateC(null);
  const [toast, setToast] = useStateC(null);
  const [account, setAccount] = useStateC(null);

  const rows = list.filter(c => {
    if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filterCls !== 'all' && c.cls !== filterCls) return false;
    if (filterPkg !== 'all' && c.pkg !== filterPkg) return false;
    if (filterPay !== 'all') {
      const due = (c.billing.balance || 0) > 0;
      if (filterPay === 'due' && !due) return false;
      if (filterPay === 'paid' && due) return false;
    }
    return true;
  });
  const activeFilters = (filterCls !== 'all' ? 1 : 0) + (filterPkg !== 'all' ? 1 : 0) + (filterPay !== 'all' ? 1 : 0);

  const saveChild = (c) => {
    if (form.mode === 'edit') { setList(prev => prev.map(x => x.id === c.id ? c : x)); setToast({ msg: 'Child details updated', icon: 'check' }); if (profile) setProfile(c); }
    else {
      const nc = { ...c, id: 'c' + Date.now(), att: 100, status: 'at-home', billing: { ...c.billing, paid: 0, balance: 0, status: 'active', nextDue: 'Jul 1' } };
      setList(prev => [nc, ...prev]);
      // auto-create a parent account for the Parent App
      const login = (c.father && c.father.phone && c.father.phone.trim()) || (c.mother && c.mother.phone && c.mother.phone.trim()) || c.name;
      setAccount(window.DForms.makeAccount({ app: 'parent', login, name: (c.father && c.father.name) || `${c.name}'s parent` }));
    }
    setForm(null);
  };
  const doRemind = (c) => { setToast({ msg: `Payment reminder sent to ${c.father.name}`, icon: 'bell-ring', tone: 'amber' }); };
  const doSuspend = (c) => {
    const sus = c.billing.status === 'suspended';
    setList(prev => prev.map(x => x.id === c.id ? { ...x, billing: { ...x.billing, status: sus ? 'active' : 'suspended' } } : x));
    const nc = { ...c, billing: { ...c.billing, status: sus ? 'active' : 'suspended' } };
    if (profile) setProfile(nc);
    setToast({ msg: sus ? `${c.name} reactivated` : `${c.name}'s membership suspended`, icon: sus ? 'play' : 'pause', tone: sus ? 'success' : 'amber' });
  };
  const doDelete = (c) => { setList(prev => prev.filter(x => x.id !== c.id)); setProfile(null); setToast({ msg: `${c.name} removed`, icon: 'trash-2', tone: 'amber' }); };

  const menuFor = (c) => [
    { icon: 'id-card', label: 'Open profile', onClick: () => setProfile(c) },
    { icon: 'user-pen', label: 'Edit details', onClick: () => setForm({ mode: 'edit', child: c }) },
    { icon: 'bell-ring', label: 'Send payment reminder', color: 'var(--amber-600)', onClick: () => doRemind(c) },
    { divider: true },
    { icon: c.billing.status === 'suspended' ? 'play' : 'pause', label: c.billing.status === 'suspended' ? 'Reactivate membership' : 'Suspend membership', onClick: () => setConfirm({ kind: 'suspend', child: c }) },
    { icon: 'trash-2', label: 'Remove child', danger: true, onClick: () => setConfirm({ kind: 'delete', child: c }) },
  ];

  return (
    <div style={{ padding: 32 }}>
      <Card padding="none" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', width: 260 }}>
            <Icon name="search" size={16} color="var(--text-subtle)" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by name…" style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: 13.5, width: '100%', color: 'var(--text-strong)' }} />
          </div>
          <Badge tone="neutral">{rows.length} children</Badge>
          <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 10, position: 'relative' }}>
            <Button variant={activeFilters ? 'primary' : 'secondary'} size="sm" iconLeft={<Icon name="filter" size={15} />} onClick={() => setShowFilter(s => !s)}>Filter{activeFilters ? ` · ${activeFilters}` : ''}</Button>
            <Button variant="primary" size="sm" iconLeft={<Icon name="plus" size={16} />} onClick={() => setForm({ mode: 'add' })}>Add child</Button>
            {showFilter && (
              <div style={{ position: 'absolute', top: 44, insetInlineEnd: 0, width: 250, background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xl)', padding: 16, zIndex: 40 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-body)', marginBottom: 7 }}>Classroom</div>
                <F.PSelect value={filterCls} onChange={setFilterCls} options={[{ v: 'all', label: 'All classrooms' }, ...CLS_OPTS.map(c => ({ v: c, label: c }))]} />
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-body)', margin: '14px 0 7px' }}>Package</div>
                <F.PSeg value={filterPkg} onChange={setFilterPkg} options={[{ v: 'all', label: 'All' }, { v: 'Full Day', label: 'Full' }, { v: 'Half Day', label: 'Half' }]} />
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-body)', margin: '14px 0 7px' }}>Payment</div>
                <F.PSeg value={filterPay} onChange={setFilterPay} options={[{ v: 'all', label: 'All' }, { v: 'paid', label: 'Paid' }, { v: 'due', label: 'Due' }]} />
                <button onClick={() => { setFilterCls('all'); setFilterPkg('all'); setFilterPay('all'); }} style={{ marginTop: 14, width: '100%', height: 36, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', color: 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Clear filters</button>
              </div>
            )}
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
          <thead><tr style={{ background: 'var(--bg-app)' }}>{['Child', 'Classroom', 'Parent', 'Status', 'Attendance', 'Billing', ''].map((h, i) => <th key={i} style={{ textAlign: 'start', padding: '11px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map(c => {
              const due = (c.billing.balance || 0) > 0; const sus = c.billing.status === 'suspended';
              return (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border-subtle)', opacity: sus ? 0.6 : 1 }}>
                  <td style={{ padding: '12px 20px' }}><div onClick={() => setProfile(c)} style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }}><Avatar name={c.name} src={c.photo} size={36} /><span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>{c.name}</span></div></td>
                  <td style={{ padding: '12px 20px', fontSize: 13.5, color: 'var(--text-body)' }}>{c.cls}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13.5, color: 'var(--text-body)' }}>{c.father.name}</td>
                  <td style={{ padding: '12px 20px' }}>{sus ? <Badge tone="danger" dot>Suspended</Badge> : <StatusPill status={c.status} size="sm" />}</td>
                  <td style={{ padding: '12px 20px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><div style={{ width: 60, height: 7, borderRadius: 'var(--radius-pill)', background: 'var(--bg-sunken)', overflow: 'hidden' }}><div style={{ width: `${c.att}%`, height: '100%', background: c.att >= 85 ? 'var(--success-500)' : c.att >= 78 ? 'var(--amber-500)' : 'var(--danger-500)' }} /></div><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)', fontVariantNumeric: 'tabular-nums' }}>{c.att}%</span></div></td>
                  <td style={{ padding: '12px 20px' }}>{due ? <Badge tone="amber" dot>{c.billing.balance} EGP</Badge> : <Badge tone="success" dot>Paid</Badge>}</td>
                  <td style={{ padding: '8px 14px', textAlign: 'end' }}><F.Menu items={menuFor(c)} /></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No children match your filters.</td></tr>}
          </tbody>
        </table>
      </Card>

      {form && <ChildForm initial={form.mode === 'edit' ? form.child : null} onClose={() => setForm(null)} onSave={saveChild} />}
      {profile && <ChildProfile child={profile} onClose={() => setProfile(null)} onEdit={() => setForm({ mode: 'edit', child: profile })} onRemind={() => doRemind(profile)} onSuspend={() => doSuspend(profile)} onDelete={() => setConfirm({ kind: 'delete', child: profile })} />}
      {confirm && confirm.kind === 'delete' && <F.ConfirmDialog icon="trash-2" tone="danger" title={`Remove ${confirm.child.name}?`} message="This unenrolls the child and removes their records from the nursery. This cannot be undone." confirmLabel="Remove child" onConfirm={() => doDelete(confirm.child)} onClose={() => setConfirm(null)} />}
      {confirm && confirm.kind === 'suspend' && <F.ConfirmDialog icon={confirm.child.billing.status === 'suspended' ? 'play' : 'pause'} tone="amber" title={confirm.child.billing.status === 'suspended' ? `Reactivate ${confirm.child.name}?` : `Suspend ${confirm.child.name}?`} message={confirm.child.billing.status === 'suspended' ? 'The child regains access and appears as active again.' : 'The membership is paused. Parents keep app access but the child is marked inactive until reactivated.'} confirmLabel={confirm.child.billing.status === 'suspended' ? 'Reactivate' : 'Suspend'} onConfirm={() => doSuspend(confirm.child)} onClose={() => setConfirm(null)} />}
      {toast && <F.Toast message={toast.msg} icon={toast.icon} tone={toast.tone} onDone={() => setToast(null)} />}
      {account && <F.AccountCreatedDialog account={account} onClose={() => { const n = account.name; setAccount(null); setToast({ msg: 'Child added · parent account ready', icon: 'user-plus' }); }} onToast={(m) => setToast({ msg: m, icon: 'send' })} />}
    </div>
  );
}

window.ChildrenView = ChildrenView;
/* expose children so the Bus form can assign them by address */
window.MASAR_CHILDREN = SEED_CHILDREN;
window.MASAR_childrenForBus = function () {
  return SEED_CHILDREN.map(c => ({
    id: c.id, name: c.name,
    area: (c.address && c.address.area) || '—',
    addr: c.address ? `${c.address.street || ''}${c.address.building ? ', ' + c.address.building : ''}`.trim() : '—',
    cls: c.cls,
  }));
};
