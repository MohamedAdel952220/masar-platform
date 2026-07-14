const { useState: usePA } = React;

/* ====================================================================
   Masar — Platform Admin (company owner console)
   All schools (tenants), provisioning, data-isolated, subscriptions.
   ==================================================================== */
const PA = '#4F46B5';
const PA_SOFT = 'color-mix(in srgb, #4F46B5 10%, transparent)';

function paStatusBadge(s) {
  return ({
    active: ['success', 'Active'], trial: ['info', 'Trial'], overdue: ['amber', 'Payment due'], suspended: ['danger', 'Suspended'],
  })[s] || ['neutral', s];
}
const PLAN_META = {
  starter: { label: 'Starter', monthly: 4000, setup: 8000, apps: ['dashboard', 'parent'] },
  growth: { label: 'Growth', monthly: 7500, setup: 12000, apps: ['dashboard', 'parent', 'teacher', 'reception'] },
  premium: { label: 'Premium', monthly: 11000, setup: 18000, apps: ['dashboard', 'parent', 'teacher', 'reception', 'driver'] },
};
const APP_META = {
  dashboard: { label: 'Manager Dashboard', icon: 'layout-dashboard', c: 'var(--role-manager)' },
  parent: { label: 'Parent App', icon: 'smartphone', c: 'var(--primary)' },
  teacher: { label: 'Teacher App', icon: 'graduation-cap', c: 'var(--role-teacher)' },
  reception: { label: 'Reception App', icon: 'scan-line', c: 'var(--role-supervisor)' },
  driver: { label: 'Driver App', icon: 'bus', c: 'var(--role-driver)' },
};

const SEED_SCHOOLS = [
  {
    id: 's1', name: 'Sunrise Nursery', slug: 'sunrise', city: 'New Cairo', plan: 'premium', status: 'active', children: 94, staff: 18, since: 'Sep 2024',
    contact: 'Nadia Fouad', email: 'admin@sunrise.masar.app', phone: '+20 100 222 3344',
    billing: { setupPaid: true, monthly: 11000, lastPaid: '1 Jun 2026', nextDue: '1 Jul 2026', balance: 0, status: 'active' },
    issues: [],
  },
  {
    id: 's2', name: 'Little Stars KG', slug: 'littlestars', city: 'Maadi', plan: 'growth', status: 'overdue', children: 61, staff: 12, since: 'Jan 2025',
    contact: 'Omar Sherif', email: 'admin@littlestars.masar.app', phone: '+20 101 555 7788',
    billing: { setupPaid: true, monthly: 7500, lastPaid: '1 Apr 2026', nextDue: '1 Jun 2026', balance: 15000, status: 'overdue' },
    issues: [{ sev: 'high', type: 'billing', msg: '2 months overdue — EGP 15,000' }, { sev: 'med', type: 'support', msg: 'Reception camera feed reported offline' }],
  },
  {
    id: 's3', name: 'Green Garden', slug: 'greengarden', city: '6 October', plan: 'growth', status: 'active', children: 73, staff: 14, since: 'Oct 2024',
    contact: 'Mona Adel', email: 'admin@greengarden.masar.app', phone: '+20 102 333 1199',
    billing: { setupPaid: true, monthly: 7500, lastPaid: '1 Jun 2026', nextDue: '1 Jul 2026', balance: 0, status: 'active' },
    issues: [{ sev: 'low', type: 'support', msg: 'Requested extra teacher accounts' }],
  },
  {
    id: 's4', name: 'Happy Kids Academy', slug: 'happykids', city: 'Nasr City', plan: 'starter', status: 'trial', children: 28, staff: 6, since: 'Jun 2026',
    contact: 'Sara Mahmoud', email: 'admin@happykids.masar.app', phone: '+20 109 876 5432',
    billing: { setupPaid: false, monthly: 4000, lastPaid: '—', nextDue: '14 Jul 2026', balance: 8000, status: 'trial' },
    issues: [{ sev: 'med', type: 'onboarding', msg: 'Trial ends in 14 days — setup fee unpaid' }],
  },
  {
    id: 's5', name: 'Bright Minds', slug: 'brightminds', city: 'Zamalek', plan: 'premium', status: 'suspended', children: 0, staff: 9, since: 'Mar 2025',
    contact: 'Khaled Nabil', email: 'admin@brightminds.masar.app', phone: '+20 106 777 6655',
    billing: { setupPaid: true, monthly: 11000, lastPaid: '1 Mar 2026', nextDue: '1 Apr 2026', balance: 33000, status: 'suspended' },
    issues: [{ sev: 'high', type: 'billing', msg: 'Suspended — 3 months unpaid (EGP 33,000)' }],
  },
];

/* ---------------- Shared small UI ---------------- */
function PMetric({ icon, label, value, sub, c = PA }) {
  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center' }}><Icon name={icon} size={18} /></span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-strong)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
function PSheet({ title, subtitle, icon, onClose, footer, width = 620, accent = PA, children }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 90, padding: 28 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', width, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--border-subtle)', flex: 'none' }}>
          <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={21} /></span>
          <div style={{ flex: 1, minWidth: 0 }}><h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-strong)' }}>{title}</h3>{subtitle && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>}</div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--surface-raised)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}><Icon name="x" size={18} color="var(--text-body)" /></button>
        </div>
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ display: 'flex', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border-subtle)', flex: 'none' }}>{footer}</div>}
      </div>
    </div>
  );
}
function PToast({ message, onDone }) {
  React.useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: 'fixed', bottom: 28, insetInlineStart: '50%', transform: 'translateX(-50%)', zIndex: 99, display: 'flex', alignItems: 'center', gap: 11, padding: '13px 20px', borderRadius: 'var(--radius-pill)', background: '#1A1742', boxShadow: 'var(--shadow-xl)' }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--success-500)', display: 'grid', placeItems: 'center' }}><Icon name="check" size={15} color="#fff" /></span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F5F3EE' }}>{message}</span>
    </div>
  );
}
const pField = { width: '100%', padding: '11px 13px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };
const pLbl = { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)', marginBottom: 6 };

/* ---------------- Overview ---------------- */
function POverview({ schools, go }) {
  const active = schools.filter(s => s.status === 'active').length;
  const mrr = schools.filter(s => s.status === 'active' || s.status === 'overdue').reduce((s, x) => s + x.billing.monthly, 0);
  const allIssues = schools.flatMap(s => s.issues.map(i => ({ ...i, school: s.name, sid: s.id })));
  const overdue = schools.filter(s => s.billing.balance > 0);
  const sevC = { high: 'var(--danger-500)', med: 'var(--amber-500)', low: 'var(--info-500)' };
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
        <PMetric icon="building-2" label="Schools" value={schools.length} sub={`${active} active · ${schools.filter(s => s.status === 'trial').length} trial`} />
        <PMetric icon="trending-up" label="Monthly revenue" value={`${(mrr / 1000).toFixed(0)}K`} sub="EGP / month" c="var(--success-600)" />
        <PMetric icon="circle-alert" label="Open issues" value={allIssues.length} sub={`${allIssues.filter(i => i.sev === 'high').length} high priority`} c="var(--amber-600)" />
        <PMetric icon="wallet" label="Overdue" value={overdue.length} sub={`EGP ${overdue.reduce((s, x) => s + x.billing.balance, 0).toLocaleString()} unpaid`} c="var(--danger-500)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
        {/* issues feed */}
        <Card padding="none" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Issues across schools</h3>
            <span onClick={() => go('schools')} style={{ marginInlineStart: 'auto', fontSize: 12.5, fontWeight: 700, color: PA, cursor: 'pointer' }}>View all</span>
          </div>
          <div>
            {allIssues.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No open issues 🎉</div>}
            {allIssues.map((it, i) => (
              <div key={i} onClick={() => go('schools')} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 20px', borderTop: i ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: sevC[it.sev], flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{it.school}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{it.msg}</div>
                </div>
                <Badge tone={it.type === 'billing' ? 'amber' : it.type === 'onboarding' ? 'info' : 'neutral'}>{it.type}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* revenue by plan */}
        <Card padding="lg">
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Schools by plan</h3>
          {Object.keys(PLAN_META).map(p => {
            const list = schools.filter(s => s.plan === p);
            const pct = Math.round(list.length / schools.length * 100);
            return (
              <div key={p} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)' }}>{PLAN_META[p].label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>{list.length}</span>
                </div>
                <div style={{ height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--bg-sunken)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: PA, borderRadius: 'var(--radius-pill)' }} /></div>
              </div>
            );
          })}
          <div style={{ marginTop: 18, padding: '14px', borderRadius: 'var(--radius-md)', background: PA_SOFT, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Annual run rate</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: PA }}>EGP {((mrr * 12) / 1000000).toFixed(2)}M</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Add school wizard ---------------- */
function AddSchoolWizard({ onClose, onCreate }) {
  const [step, setStep] = usePA(0);
  const [name, setName] = usePA('');
  const [slug, setSlug] = usePA('');
  const [city, setCity] = usePA('');
  const [contact, setContact] = usePA('');
  const [ownerEmail, setOwnerEmail] = usePA('');
  const [plan, setPlan] = usePA('growth');
  const [busy, setBusy] = usePA(false);
  const [error, setError] = usePA('');
  const autoSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '')).slice(0, 20) || 'school';
  const apps = PLAN_META[plan].apps;
  const step0Valid = name.trim() && city.trim() && contact.trim() && /.+@.+\..+/.test(ownerEmail);

  const created = {
    id: 's' + Date.now(), name: name.trim(), slug: autoSlug, city: city.trim(), plan, status: 'trial', children: 0, staff: 0, since: 'Jun 2026',
    contact: contact.trim(), email: `admin@${autoSlug}.masar.app`, phone: '',
    billing: { setupPaid: false, monthly: PLAN_META[plan].monthly, lastPaid: '—', nextDue: '14 Jul 2026', balance: PLAN_META[plan].setup, status: 'trial' },
    issues: [{ sev: 'med', type: 'onboarding', msg: 'New trial — setup fee unpaid' }],
  };

  // provision-tenant requires ownerPhone (E.164) as the real Auth identity for
  // the initial manager account — this wizard only collects an owner email,
  // so the call is made honestly with the data the UI actually has (no field
  // was added, per the "keep UI unchanged" constraint) and any server-side
  // validation error surfaces to the admin as-is. See EPIC_1_INTEGRATION_REPORT.md.
  const submitCreate = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await window.MasarClient.provisionTenant({
        name: name.trim(),
        slug: autoSlug,
        city: city.trim(),
        planCode: plan,
        contactName: contact.trim(),
        contactEmail: ownerEmail.trim(),
        ownerName: contact.trim(),
        ownerPhone: '',
      });
      onCreate(created);
    } catch (err) {
      setError(window.MasarClient.getErrorMessage(err, 'en'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PSheet icon="building-2" title="Add a school" subtitle={['School details', 'Choose a plan', 'Provision apps & emails'][step]} onClose={onClose}
      footer={step < 2 ? (
        <React.Fragment>
          {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
          <Button variant="primary" fullWidth disabled={step === 0 && !step0Valid} iconRight={<Icon name="arrow-right" size={16} />} onClick={() => setStep(step + 1)}>Continue</Button>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <Button variant="secondary" onClick={() => setStep(1)} disabled={busy}>Back</Button>
          <Button variant="primary" fullWidth disabled={busy} iconLeft={<Icon name="rocket" size={16} />} onClick={submitCreate}>{busy ? 'Provisioning…' : 'Provision school'}</Button>
        </React.Fragment>
      )}>

      {/* step indicators */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {['Details', 'Plan', 'Provision'].map((s, i) => (
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? PA : 'var(--bg-sunken)' }} />
        ))}
      </div>

      {step === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: 'span 2' }}><label style={pLbl}>School name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sunrise Nursery" style={pField} /></div>
          <div><label style={pLbl}>Subdomain</label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} placeholder={autoSlug} style={{ ...pField, borderTopRightRadius: 0, borderBottomRightRadius: 0 }} />
              <span style={{ padding: '11px 12px', fontSize: 13, color: 'var(--text-muted)', background: 'var(--surface-raised)', border: '1.5px solid var(--border-subtle)', borderInlineStart: 'none', borderRadius: '0 var(--radius-md) var(--radius-md) 0', fontFamily: 'var(--font-mono)' }}>.masar.app</span>
            </div>
          </div>
          <div><label style={pLbl}>City</label><input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. New Cairo" style={pField} /></div>
          <div><label style={pLbl}>Admin contact *</label><input value={contact} onChange={e => setContact(e.target.value)} placeholder="Full name" style={pField} /></div>
          <div><label style={pLbl}>Owner email *</label><input value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="admin@school.com" style={pField} /></div>
          <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: PA_SOFT }}>
            <Icon name="shield-check" size={18} color={PA} /><span style={{ fontSize: 12.5, color: 'var(--text-body)' }}>This school’s data is fully isolated — no other school can access it.</span>
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.keys(PLAN_META).map(p => {
            const m = PLAN_META[p]; const on = plan === p;
            return (
              <button key={p} onClick={() => setPlan(p)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? PA : 'var(--border-subtle)'}`, background: on ? PA_SOFT : 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${on ? PA : 'var(--border-strong)'}`, display: 'grid', placeItems: 'center', flex: 'none' }}>{on && <span style={{ width: 11, height: 11, borderRadius: '50%', background: PA }} />}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text-strong)' }}>{m.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{m.apps.length} apps · {m.apps.map(a => APP_META[a].label.split(' ')[0]).join(', ')}</div>
                </div>
                <div style={{ textAlign: 'end' }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: PA }}>{m.monthly.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>EGP/mo · {m.setup.toLocaleString()} setup</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Apps to provision</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {apps.map(a => {
              const m = APP_META[a];
              const appEmail = a === 'dashboard' ? `admin@${autoSlug}.masar.app` : `${a}@${autoSlug}.masar.app`;
              return (
                <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${m.c} 12%, transparent)`, color: m.c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={m.icon} size={18} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{appEmail}</div>
                  </div>
                  <Icon name="circle-check-big" size={18} color="var(--success-500)" />
                </div>
              );
            })}
          </div>
          <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: PA_SOFT }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Setup fee (one-time)</span><span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>EGP {PLAN_META[plan].setup.toLocaleString()}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Monthly subscription</span><span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>EGP {PLAN_META[plan].monthly.toLocaleString()}/mo</span></div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid color-mix(in srgb, #4F46B5 20%, transparent)', fontSize: 12, color: 'var(--text-muted)' }}>Starts as a 14-day trial. Owner gets a dashboard at <b style={{ fontFamily: 'var(--font-mono)', color: PA }}>{autoSlug}.masar.app</b></div>
          </div>
          {error && <div style={{ marginTop: 14, padding: '11px 14px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-200)', color: 'var(--danger-700)', fontSize: 13, fontWeight: 600 }}>{error}</div>}
        </div>
      )}
    </PSheet>
  );
}

/* ---------------- School detail drawer ---------------- */
function SchoolDetail({ school, onClose, onAction, canManage }) {
  const m = PLAN_META[school.plan];
  const [tone, label] = paStatusBadge(school.status);
  const sevC = { high: 'var(--danger-500)', med: 'var(--amber-500)', low: 'var(--info-500)' };
  const [confirmSuspend, setConfirmSuspend] = usePA(false);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', zIndex: 88, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 580, maxWidth: '100%', height: '100%', background: 'var(--bg-app)', overflowY: 'auto', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ background: 'linear-gradient(150deg, #2B2566, #221E54)', padding: '40px 26px 24px', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 22, insetInlineEnd: 22, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(245,243,238,.14)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="x" size={19} color="#F5F3EE" /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ width: 64, height: 64, borderRadius: 'var(--radius-lg)', background: 'rgba(245,243,238,.16)', display: 'grid', placeItems: 'center', flex: 'none', fontSize: 26, fontWeight: 800, color: '#F5F3EE' }}>{school.name[0]}</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F3EE' }}>{school.name}</div>
              <div style={{ fontSize: 13, color: 'rgba(245,243,238,.7)', marginTop: 3 }}>{school.city} · {m.label} plan · since {school.since}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}><Badge tone={tone} solid>{label}</Badge>{school.billing.balance > 0 && <Badge tone="amber" solid>EGP {school.billing.balance.toLocaleString()} due</Badge>}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20 }}>
            <Button variant="amber" size="sm" iconLeft={<Icon name="external-link" size={15} />} onClick={() => onAction('open', school)}>Open dashboard</Button>
            {canManage ? (
              school.status === 'suspended'
                ? <button onClick={() => onAction('reactivate', school)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,243,238,.25)', background: 'rgba(245,243,238,.1)', color: '#F5F3EE', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}><Icon name="play" size={15} />Reactivate</button>
                : <button onClick={() => setConfirmSuspend(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,243,238,.25)', background: 'rgba(245,243,238,.1)', color: '#F5F3EE', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}><Icon name="pause" size={15} />Suspend</button>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 14px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,243,238,.15)', color: 'rgba(245,243,238,.55)', fontSize: 12.5, fontWeight: 700 }}><Icon name="lock" size={14} color="rgba(245,243,238,.55)" />{school.status === 'suspended' ? 'Reactivate' : 'Suspend'} — Admin only</span>
            )}
          </div>
        </div>

        {confirmSuspend && (
          <ConfirmDialog icon="pause" tone="danger" title={`Suspend ${school.name}?`}
            message={`This immediately pauses every provisioned app for this school — Dashboard, Parent, Teacher, Reception and Driver all stop working until you reactivate. ${school.name} will be notified.`}
            confirmLabel="Suspend school" onConfirm={() => onAction('suspend', school)} onClose={() => setConfirmSuspend(false)} />
        )}

        <div style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[[school.children, 'Children'], [school.staff, 'Staff'], [`${m.monthly / 1000}K`, 'EGP/mo']].map(([v, l], i) => (
              <div key={i} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: PA }}>{v}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div></div>
            ))}
          </div>

          {/* issues */}
          {school.issues.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Open issues</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {school.issues.map((it, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: sevC[it.sev], flex: 'none' }} />
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-body)' }}>{it.msg}</span>
                    <Badge tone={it.type === 'billing' ? 'amber' : 'neutral'}>{it.type}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* provisioned apps */}
          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Provisioned apps &amp; emails</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {m.apps.map(a => {
              const am = APP_META[a]; const live = school.status !== 'suspended';
              const appEmail = a === 'dashboard' ? school.email : `${a}@${school.slug}.masar.app`;
              return (
                <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${am.c} 12%, transparent)`, color: am.c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={am.icon} size={18} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{am.label}</div><div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{appEmail}</div></div>
                  <Badge tone={live ? 'success' : 'danger'} dot>{live ? 'Live' : 'Paused'}</Badge>
                </div>
              );
            })}
          </div>

          {/* data isolation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 15px', borderRadius: 'var(--radius-md)', background: PA_SOFT, marginBottom: 20 }}>
            <Icon name="lock" size={18} color={PA} /><span style={{ fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.5 }}>Fully isolated tenant — this school’s data is private and never visible to any other school.</span>
          </div>

          {/* billing quick */}
          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Subscription</div>
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
            {[['Setup fee', school.billing.setupPaid ? 'Paid' : 'Unpaid'], ['Monthly', `EGP ${m.monthly.toLocaleString()}`], ['Last paid', school.billing.lastPaid], ['Next due', school.billing.nextDue], ['Balance', `EGP ${school.billing.balance.toLocaleString()}`]].map(([k, v], i, arr) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: (k === 'Balance' && school.billing.balance > 0) ? 'var(--danger-600)' : 'var(--text-strong)' }}>{v}</span>
              </div>
            ))}
            {school.billing.balance > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Button variant="secondary" size="sm" fullWidth iconLeft={<Icon name="mail" size={15} />} onClick={() => onAction('email', school)}>Email reminder</Button>
                <Button variant="primary" size="sm" fullWidth iconLeft={<Icon name="file-text" size={15} />} onClick={() => onAction('invoice', school)}>Send invoice</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Schools view ---------------- */
function PSchools({ schools, setSchools, toast, canManage }) {
  const [q, setQ] = usePA('');
  const [filter, setFilter] = usePA('all');
  const [add, setAdd] = usePA(false);
  const [detail, setDetail] = usePA(null);

  const rows = schools.filter(s => {
    if (q && !s.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter !== 'all' && s.status !== filter) return false;
    return true;
  });
  const action = (kind, s) => {
    if (kind === 'suspend') { setSchools(p => p.map(x => x.id === s.id ? { ...x, status: 'suspended' } : x)); setDetail(d => d ? { ...d, status: 'suspended' } : d); toast(`${s.name} suspended`); }
    else if (kind === 'reactivate') { setSchools(p => p.map(x => x.id === s.id ? { ...x, status: 'active' } : x)); setDetail(d => d ? { ...d, status: 'active' } : d); toast(`${s.name} reactivated`); }
    else if (kind === 'email') toast(`Payment reminder emailed to ${s.contact}`);
    else if (kind === 'invoice') toast(`Late invoice sent to ${s.name}`);
    else if (kind === 'open') toast(`Opening ${s.slug}.masar.app …`);
  };

  return (
    <div style={{ padding: 32 }}>
      <Card padding="none" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', width: 240 }}>
            <Icon name="search" size={16} color="var(--text-subtle)" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search schools…" style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: 13.5, width: '100%', color: 'var(--text-strong)' }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all', 'All'], ['active', 'Active'], ['trial', 'Trial'], ['overdue', 'Overdue'], ['suspended', 'Suspended']].map(([v, l]) => {
              const on = filter === v;
              return <button key={v} onClick={() => setFilter(v)} style={{ height: 34, padding: '0 13px', borderRadius: 'var(--radius-pill)', border: `1px solid ${on ? PA : 'var(--border-subtle)'}`, background: on ? PA : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>;
            })}
          </div>
          {canManage
            ? <Button variant="primary" size="sm" iconLeft={<Icon name="plus" size={16} />} style={{ marginInlineStart: 'auto', background: PA }} onClick={() => setAdd(true)}>Add school</Button>
            : <RequiresAdmin style={{ marginInlineStart: 'auto' }} />}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
          <thead><tr style={{ background: 'var(--bg-app)' }}>{['School', 'Plan', 'Children', 'Status', 'Monthly', 'Issues', ''].map((h, i) => <th key={i} style={{ textAlign: 'start', padding: '11px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map(s => {
              const [tone, label] = paStatusBadge(s.status); const m = PLAN_META[s.plan];
              return (
                <tr key={s.id} onClick={() => setDetail(s)} style={{ borderTop: '1px solid var(--border-subtle)', cursor: 'pointer', opacity: s.status === 'suspended' ? 0.6 : 1 }}>
                  <td style={{ padding: '12px 20px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><span style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: PA_SOFT, color: PA, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15, flex: 'none' }}>{s.name[0]}</span><div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>{s.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>{s.city} · {s.slug}.masar.app</div></div></div></td>
                  <td style={{ padding: '12px 20px' }}><Badge tone="neutral">{m.label}</Badge></td>
                  <td style={{ padding: '12px 20px', fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>{s.children}</td>
                  <td style={{ padding: '12px 20px' }}><Badge tone={tone} dot>{label}</Badge></td>
                  <td style={{ padding: '12px 20px', fontSize: 13.5, color: 'var(--text-body)' }}>{(m.monthly / 1000)}K</td>
                  <td style={{ padding: '12px 20px' }}>{s.issues.length ? <Badge tone={s.issues.some(i => i.sev === 'high') ? 'danger' : 'amber'} dot>{s.issues.length}</Badge> : <Icon name="check" size={16} color="var(--success-500)" />}</td>
                  <td style={{ padding: '12px 20px', textAlign: 'end' }}><Icon name="chevron-right" size={18} color="var(--text-subtle)" /></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No schools match.</td></tr>}
          </tbody>
        </table>
      </Card>

      {add && canManage && <AddSchoolWizard onClose={() => setAdd(false)} onCreate={(s) => { setSchools(p => [s, ...p]); setAdd(false); toast(`${s.name} provisioned — trial started`); }} />}
      {detail && <SchoolDetail school={detail} onClose={() => setDetail(null)} onAction={action} canManage={canManage} />}
    </div>
  );
}

/* ---------------- Billing view ---------------- */
function PBilling({ schools, toast, canManage }) {
  const [invoice, setInvoice] = usePA(null);
  const paid = schools.filter(s => s.billing.balance === 0 && s.status !== 'trial');
  const unpaid = schools.filter(s => s.billing.balance > 0);
  const totalDue = unpaid.reduce((s, x) => s + x.billing.balance, 0);
  const mrr = schools.filter(s => s.status === 'active' || s.status === 'overdue').reduce((s, x) => s + x.billing.monthly, 0);
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
        <PMetric icon="trending-up" label="MRR" value={`${(mrr / 1000).toFixed(0)}K`} sub="EGP / month" c="var(--success-600)" />
        <PMetric icon="circle-check-big" label="Paid up" value={paid.length} sub="schools current" c="var(--success-600)" />
        <PMetric icon="circle-alert" label="Unpaid" value={unpaid.length} sub="need follow-up" c="var(--amber-600)" />
        <PMetric icon="wallet" label="Outstanding" value={`${(totalDue / 1000).toFixed(0)}K`} sub="EGP overdue" c="var(--danger-500)" />
      </div>

      <Card padding="none" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Subscriptions &amp; payments</h3></div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
          <thead><tr style={{ background: 'var(--bg-app)' }}>{['School', 'Plan', 'Setup', 'Monthly', 'Last paid', 'Balance', 'Status', ''].map((h, i) => <th key={i} style={{ textAlign: 'start', padding: '11px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {schools.map(s => {
              const m = PLAN_META[s.plan]; const [tone, label] = paStatusBadge(s.billing.status);
              return (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 20px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: PA_SOFT, color: PA, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, flex: 'none' }}>{s.name[0]}</span><span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{s.name}</span></div></td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-body)' }}>{m.label}</td>
                  <td style={{ padding: '12px 20px' }}>{s.billing.setupPaid ? <Icon name="check" size={16} color="var(--success-500)" /> : <Badge tone="amber">Unpaid</Badge>}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-body)' }}>{(m.monthly / 1000)}K</td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-muted)' }}>{s.billing.lastPaid}</td>
                  <td style={{ padding: '12px 20px', fontSize: 13.5, fontWeight: 700, color: s.billing.balance > 0 ? 'var(--danger-600)' : 'var(--text-strong)' }}>{s.billing.balance > 0 ? `${s.billing.balance.toLocaleString()}` : '—'}</td>
                  <td style={{ padding: '12px 20px' }}><Badge tone={tone} dot>{label}</Badge></td>
                  <td style={{ padding: '10px 16px', textAlign: 'end' }}>{s.billing.balance > 0 ? (canManage ? <Button variant="primary" size="sm" style={{ background: PA }} onClick={() => setInvoice(s)}>Collect</Button> : <RequiresAdmin />) : <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {invoice && (
        <PSheet icon="file-text" title={`Overdue invoice — ${invoice.name}`} subtitle={`EGP ${invoice.billing.balance.toLocaleString()} outstanding`} width={520} onClose={() => setInvoice(null)}
          footer={<React.Fragment><Button variant="secondary" onClick={() => setInvoice(null)}>Close</Button><Button variant="primary" fullWidth style={{ background: PA }} iconLeft={<Icon name="send" size={16} />} onClick={() => { toast(`Invoice & notice sent to ${invoice.name}`); setInvoice(null); }}>Send invoice</Button></React.Fragment>}>
          <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', padding: '16px 18px', marginBottom: 16 }}>
            {[['Invoice no.', `MSR-INV-${invoice.id.toUpperCase()}-07`], ['School', invoice.name], ['Plan', PLAN_META[invoice.plan].label], ['Period', 'Overdue balance'], ['Amount due', `EGP ${invoice.billing.balance.toLocaleString()}`]].map(([k, v], i, arr) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}><span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{k}</span><span style={{ fontSize: 13.5, fontWeight: 700, color: k === 'Amount due' ? 'var(--danger-600)' : 'var(--text-strong)', fontFamily: /no\.|Amount/.test(k) ? 'var(--font-mono)' : 'var(--font-sans)' }}>{v}</span></div>
            ))}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Deliver via</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['mail', 'Email', invoice.email], ['bell', 'Dashboard notice', 'Shows on their console'], ['message-circle', 'WhatsApp', invoice.phone || 'Owner contact']].map(([ic, t, sub], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: PA_SOFT, color: PA, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={ic} size={17} /></span>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{t}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div></div>
                <Icon name="check" size={16} color="var(--success-500)" />
              </div>
            ))}
          </div>
        </PSheet>
      )}
    </div>
  );
}

/* ---------------- Sidebar + shell ---------------- */
const PNAV = [
  { k: 'overview', icon: 'layout-dashboard', label: 'Overview' },
  { k: 'schools', icon: 'building-2', label: 'Schools' },
  { k: 'billing', icon: 'credit-card', label: 'Billing' },
  { k: 'support', icon: 'ticket', label: 'Support' },
  { k: 'health', icon: 'activity', label: 'System health' },
  { k: 'broadcast', icon: 'megaphone', label: 'Broadcast' },
  { k: 'audit', icon: 'scroll-text', label: 'Audit log' },
];
const PMETA = {
  overview: { t: 'Overview', s: 'All schools across your platform' },
  schools: { t: 'Schools', s: 'Provision & manage every tenant' },
  billing: { t: 'Billing', s: 'Subscriptions, setup fees & collections' },
  support: { t: 'Support', s: 'Tickets & incidents across tenants' },
  health: { t: 'System health', s: 'Service status & uptime' },
  broadcast: { t: 'Broadcast', s: 'Message schools across the platform' },
  audit: { t: 'Audit log', s: 'Every action on the platform' },
};

/* Permission tiers — mirrors the backend's owner/admin/support split.
   Only `owner`/`admin` may provision, suspend/reactivate, or broadcast
   platform-wide; `support` gets full ticket access plus read-only everything else. */
const ROLE_META = {
  owner: { name: 'Tarek Owner', label: 'Platform Owner' },
  admin: { name: 'Mona Admin', label: 'Platform Admin' },
  support: { name: 'Youssef Kamal', label: 'Support' },
};

/* Small lock badge shown next to controls a `support`-tier user can't use */
function RequiresAdmin({ style = {} }) {
  return (
    <span title="Requires Owner or Admin access" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--text-subtle)', ...style }}>
      <Icon name="lock" size={12} color="var(--text-subtle)" />Admin only
    </span>
  );
}

function PlatformAdmin() {
  const [authed, setAuthed] = usePA(false);
  const [role, setRole] = usePA('owner');
  const [view, setView] = usePA('overview');
  const [schools, setSchools] = usePA(SEED_SCHOOLS);
  const [toastMsg, setToastMsg] = usePA(null);
  const toast = (m) => setToastMsg(m);
  const canManage = role === 'owner' || role === 'admin';
  const identity = ROLE_META[role] || ROLE_META.owner;

  if (!authed) return <window.PlatformAuthGate onDone={(r) => { setRole(r || 'owner'); setAuthed(true); }} />;
  const meta = PMETA[view];

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', background: 'var(--bg-app)', minHeight: '100vh' }}>
      <aside style={{ width: 256, flex: 'none', background: 'linear-gradient(180deg, #2B2566, #1A1742)', minHeight: '100vh', position: 'sticky', top: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '22px 20px', display: 'flex', alignItems: 'center', gap: 11 }}>
          <MasarMark size={24} light />
          <div><div style={{ fontSize: 15, fontWeight: 800, color: '#F5F3EE' }}>Masar</div><div style={{ fontSize: 11, color: 'rgba(245,243,238,.55)' }}>Platform Console</div></div>
        </div>
        <div style={{ padding: '8px 12px', flex: 1 }}>
          {PNAV.map(n => { const on = view === n.k; return (
            <button key={n.k} onClick={() => setView(n.k)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', marginBottom: 4, borderRadius: 'var(--radius-md)', border: 'none', background: on ? 'rgba(245,243,238,.12)' : 'transparent', color: on ? '#F5F3EE' : 'rgba(245,243,238,.65)', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: on ? 700 : 600, cursor: 'pointer', textAlign: 'start' }}>
              <Icon name={n.icon} size={19} color={on ? '#F5F3EE' : 'rgba(245,243,238,.65)'} />{n.label}
            </button>
          ); })}
        </div>
        <div style={{ padding: 14, borderTop: '1px solid rgba(245,243,238,.1)', display: 'flex', alignItems: 'center', gap: 11 }}>
          <Avatar name={identity.name} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#F5F3EE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{identity.name}</div>
            <div style={{ fontSize: 11.5, color: 'rgba(245,243,238,.5)', display: 'flex', alignItems: 'center', gap: 5 }}>{!canManage && <Icon name="lock" size={11} color="rgba(245,243,238,.5)" />}{identity.label}</div>
          </div>
          <button onClick={() => { window.MasarClient.auth.signOut().catch(() => {}); setAuthed(false); setView('overview'); }} title="Log out" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: 'none', background: 'rgba(245,243,238,.08)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="log-out" size={16} color="rgba(245,243,238,.6)" /></button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '20px 32px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-card)', position: 'sticky', top: 0, zIndex: 20 }}>
          <div><h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: 'var(--text-strong)' }}>{meta.t}</h1><div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{meta.s}</div></div>
          {!canManage && ['schools', 'billing', 'broadcast'].includes(view) && <RequiresAdmin style={{ marginInlineStart: 'auto' }} />}
        </div>
        {view === 'overview' && <POverview schools={schools} go={setView} />}
        {view === 'schools' && <PSchools schools={schools} setSchools={setSchools} toast={toast} canManage={canManage} />}
        {view === 'billing' && <PBilling schools={schools} toast={toast} canManage={canManage} />}
        {view === 'support' && <window.PSupportView toast={toast} />}
        {view === 'health' && <window.PHealthView />}
        {view === 'broadcast' && <window.PBroadcastView toast={toast} canManage={canManage} />}
        {view === 'audit' && <window.PAuditView />}
      </main>

      {toastMsg && <PToast message={toastMsg} onDone={() => setToastMsg(null)} />}
    </div>
  );
}
window.PlatformAdmin = PlatformAdmin;
