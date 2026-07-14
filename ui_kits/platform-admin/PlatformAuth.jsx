const { useState: usePAuth } = React;

/* ====================================================================
   Masar — Platform Admin (company owner) · Login gate
   Exposes window.PlatformAuthGate({ onDone })
   ==================================================================== */
const PLAT = '#4F46B5';

const PA_ROLES = [
  { v: 'owner', label: 'Owner', icon: 'crown', hint: 'Full access — billing, suspensions, plan changes' },
  { v: 'admin', label: 'Admin', icon: 'shield', hint: 'Full access — billing, suspensions, plan changes' },
  { v: 'support', label: 'Support', icon: 'life-buoy', hint: 'Tickets & read-only school info — cannot suspend, refund or change plans' },
];

function PlatformAuthGate({ onDone }) {
  const [stage, setStage] = usePAuth('login');
  const [email, setEmail] = usePAuth('');
  const [pw, setPw] = usePAuth('');
  const [show, setShow] = usePAuth(false);
  const [role, setRole] = usePAuth('owner');
  const [busy, setBusy] = usePAuth(false);
  const [error, setError] = usePAuth('');
  const valid = /.+@.+\..+/.test(email) && pw.length >= 4;
  const lbl = { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-body)', marginBottom: 8 };
  const field = { width: '100%', padding: '13px 15px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14.5, fontFamily: 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };
  const roleMeta = PA_ROLES.find(r => r.v === role);

  // Epic 1 live backend: real Supabase Auth sign-in, then the caller's
  // ACTUAL tier is read from identity.platform_admins — the pre-login radio
  // above is a UX expectation-setter only; the tier that governs what the
  // console actually unlocks always comes from the server (§12.1).
  const submitLogin = async () => {
    if (!valid || busy) return;
    setBusy(true); setError('');
    try {
      await window.MasarClient.auth.signInPlatformAdmin(email, pw);
      const supa = window.MasarClient.client();
      const { data: userData, error: userErr } = await supa.auth.getUser();
      if (userErr || !userData || !userData.user) throw userErr || new Error('No session after sign-in.');
      const { data: profile, error: profileErr } = await supa
        .schema('identity')
        .from('platform_admins')
        .select('role')
        .eq('id', userData.user.id)
        .is('deleted_at', null)
        .maybeSingle();
      if (profileErr) throw profileErr;
      if (!profile) {
        await window.MasarClient.auth.signOut();
        throw new Error('This account is not registered as a Platform Admin.');
      }
      onDone(profile.role);
    } catch (err) {
      setError(window.MasarClient.getErrorMessage(err, 'en'));
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async () => {
    if (!/.+@.+\..+/.test(email) || busy) return;
    setBusy(true); setError('');
    try {
      await window.MasarClient.auth.resetPasswordForEmail(email);
      setStage('login');
    } catch (err) {
      setError(window.MasarClient.getErrorMessage(err, 'en'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-app)' }}>
      <div style={{ flex: '1 1 0', minWidth: 0, background: 'linear-gradient(160deg, #2B2566 0%, #221E54 55%, #1A1742 100%)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 56px' }}>
        <div style={{ position: 'absolute', top: '-12%', insetInlineEnd: '-8%', width: 380, height: 380, borderRadius: '50%', background: 'rgba(239,159,39,.12)', filter: 'blur(10px)' }} />
        <div style={{ position: 'absolute', bottom: '-14%', insetInlineStart: '-10%', width: 420, height: 420, borderRadius: '50%', background: 'rgba(245,243,238,.05)' }} />
        <MasarMark size={26} light />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 'var(--radius-pill)', background: 'rgba(245,243,238,.1)', marginBottom: 24 }}>
            <Icon name="building-2" size={14} color="var(--amber-400)" />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(245,243,238,.9)' }}>Platform Control Center</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, color: '#F5F3EE', lineHeight: 1.15, letterSpacing: '-.02em', maxWidth: 480 }}>Every nursery you run, in one command center.</h1>
          <p style={{ margin: '18px 0 0', fontSize: 16, lineHeight: 1.6, color: 'rgba(245,243,238,.7)', maxWidth: 440 }}>Provision dashboards & apps for each school, isolate their data, and manage subscriptions — all from your company console.</p>
          <div style={{ display: 'flex', gap: 28, marginTop: 40 }}>
            {[['38', 'Schools'], ['EGP 412K', 'MRR'], ['99.9%', 'Uptime']].map(([v, l], i) => (
              <div key={i}><div style={{ fontSize: 24, fontWeight: 800, color: 'var(--amber-400)' }}>{v}</div><div style={{ fontSize: 13, color: 'rgba(245,243,238,.6)', marginTop: 2 }}>{l}</div></div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 2, fontSize: 12.5, color: 'rgba(245,243,238,.45)' }}>© 2026 Masar · Staff access only — permissions vary by role</div>
      </div>

      <div style={{ flex: '0 0 480px', maxWidth: 480, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 56px' }}>
        {stage === 'login' ? (
          <React.Fragment>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'color-mix(in srgb, #4F46B5 12%, transparent)', display: 'grid', placeItems: 'center', marginBottom: 22 }}><Icon name="shield" size={28} color={PLAT} /></div>
            <h2 style={{ margin: 0, fontSize: 27, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-.02em' }}>Staff sign in</h2>
            <p style={{ margin: '8px 0 30px', fontSize: 14.5, color: 'var(--text-muted)' }}>Access the Masar platform console</p>
            <label style={lbl}>Email</label>
            <div style={{ marginBottom: 18, position: 'relative' }}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="owner@masar.app" style={{ ...field, paddingInlineStart: 44 }} />
              <Icon name="mail" size={18} color="var(--text-subtle)" style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            <label style={lbl}>Password</label>
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <input type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" style={{ ...field, paddingInlineStart: 44, paddingInlineEnd: 46 }} />
              <Icon name="lock-keyhole" size={18} color="var(--text-subtle)" style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <button onClick={() => setShow(s => !s)} style={{ position: 'absolute', insetInlineEnd: 8, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name={show ? 'eye-off' : 'eye'} size={18} color="var(--text-subtle)" /></button>
            </div>
            <label style={lbl}>Access level</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {PA_ROLES.map(r => { const on = role === r.v; return (
                <button key={r.v} onClick={() => setRole(r.v)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 6px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? PLAT : 'var(--border-subtle)'}`, background: on ? 'color-mix(in srgb, #4F46B5 8%, transparent)' : 'var(--surface-card)', cursor: 'pointer' }}>
                  <Icon name={r.icon} size={17} color={on ? PLAT : 'var(--text-subtle)'} />
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: on ? PLAT : 'var(--text-body)' }}>{r.label}</span>
                </button>
              ); })}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 24, padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'color-mix(in srgb, #4F46B5 7%, transparent)' }}>
              <Icon name="info" size={17} color={PLAT} style={{ flex: 'none', marginTop: 1 }} /><span style={{ fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.5 }}>{roleMeta.hint}</span>
            </div>
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 18, padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)' }}>
                <Icon name="circle-alert" size={17} color="var(--danger-600)" style={{ flex: 'none', marginTop: 1 }} /><span style={{ fontSize: 12.5, color: 'var(--danger-700)', lineHeight: 1.5 }}>{error}</span>
              </div>
            )}
            <button onClick={submitLogin} disabled={!valid || busy} style={{ height: 52, borderRadius: 'var(--radius-md)', border: 'none', background: (valid && !busy) ? PLAT : 'var(--neutral-300)', color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 15.5, fontWeight: 800, cursor: (valid && !busy) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{busy ? 'Signing in…' : `Sign in as ${roleMeta.label}`}{!busy && <Icon name="arrow-right" size={19} color="#fff" />}</button>
            <button onClick={() => { setStage('forgot'); setError(''); }} style={{ marginTop: 18, background: 'none', border: 'none', color: PLAT, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', alignSelf: 'center' }}>Forgot password?</button>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <button onClick={() => { setStage('login'); setError(''); }} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', marginBottom: 24, padding: 0 }}><Icon name="arrow-left" size={17} color="var(--text-muted)" />Back</button>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'color-mix(in srgb, #4F46B5 12%, transparent)', display: 'grid', placeItems: 'center', marginBottom: 22 }}><Icon name="key-round" size={26} color={PLAT} /></div>
            <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--text-strong)' }}>Reset password</h2>
            <p style={{ margin: '8px 0 28px', fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>Enter your email and we’ll send a secure reset link.</p>
            <label style={lbl}>Email</label>
            <div style={{ marginBottom: 18, position: 'relative' }}><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="owner@masar.app" style={{ ...field, paddingInlineStart: 44 }} /><Icon name="mail" size={18} color="var(--text-subtle)" style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)' }} /></div>
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 18, padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)' }}>
                <Icon name="circle-alert" size={17} color="var(--danger-600)" style={{ flex: 'none', marginTop: 1 }} /><span style={{ fontSize: 12.5, color: 'var(--danger-700)', lineHeight: 1.5 }}>{error}</span>
              </div>
            )}
            <button onClick={submitForgot} disabled={!/.+@.+\..+/.test(email) || busy} style={{ height: 52, borderRadius: 'var(--radius-md)', border: 'none', background: (/.+@.+\..+/.test(email) && !busy) ? PLAT : 'var(--neutral-300)', color: '#fff', fontSize: 15.5, fontWeight: 800, cursor: 'pointer' }}>{busy ? 'Sending…' : 'Send reset link'}</button>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}
window.PlatformAuthGate = PlatformAuthGate;
