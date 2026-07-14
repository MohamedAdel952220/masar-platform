const { useState: useStatePay } = React;

/* ====================================================================
   Masar — Dashboard · Payments
   Fee items (configurable price list) · per-student billing by class+parent
   · installment plans (custom per student) · paid/unpaid reports · invoices
   ==================================================================== */
const PAY_MGR = 'var(--role-manager)';

/* ---- Students (name, class, parent) sourced from Children where possible ---- */
function payStudents() {
  const kids = window.MASAR_CHILDREN || [];
  if (kids.length) return kids.map(c => ({ id: c.id, name: c.name, cls: c.cls, parent: (c.father && c.father.name) || '—', phone: (c.father && c.father.phone) || '' }));
  return [
    { id: 'c1', name: 'Yousef Adel', cls: 'KG2 · Sunflower', parent: 'Mohamed Adel', phone: '+20 100 123 4567' },
    { id: 'c3', name: 'Omar Khaled', cls: 'KG2 · Sunflower', parent: 'Khaled Sami', phone: '+20 102 333 1122' },
  ];
}

/* ---- Fee items (the configurable price list) ---- */
const SEED_FEES = [
  { id: 'f1', name: 'Monthly Tuition', nameAr: 'الرسوم الشهرية', icon: 'calendar', tone: 'teal', price: 2400, cycle: 'Monthly', scope: 'all', required: true },
  { id: 'f2', name: 'Books & Materials', nameAr: 'الكتب والأدوات', icon: 'book-open', tone: 'violet', price: 1200, cycle: 'Once / year', scope: 'all', required: true },
  { id: 'f3', name: 'Bus Service', nameAr: 'خدمة الباص', icon: 'bus', tone: 'info', price: 600, cycle: 'Monthly', scope: 'optional', required: false, students: ['c1', 'c3', 'c5'] },
  { id: 'f4', name: 'Meals Plan', nameAr: 'وجبات', icon: 'utensils', tone: 'amber', price: 800, cycle: 'Monthly', scope: 'optional', required: false, students: ['c1', 'c2', 'c6'] },
  { id: 'f5', name: 'Activities & Trips', nameAr: 'أنشطة ورحلات', icon: 'palette', tone: 'teal', price: 400, cycle: 'Per term', scope: 'optional', required: false, students: ['c2', 'c4', 'c6'] },
];
function feeTone(t) { return ({ teal: 'var(--teal-600)', violet: 'var(--role-teacher)', info: 'var(--info-500)', amber: 'var(--amber-600)' })[t] || 'var(--teal-600)'; }

/* ---- Per-student ledger: which items they owe + installment plan + payments ---- */
/* installments: array of {label, amount, paid, date|null, due} */
function buildLedger() {
  const studs = payStudents();
  const led = {};
  studs.forEach((s, i) => {
    // everyone owes tuition + books; some have bus/meals
    const items = {};
    // required-for-all fees
    SEED_FEES.filter(f => f.scope === 'all').forEach(f => {
      const r = (i + f.id.charCodeAt(1)) % 3;
      items[f.id] = { paid: r === 0 ? f.price : r === 1 ? Math.round(f.price / 2) : 0, total: f.price };
    });
    // optional fees only for the children assigned to them
    SEED_FEES.filter(f => f.scope === 'optional').forEach(f => {
      if ((f.students || []).includes(s.id)) {
        const r = (i + f.id.charCodeAt(1)) % 2;
        items[f.id] = { paid: r === 0 ? f.price : 0, total: f.price };
      }
    });
    // a couple of families have a custom yearly installment plan on tuition
    let plan = null;
    if (i === 0) plan = { feeId: 'f1', label: 'Yearly · 8 installments', n: 8, schedule: [
      { label: 'Aug', amount: 3000, paid: true, date: 'Aug 3' }, { label: 'Sep', amount: 3000, paid: true, date: 'Sep 1' },
      { label: 'Oct', amount: 3000, paid: true, date: 'Oct 2' }, { label: 'Nov', amount: 3000, paid: true, date: 'Nov 1' },
      { label: 'Dec', amount: 3000, paid: true, date: 'Dec 3' }, { label: 'Jan', amount: 3000, paid: false, date: null, overdue: true },
      { label: 'Feb', amount: 3000, paid: false, date: null }, { label: 'Mar', amount: 3000, paid: false, date: null },
    ] };
    if (i === 2) plan = { feeId: 'f1', label: 'Yearly · 10 installments', n: 10, schedule: [
      { label: 'Sep', amount: 2400, paid: true, date: 'Sep 2' }, { label: 'Oct', amount: 2400, paid: true, date: 'Oct 1' },
      { label: 'Nov', amount: 2400, paid: false, date: null, overdue: true }, { label: 'Dec', amount: 2400, paid: false, date: null },
      { label: 'Jan', amount: 2400, paid: false, date: null },
    ] };
    led[s.id] = { items, plan };
  });
  return led;
}

/* ---------------- Class-grouped student picker (for optional fees) ---------------- */
function FeeStudentPicker({ selected, onChange }) {
  const studs = payStudents();
  const byClass = {};
  studs.forEach(s => { (byClass[s.cls] = byClass[s.cls] || []).push(s); });
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const toggleClass = (kids) => {
    const ids = kids.map(k => k.id);
    const allOn = ids.every(id => selected.includes(id));
    onChange(allOn ? selected.filter(x => !ids.includes(x)) : Array.from(new Set([...selected, ...ids])));
  };
  return (
    <div>
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
        {Object.entries(byClass).map(([cls, kids], gi) => {
          const ids = kids.map(k => k.id); const allOn = ids.every(id => selected.includes(id)); const someOn = ids.some(id => selected.includes(id));
          return (
            <div key={gi}>
              <button onClick={() => toggleClass(kids)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', border: 'none', borderTop: gi ? '1px solid var(--border-subtle)' : 'none', background: 'var(--bg-app)', cursor: 'pointer', textAlign: 'start' }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${allOn ? PAY_MGR : 'var(--border-strong)'}`, background: allOn ? PAY_MGR : someOn ? 'color-mix(in srgb, var(--role-manager) 32%, transparent)' : 'transparent', display: 'grid', placeItems: 'center', flex: 'none' }}>{allOn && <Icon name="check" size={12} color="#fff" />}{!allOn && someOn && <span style={{ width: 8, height: 2, background: '#fff', borderRadius: 1 }} />}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{cls}</span>
                <span style={{ marginInlineStart: 'auto', fontSize: 11.5, color: 'var(--text-subtle)', fontWeight: 700 }}>{ids.filter(id => selected.includes(id)).length}/{kids.length}</span>
              </button>
              {kids.map(k => { const on = selected.includes(k.id); return (
                <button key={k.id} onClick={() => toggle(k.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '8px 14px 8px 28px', border: 'none', borderTop: '1px solid var(--border-subtle)', background: on ? 'color-mix(in srgb, var(--role-manager) 6%, transparent)' : 'transparent', cursor: 'pointer', textAlign: 'start' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? PAY_MGR : 'var(--border-strong)'}`, background: on ? PAY_MGR : 'transparent', display: 'grid', placeItems: 'center', flex: 'none' }}>{on && <Icon name="check" size={12} color="#fff" />}</span>
                  <Avatar name={k.name} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>{k.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{k.parent}</div></div>
                </button>
              ); })}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 7 }}>{selected.length} child{selected.length === 1 ? '' : 'ren'} selected · tap a class header to select the whole class.</div>
    </div>
  );
}

/* ---------------- Fee item add/edit form ---------------- */
function FeeForm({ initial, onClose, onSave }) {
  const F = window.DForms;
  const [f, setF] = useStatePay(initial || { name: '', nameAr: '', icon: 'tag', tone: 'teal', price: 0, cycle: 'Monthly', scope: 'all', required: false, students: [] });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const valid = f.name.trim() && f.price >= 0;
  const ICONS = ['calendar', 'book-open', 'bus', 'utensils', 'palette', 'shirt', 'graduation-cap', 'tag', 'heart-pulse', 'music'];
  return (
    <F.PModal icon={initial ? 'pen' : 'plus'} title={initial ? 'Edit fee item' : 'Add fee item'} subtitle={initial ? initial.name : 'A new payable item for parents'} width={540} onClose={onClose}
      footer={<React.Fragment>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" fullWidth disabled={!valid} iconLeft={<Icon name="check" size={16} />} onClick={() => onSave(f)}>{initial ? 'Save item' : 'Add item'}</Button>
      </React.Fragment>}>
      <F.PSection icon="tag" title="Item details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          <F.PField label="Name (English)" required><F.PInput value={f.name} onChange={v => set('name', v)} placeholder="e.g. Uniform" /></F.PField>
          <F.PField label="Name (Arabic)"><F.PInput value={f.nameAr} onChange={v => set('nameAr', v)} placeholder="الزي المدرسي" /></F.PField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          <F.PField label="Price (EGP)" required><F.PInput type="number" value={f.price} onChange={v => set('price', parseInt(v) || 0)} placeholder="0" /></F.PField>
          <F.PField label="Billing cycle"><F.PSelect value={f.cycle} onChange={v => set('cycle', v)} options={['Monthly', 'Per term', 'Once / year', 'One-time']} /></F.PField>
        </div>
        <div style={{ marginBottom: 18 }}>
          <F.PField label="Applies to"><F.PSeg value={f.scope} onChange={v => set('scope', v)} options={[{ v: 'all', label: 'All children (required)' }, { v: 'optional', label: 'Optional / opt-in' }]} /></F.PField>
        </div>
        {f.scope === 'optional' && (
          <div style={{ marginBottom: 18 }}>
            <F.PField label="Choose who it applies to" hint="Grouped by class — only the families you pick are billed and see this item">
              <FeeStudentPicker selected={f.students || []} onChange={ids => set('students', ids)} />
            </F.PField>
          </div>
        )}
        <F.PField label="Icon">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ICONS.map(ic => { const on = f.icon === ic; return <button key={ic} onClick={() => set('icon', ic)} style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? PAY_MGR : 'var(--border-subtle)'}`, background: on ? 'var(--teal-50)' : 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name={ic} size={19} color={on ? PAY_MGR : 'var(--text-muted)'} /></button>; })}
          </div>
        </F.PField>
      </F.PSection>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--radius-md)', background: 'var(--teal-50)', border: '1px solid var(--teal-100)', marginTop: 4 }}>
        <Icon name="bell-ring" size={17} color="var(--teal-700)" />
        <span style={{ fontSize: 12.5, color: 'var(--teal-800)', lineHeight: 1.5 }}>When you change a price, you can notify all parents that it takes effect next month.</span>
      </div>
    </F.PModal>
  );
}

/* ---------------- Price-change notify dialog ---------------- */
function PriceNotify({ item, oldPrice, onClose, onConfirm }) {
  const F = window.DForms;
  const up = item.price > oldPrice;
  return (
    <F.PModal icon="bell-ring" title="Notify parents of price change?" subtitle={item.name} width={480} onClose={onClose}
      footer={<React.Fragment>
        <Button variant="secondary" onClick={onClose}>Not now</Button>
        <Button variant="primary" fullWidth iconLeft={<Icon name="send" size={16} />} onClick={onConfirm}>Notify all parents</Button>
      </React.Fragment>}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '14px 0 18px' }}>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: 'var(--text-subtle)', fontWeight: 700 }}>Was</div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-muted)', textDecoration: 'line-through' }}>{oldPrice.toLocaleString()}</div></div>
        <Icon name="arrow-right" size={22} color={up ? 'var(--amber-600)' : 'var(--success-500)'} />
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: 'var(--text-subtle)', fontWeight: 700 }}>Now</div><div style={{ fontSize: 26, fontWeight: 800, color: up ? 'var(--amber-700)' : 'var(--success-700)' }}>{item.price.toLocaleString()}<span style={{ fontSize: 13 }}> EGP</span></div></div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.6, padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)' }}>
        <Icon name="message-square" size={15} color={PAY_MGR} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />
        “Dear parent, please note that <b>{item.name}</b> will be <b>{item.price.toLocaleString()} EGP</b> ({item.cycle}) starting next month.”
      </div>
    </F.PModal>
  );
}

/* ---------------- Installment plan editor ---------------- */
function PlanForm({ student, fees, ledger, onClose, onSave }) {
  const F = window.DForms;
  const cur = ledger[student.id] && ledger[student.id].plan;
  const [feeId, setFeeId] = useStatePay(cur ? cur.feeId : 'f1');
  const [n, setN] = useStatePay(cur ? cur.n : 8);
  const [total, setTotal] = useStatePay(cur ? cur.schedule.reduce((s, x) => s + x.amount, 0) : 19200);
  const fee = fees.find(f => f.id === feeId);
  const per = Math.round(total / Math.max(1, n));
  const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
  const build = () => {
    const sched = []; for (let i = 0; i < n; i++) sched.push({ label: months[i % 12], amount: per, paid: cur && cur.schedule[i] ? cur.schedule[i].paid : false, date: cur && cur.schedule[i] ? cur.schedule[i].date : null });
    return { feeId, label: `Custom · ${n} installments`, n, schedule: sched };
  };
  return (
    <F.PModal icon="wallet" title="Custom installment plan" subtitle={`${student.name} · ${student.cls}`} width={520} onClose={onClose} accent="var(--amber-600)"
      footer={<React.Fragment>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" fullWidth iconLeft={<Icon name="check" size={16} />} onClick={() => onSave(build())}>Save plan</Button>
      </React.Fragment>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--radius-md)', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', marginBottom: 18 }}>
        <Icon name="user-round" size={17} color="var(--amber-700)" />
        <span style={{ fontSize: 12.5, color: 'var(--amber-700)', lineHeight: 1.5 }}>This installment plan applies to <b>{student.name}</b> only — other families keep their normal schedule.</span>
      </div>
      <div style={{ marginBottom: 18 }}><F.PField label="On which fee"><F.PSelect value={feeId} onChange={setFeeId} options={fees.filter(f => f.cycle !== 'Monthly').concat(fees.filter(f => f.cycle === 'Monthly')).map(f => ({ v: f.id, label: f.name }))} /></F.PField></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <F.PField label="Total amount (EGP)"><F.PInput type="number" value={total} onChange={v => setTotal(parseInt(v) || 0)} /></F.PField>
        <F.PField label="Number of installments"><F.PInput type="number" value={n} onChange={v => setN(Math.max(1, Math.min(12, parseInt(v) || 1)))} /></F.PField>
      </div>
      <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Each installment</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: PAY_MGR }}>{per.toLocaleString()} <span style={{ fontSize: 12 }}>EGP × {n}</span></span>
      </div>
    </F.PModal>
  );
}

/* ---------------- Student invoice drawer ---------------- */
function InvoiceDrawer({ student, fees, ledger, onClose, onToast, markInstallment }) {
  const F = window.DForms;
  const L = ledger[student.id] || { items: {}, plan: null };
  const owed = []; let totalDue = 0, totalPaid = 0;
  fees.forEach(f => { const it = L.items[f.id]; if (it) { owed.push({ fee: f, ...it }); totalDue += it.total; totalPaid += it.paid; } });
  const balance = totalDue - totalPaid;
  const plan = L.plan;
  const planFee = plan && fees.find(f => f.id === plan.feeId);
  const paidInst = plan ? plan.schedule.filter(s => s.paid).length : 0;
  const nextUnpaid = plan ? plan.schedule.find(s => !s.paid) : null;

  return (
    <F.ProfileDrawer onClose={onClose}>
      <div style={{ background: 'linear-gradient(150deg, #0F3D38, #0B2E2A)', padding: '40px 26px 24px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 22, insetInlineEnd: 22, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(245,243,238,.14)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="x" size={19} color="#F5F3EE" /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={student.name} size={64} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F3EE' }}>{student.name}</div>
            <div style={{ fontSize: 13.5, color: 'rgba(245,243,238,.75)', marginTop: 3 }}>{student.cls} · {student.parent}</div>
            <div style={{ marginTop: 8 }}><Badge tone={balance > 0 ? 'amber' : 'success'} solid>{balance > 0 ? `${balance.toLocaleString()} EGP outstanding` : 'Fully paid'}</Badge></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Button variant="amber" size="sm" iconLeft={<Icon name="send" size={15} />} onClick={() => onToast({ msg: `Invoice sent to ${student.parent}`, icon: 'send' })}>Send invoice</Button>
          <button onClick={() => onToast({ msg: 'Invoice PDF downloaded', icon: 'download' })} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,243,238,.25)', background: 'rgba(245,243,238,.1)', color: '#F5F3EE', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}><Icon name="download" size={15} />Download</button>
          {balance > 0 && <button onClick={() => onToast({ msg: `Reminder sent to ${student.parent}`, icon: 'bell-ring', tone: 'amber' })} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,159,39,.5)', background: 'rgba(239,159,39,.18)', color: '#F5F3EE', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}><Icon name="bell-ring" size={15} />Remind</button>}
        </div>
      </div>

      <div style={{ padding: 22 }}>
        {/* line items */}
        <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)' }}>Invoice — June 2026</div>
          {owed.map((o, i) => { const c = feeTone(o.fee.tone); const done = o.paid >= o.total; const part = o.paid > 0 && !done; return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={o.fee.icon} size={17} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{o.fee.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.fee.cycle} · {o.total.toLocaleString()} EGP</div>
              </div>
              {done ? <Badge tone="success" dot>Paid</Badge> : part ? <Badge tone="amber" dot>{o.paid.toLocaleString()}/{o.total.toLocaleString()}</Badge> : <Badge tone="danger" dot>Unpaid</Badge>}
            </div>
          ); })}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-app)' }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-body)' }}>Balance due</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: balance > 0 ? 'var(--amber-700)' : 'var(--success-700)' }}>{balance.toLocaleString()} <span style={{ fontSize: 12 }}>EGP</span></span>
          </div>
        </div>

        {/* installment plan */}
        {plan && (
          <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 9 }}>
              <Icon name="wallet" size={17} color="var(--amber-600)" />
              <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)' }}>{planFee ? planFee.name : 'Plan'} · {plan.label}</span>
              <Badge tone="amber" style={{ marginInlineStart: 'auto' }}>{paidInst}/{plan.n} paid</Badge>
            </div>
            {/* progress */}
            <div style={{ padding: '14px 16px 6px' }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {plan.schedule.map((s, i) => <div key={i} style={{ flex: 1, height: 8, borderRadius: 'var(--radius-pill)', background: s.paid ? 'var(--success-500)' : s.overdue ? 'var(--danger-500)' : 'var(--neutral-200)' }} />)}
              </div>
            </div>
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {plan.schedule.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: s.paid ? 'var(--success-50)' : s.overdue ? 'var(--danger-50)' : 'var(--bg-sunken)', color: s.paid ? 'var(--success-500)' : s.overdue ? 'var(--danger-500)' : 'var(--text-subtle)', display: 'grid', placeItems: 'center', flex: 'none', fontSize: 12, fontWeight: 800 }}>{s.paid ? <Icon name="check" size={14} /> : i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>Installment {i + 1} · {s.label}</div>
                    <div style={{ fontSize: 11.5, color: s.overdue ? 'var(--danger-500)' : 'var(--text-muted)' }}>{s.paid ? `Paid ${s.date}` : s.overdue ? 'Overdue' : 'Upcoming'}</div>
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>{s.amount.toLocaleString()}</span>
                  {!s.paid && <button onClick={() => markInstallment(student.id, i)} style={{ height: 30, padding: '0 11px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Mark paid</button>}
                </div>
              ))}
            </div>
            {nextUnpaid && (
              <div style={{ padding: '12px 16px', background: 'var(--amber-50)', borderTop: '1px solid var(--amber-200)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="clock" size={16} color="var(--amber-700)" />
                <span style={{ fontSize: 12.5, color: 'var(--amber-700)' }}>Next due: <b>{nextUnpaid.label}</b> · {nextUnpaid.amount.toLocaleString()} EGP · {plan.n - paidInst} installments remaining</span>
              </div>
            )}
          </div>
        )}
      </div>
    </F.ProfileDrawer>
  );
}

/* ====================================================================
   MAIN VIEW
   ==================================================================== */
function PaymentsView() {
  const F = window.DForms;
  const [tab, setTab] = useStatePay('overview'); // overview | items | report
  const [fees, setFees] = useStatePay(SEED_FEES);
  const [ledger, setLedger] = useStatePay(buildLedger);
  const [feeForm, setFeeForm] = useStatePay(null);
  const [notify, setNotify] = useStatePay(null);
  const [planFor, setPlanFor] = useStatePay(null);
  const [invoice, setInvoice] = useStatePay(null);
  const [reportFee, setReportFee] = useStatePay('f1');
  const [clsFilter, setClsFilter] = useStatePay('all');
  const [toast, setToast] = useStatePay(null);
  const studs = payStudents();
  const classes = ['all', ...Array.from(new Set(studs.map(s => s.cls)))];

  /* fee save */
  const saveFee = (f) => {
    if (feeForm.mode === 'edit') {
      const old = feeForm.fee.price;
      setFees(prev => prev.map(x => x.id === f.id ? f : x));
      setFeeForm(null);
      if (f.price !== old) setNotify({ item: f, oldPrice: old });
    } else { setFees(prev => [...prev, { ...f, id: 'f' + Date.now() }]); setFeeForm(null); setToast({ msg: `${f.name} added to fee items`, icon: 'tag' }); }
  };
  const delFee = (id) => { setFees(prev => prev.filter(f => f.id !== id)); setToast({ msg: 'Fee item removed', icon: 'trash-2', tone: 'amber' }); };
  const savePlan = (plan) => { setLedger(prev => ({ ...prev, [planFor.id]: { ...(prev[planFor.id] || { items: {} }), plan } })); setPlanFor(null); setToast({ msg: `Installment plan saved for ${planFor.name}`, icon: 'wallet' }); };
  const markInstallment = (sid, idx) => {
    setLedger(prev => { const L = prev[sid]; if (!L || !L.plan) return prev; const sched = L.plan.schedule.map((s, i) => i === idx ? { ...s, paid: true, overdue: false, date: 'Jun 28' } : s); return { ...prev, [sid]: { ...L, plan: { ...L.plan, schedule: sched } } }; });
    setToast({ msg: 'Installment marked paid', icon: 'check' });
  };

  /* totals */
  let collected = 0, outstanding = 0;
  studs.forEach(s => { const L = ledger[s.id]; if (!L) return; Object.values(L.items).forEach(it => { collected += it.paid; outstanding += (it.total - it.paid); }); });

  /* report rows for a fee item */
  const reportFeeObj = fees.find(f => f.id === reportFee);
  const applicable = reportFeeObj ? (reportFeeObj.scope === 'all' ? studs : studs.filter(s => (reportFeeObj.students || []).includes(s.id))) : [];
  const reportRows = applicable
    .filter(s => clsFilter === 'all' || s.cls === clsFilter)
    .map(s => { const it = (ledger[s.id] && ledger[s.id].items[reportFee]) || { paid: 0, total: reportFeeObj ? reportFeeObj.price : 0 }; return { s, it }; });
  const repPaid = reportRows.filter(x => x.it.paid >= x.it.total);
  const repUnpaid = reportRows.filter(x => x.it.paid < x.it.total);

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['overview', 'Overview', 'layout-dashboard'], ['items', 'Fee items', 'tag'], ['report', 'Paid / Unpaid report', 'list-checks']].map(([v, l, ic]) => {
          const on = tab === v;
          return <button key={v} onClick={() => setTab(v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 'var(--radius-pill)', border: `1px solid ${on ? PAY_MGR : 'var(--border-subtle)'}`, background: on ? PAY_MGR : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}><Icon name={ic} size={16} color={on ? '#fff' : 'var(--text-muted)'} />{l}</button>;
        })}
      </div>

      {/* ---- OVERVIEW ---- */}
      {tab === 'overview' && (
        <React.Fragment>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
            <StatCard label="Collected" value={collected.toLocaleString()} unit="EGP" accent="var(--success-500)" icon={<Icon name="trending-up" size={16} />} />
            <StatCard label="Outstanding" value={outstanding.toLocaleString()} unit="EGP" accent="var(--amber-600)" icon={<Icon name="hourglass" size={16} />} />
            <StatCard label="Fee items" value={fees.length} accent={PAY_MGR} icon={<Icon name="tag" size={16} />} />
            <StatCard label="On plans" value={studs.filter(s => ledger[s.id] && ledger[s.id].plan).length} accent="var(--role-teacher)" icon={<Icon name="wallet" size={16} />} />
          </div>
          <Card padding="none" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Students &amp; balances</h3>
              <span style={{ marginInlineStart: 'auto', fontSize: 12.5, color: 'var(--text-muted)' }}>Open a student to see the full invoice &amp; installments</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
              <thead><tr style={{ background: 'var(--bg-app)' }}>{['Child', 'Class', 'Parent', 'Plan', 'Balance', ''].map((h, i) => <th key={i} style={{ textAlign: 'start', padding: '11px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>{h}</th>)}</tr></thead>
              <tbody>
                {studs.map(s => {
                  const L = ledger[s.id] || { items: {} }; let due = 0; Object.values(L.items).forEach(it => due += (it.total - it.paid));
                  return (
                    <tr key={s.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 20px' }}><div onClick={() => setInvoice(s)} style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }}><Avatar name={s.name} size={34} /><span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{s.name}</span></div></td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-body)' }}>{s.cls}</td>
                      <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-body)' }}>{s.parent}</td>
                      <td style={{ padding: '12px 20px' }}>{L.plan ? <Badge tone="amber" dot>{L.plan.schedule.filter(x => x.paid).length}/{L.plan.n}</Badge> : <span style={{ fontSize: 12.5, color: 'var(--text-subtle)' }}>—</span>}</td>
                      <td style={{ padding: '12px 20px' }}>{due > 0 ? <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--amber-700)' }}>{due.toLocaleString()} EGP</span> : <Badge tone="success" dot>Paid</Badge>}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'end' }}>
                        <F.Menu items={[
                          { icon: 'receipt', label: 'View invoice', onClick: () => setInvoice(s) },
                          { icon: 'wallet', label: L.plan ? 'Edit installment plan' : 'Create installment plan', color: 'var(--amber-600)', onClick: () => setPlanFor(s) },
                          { icon: 'send', label: 'Send invoice', onClick: () => setToast({ msg: `Invoice sent to ${s.parent}`, icon: 'send' }) },
                          { icon: 'bell-ring', label: 'Send payment reminder', onClick: () => setToast({ msg: `Reminder sent to ${s.parent}`, icon: 'bell-ring', tone: 'amber' }) },
                        ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </React.Fragment>
      )}

      {/* ---- FEE ITEMS ---- */}
      {tab === 'items' && (
        <React.Fragment>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Fee items &amp; prices</h3>
            <Button variant="primary" size="sm" iconLeft={<Icon name="plus" size={16} />} style={{ marginInlineStart: 'auto' }} onClick={() => setFeeForm({ mode: 'add' })}>Add fee item</Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
            {fees.map(f => { const c = feeTone(f.tone); return (
              <Card key={f.id} padding="lg" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={f.icon} size={24} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)' }}>{f.name}</span>{f.required ? <Badge tone="teal">Required</Badge> : <Badge tone="neutral">Optional</Badge>}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{f.cycle}{f.nameAr ? ` · ${f.nameAr}` : ''}</div>
                </div>
                <div style={{ textAlign: 'end', flex: 'none' }}>
                  <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-strong)' }}>{f.price.toLocaleString()}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}> EGP</span></div>
                </div>
                <F.Menu items={[
                  { icon: 'pen', label: 'Edit price / details', onClick: () => setFeeForm({ mode: 'edit', fee: f }) },
                  { icon: 'bell-ring', label: 'Notify price to parents', color: 'var(--amber-600)', onClick: () => setNotify({ item: f, oldPrice: f.price }) },
                  { divider: true },
                  { icon: 'trash-2', label: 'Remove item', danger: true, onClick: () => delFee(f.id) },
                ]} />
              </Card>
            ); })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 'var(--radius-lg)', background: 'var(--teal-50)', border: '1px solid var(--teal-100)' }}>
            <Icon name="info" size={19} color="var(--teal-700)" />
            <span style={{ fontSize: 12.5, color: 'var(--teal-800)', lineHeight: 1.5 }}>Add anything payable — tuition, books, bus, meals, uniform, trips. Each appears for parents in the Parent app. Editing a price lets you notify all parents it changes next month.</span>
          </div>
        </React.Fragment>
      )}

      {/* ---- PAID / UNPAID REPORT ---- */}
      {tab === 'report' && (
        <React.Fragment>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)' }}>Item:</span>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {fees.map(f => { const on = reportFee === f.id; return <button key={f.id} onClick={() => setReportFee(f.id)} style={{ height: 34, padding: '0 13px', borderRadius: 'var(--radius-pill)', border: `1px solid ${on ? PAY_MGR : 'var(--border-subtle)'}`, background: on ? PAY_MGR : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{f.name}</button>; })}
            </div>
            <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {classes.map(c => { const on = clsFilter === c; return <button key={c} onClick={() => setClsFilter(c)} style={{ height: 34, padding: '0 13px', borderRadius: 'var(--radius-pill)', border: `1px solid ${on ? PAY_MGR : 'var(--border-subtle)'}`, background: on ? PAY_MGR : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{c === 'all' ? 'All classes' : c}</button>; })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
            <StatCard label="Paid" value={repPaid.length} accent="var(--success-500)" icon={<Icon name="check" size={16} />} />
            <StatCard label="Unpaid" value={repUnpaid.length} accent="var(--danger-500)" icon={<Icon name="x" size={16} />} />
            <StatCard label="Collection rate" value={reportRows.length ? Math.round(repPaid.length / reportRows.length * 100) : 0} unit="%" accent={PAY_MGR} icon={<Icon name="percent" size={16} />} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {/* unpaid */}
            <Card padding="none" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 9, background: 'var(--danger-50)' }}>
                <Icon name="circle-alert" size={17} color="var(--danger-500)" /><span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--danger-700)' }}>Not paid ({repUnpaid.length})</span>
                <Button size="sm" variant="secondary" style={{ marginInlineStart: 'auto' }} iconLeft={<Icon name="bell-ring" size={14} />} onClick={() => setToast({ msg: `Reminder sent to ${repUnpaid.length} parents`, icon: 'bell-ring', tone: 'amber' })}>Remind all</Button>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {repUnpaid.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Everyone paid 🎉</div>}
                {repUnpaid.map(({ s, it }, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                    <Avatar name={s.name} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>{s.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.cls} · {s.parent}</div></div>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--danger-500)' }}>{(it.total - it.paid).toLocaleString()} EGP</span>
                  </div>
                ))}
              </div>
            </Card>
            {/* paid */}
            <Card padding="none" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 9, background: 'var(--success-50)' }}>
                <Icon name="circle-check-big" size={17} color="var(--success-500)" /><span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--success-700)' }}>Paid ({repPaid.length})</span>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {repPaid.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No payments yet</div>}
                {repPaid.map(({ s, it }, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 18px', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                    <Avatar name={s.name} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>{s.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.cls} · {s.parent}</div></div>
                    <Icon name="check-check" size={16} color="var(--success-500)" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </React.Fragment>
      )}

      {feeForm && <FeeForm initial={feeForm.mode === 'edit' ? feeForm.fee : null} onClose={() => setFeeForm(null)} onSave={saveFee} />}
      {notify && <PriceNotify item={notify.item} oldPrice={notify.oldPrice} onClose={() => { setNotify(null); setToast({ msg: 'Price saved', icon: 'check' }); }} onConfirm={() => { setNotify(null); setToast({ msg: 'All parents notified of new price', icon: 'send' }); }} />}
      {planFor && <PlanForm student={planFor} fees={fees} ledger={ledger} onClose={() => setPlanFor(null)} onSave={savePlan} />}
      {invoice && <InvoiceDrawer student={invoice} fees={fees} ledger={ledger} onClose={() => setInvoice(null)} onToast={setToast} markInstallment={markInstallment} />}
      {toast && <F.Toast message={toast.msg} icon={toast.icon} tone={toast.tone} onDone={() => setToast(null)} />}
    </div>
  );
}

window.PaymentsView = PaymentsView;
