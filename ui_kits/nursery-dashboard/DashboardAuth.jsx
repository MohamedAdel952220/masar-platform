const { useState: useStateDashAuth } = React;

/* ====================================================================
   Masar — Nursery Dashboard · Login gate (manager portal)
   Desktop split-screen login + forgot password.
   Exposes window.DashboardAuthGate({ onDone })
   ==================================================================== */

const MGR = 'var(--role-manager)'; // dark teal

function DashboardAuthGate({ onDone }) {
  const [stage, setStage] = useStateDashAuth('login'); // login | forgot
  const [email, setEmail] = useStateDashAuth('');
  const [pw, setPw] = useStateDashAuth('');
  const [show, setShow] = useStateDashAuth(false);
  const [remember, setRemember] = useStateDashAuth(true);
  const [busy, setBusy] = useStateDashAuth(false);
  const [error, setError] = useStateDashAuth('');
  const valid = /.+@.+\..+/.test(email) && pw.length >= 4;

  const lbl = { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-body)', marginBottom: 8 };
  const field = { width: '100%', padding: '13px 15px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14.5, fontFamily: 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };

  // Epic 1 live backend: real Supabase Auth sign-in via the SDK's email+password
  // path, matching this form's own "work email" field exactly. Manager accounts
  // are provisioned phone-first (provision-tenant, §10.3) with no email Auth
  // identity yet, so this is correctly wired end-to-end but will only succeed
  // once a manager account has an email identity — see EPIC_1_INTEGRATION_REPORT.md.
  const submitLogin = async () => {
    if (!valid || busy) return;
    setBusy(true); setError('');
    try {
      const supa = window.MasarClient.client();
      const res = await supa.auth.signInWithPassword({ email: email, password: pw });
      if (res.error) throw res.error;
      const { data: staffRow, error: staffErr } = await supa
        .schema('identity')
        .from('staff_profiles')
        .select('role, employment_status')
        .eq('id', res.data.user.id)
        .is('deleted_at', null)
        .maybeSingle();
      if (staffErr) throw staffErr;
      if (!staffRow || staffRow.role !== 'manager') {
        await supa.auth.signOut();
        throw new Error('This account is not a nursery manager account.');
      }
      if (staffRow.employment_status === 'terminated') {
        await supa.auth.signOut();
        throw new Error('This account has been suspended. Contact your Masar administrator.');
      }
      onDone();
    } catch (err) {
      setError(window.MasarClient.getErrorMessage(err, 'en'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-app)' }}>
      {/* Left brand panel */}
      <div style={{ flex: '1 1 0', minWidth: 0, background: 'linear-gradient(160deg, #0F3D38 0%, #0B2E2A 60%, #082320 100%)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 56px' }}>
        <div style={{ position: 'absolute', top: '-10%', insetInlineEnd: '-8%', width: 360, height: 360, borderRadius: '50%', background: 'rgba(239,159,39,.12)', filter: 'blur(10px)' }} />
        <div style={{ position: 'absolute', bottom: '-12%', insetInlineStart: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(245,243,238,.05)' }} />
        <MasarMark size={26} light />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 'var(--radius-pill)', background: 'rgba(245,243,238,.1)', marginBottom: 24 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--amber-400)' }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(245,243,238,.9)' }}>Nursery Manager Console</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, color: '#F5F3EE', lineHeight: 1.15, letterSpacing: '-.02em', maxWidth: 480 }}>Run your whole nursery from one calm place.</h1>
          <p style={{ margin: '18px 0 0', fontSize: 16, lineHeight: 1.6, color: 'rgba(245,243,238,.7)', maxWidth: 440 }}>Children, staff, attendance, buses, payments and AI reports — every signal in Masar, in one console.</p>
          <div style={{ display: 'flex', gap: 28, marginTop: 40 }}>
            {[['120+', 'Nurseries'], ['8K+', 'Children'], ['99.9%', 'Uptime']].map(([v, l], i) => (
              <div key={i}>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--amber-400)' }}>{v}</div>
                <div style={{ fontSize: 13, color: 'rgba(245,243,238,.6)', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 2, fontSize: 12.5, color: 'rgba(245,243,238,.45)' }}>© 2026 Masar · Secure manager access</div>
      </div>

      {/* Right form panel */}
      <div style={{ flex: '0 0 480px', maxWidth: 480, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 56px' }}>
        {stage === 'login' ? (
          <React.Fragment>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--teal-50)', display: 'grid', placeItems: 'center', marginBottom: 22 }}>
              <Icon name="layout-dashboard" size={28} color={MGR} />
            </div>
            <h2 style={{ margin: 0, fontSize: 27, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-.02em' }}>Welcome back</h2>
            <p style={{ margin: '8px 0 30px', fontSize: 14.5, color: 'var(--text-muted)' }}>Sign in to your nursery console</p>

            <label style={lbl}>Work email</label>
            <div style={{ marginBottom: 18, position: 'relative' }}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="manager@sunrise.edu" style={{ ...field, paddingInlineStart: 44 }} />
              <Icon name="mail" size={18} color="var(--text-subtle)" style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)' }} />
            </div>

            <label style={lbl}>Password</label>
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <input type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" style={{ ...field, paddingInlineStart: 44, paddingInlineEnd: 46 }} />
              <Icon name="lock-keyhole" size={18} color="var(--text-subtle)" style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <button onClick={() => setShow(s => !s)} style={{ position: 'absolute', insetInlineEnd: 8, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <Icon name={show ? 'eye-off' : 'eye'} size={18} color="var(--text-subtle)" />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
              <button onClick={() => setRemember(r => !r)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${remember ? MGR : 'var(--border-strong)'}`, background: remember ? MGR : 'transparent', display: 'grid', placeItems: 'center' }}>{remember && <Icon name="check" size={13} color="#fff" />}</span>
                <span style={{ fontSize: 13.5, color: 'var(--text-body)', fontWeight: 600 }}>Remember me</span>
              </button>
              <button onClick={() => { setStage('forgot'); setError(''); }} style={{ background: 'none', border: 'none', color: MGR, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Forgot password?</button>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 18, padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)' }}>
                <Icon name="circle-alert" size={17} color="var(--danger-600)" style={{ flex: 'none', marginTop: 1 }} /><span style={{ fontSize: 12.5, color: 'var(--danger-700)', lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            <button onClick={submitLogin} disabled={!valid || busy} style={{ height: 52, borderRadius: 'var(--radius-md)', border: 'none', background: (valid && !busy) ? MGR : 'var(--neutral-300)', color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 15.5, fontWeight: 800, cursor: (valid && !busy) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {busy ? 'Signing in…' : 'Sign in'}{!busy && <Icon name="arrow-right" size={19} color="#fff" />}
            </button>

            <div style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--border-subtle)', textAlign: 'center', fontSize: 13.5, color: 'var(--text-muted)' }}>
              Need a nursery account? <span style={{ color: MGR, fontWeight: 700, cursor: 'pointer' }}>Talk to sales</span>
            </div>
          </React.Fragment>
        ) : (
          <DashForgot mgr={MGR} field={field} lbl={lbl} onBack={() => setStage('login')} onDone={() => setStage('login')} />
        )}
      </div>
    </div>
  );
}

function DashForgot({ mgr, field, lbl, onBack, onDone }) {
  const [step, setStep] = useStateDashAuth('email');
  const [email, setEmail] = useStateDashAuth('');
  const [busy, setBusy] = useStateDashAuth(false);
  const [error, setError] = useStateDashAuth('');
  const valid = /.+@.+\..+/.test(email);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true); setError('');
    try {
      await window.MasarClient.auth.resetPasswordForEmail(email);
      setStep('sent');
    } catch (err) {
      setError(window.MasarClient.getErrorMessage(err, 'en'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <React.Fragment>
      <button onClick={onBack} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', marginBottom: 24, padding: 0 }}>
        <Icon name="arrow-left" size={17} color="var(--text-muted)" />Back to sign in
      </button>
      {step === 'email' ? (
        <React.Fragment>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--teal-50)', display: 'grid', placeItems: 'center', marginBottom: 22 }}><Icon name="key-round" size={26} color={mgr} /></div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--text-strong)' }}>Reset password</h2>
          <p style={{ margin: '8px 0 28px', fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>Enter your work email and we’ll send a secure reset link.</p>
          <label style={lbl}>Work email</label>
          <div style={{ marginBottom: 18, position: 'relative' }}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="manager@sunrise.edu" style={{ ...field, paddingInlineStart: 44 }} />
            <Icon name="mail" size={18} color="var(--text-subtle)" style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)' }} />
          </div>
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 18, padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)' }}>
              <Icon name="circle-alert" size={17} color="var(--danger-600)" style={{ flex: 'none', marginTop: 1 }} /><span style={{ fontSize: 12.5, color: 'var(--danger-700)', lineHeight: 1.5 }}>{error}</span>
            </div>
          )}
          <button onClick={submit} disabled={!valid || busy} style={{ height: 52, borderRadius: 'var(--radius-md)', border: 'none', background: (valid && !busy) ? mgr : 'var(--neutral-300)', color: '#fff', fontSize: 15.5, fontWeight: 800, cursor: (valid && !busy) ? 'pointer' : 'not-allowed' }}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </React.Fragment>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <span style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--success-50)', color: 'var(--success-600)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}><Icon name="mail-check" size={40} /></span>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-strong)' }}>Check your inbox</h2>
          <p style={{ margin: '10px auto 28px', fontSize: 14.5, color: 'var(--text-muted)', maxWidth: 320, lineHeight: 1.55 }}>We sent a reset link to <b>{email}</b>. It expires in 30 minutes.</p>
          <button onClick={onDone} style={{ height: 50, padding: '0 28px', borderRadius: 'var(--radius-md)', border: 'none', background: mgr, color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Back to sign in</button>
        </div>
      )}
    </React.Fragment>
  );
}

window.DashboardAuthGate = DashboardAuthGate;
