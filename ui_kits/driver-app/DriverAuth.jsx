const { useState: useStateDAuth, useEffect: useEffectDAuth, useRef: useRefDAuth } = React;

/* ====================================================================
   Masar — Driver App · Auth gate
   Splash → Onboarding (3 driver scenes) → Login → Forgot password
   Exposes window.DriverAuthGate({ lang, setLang, onDone })
   ==================================================================== */

const BLU = 'var(--role-driver)';
const BLU_SOFT = '#E4EEF9';

function DLangPill({ lang, setLang, onDark }) {
  const ar = lang === 'ar';
  return (
    <button onClick={() => setLang(ar ? 'en' : 'ar')} style={{ height: 34, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: `1px solid ${onDark ? 'rgba(245,243,238,.3)' : 'var(--border-subtle)'}`, background: onDark ? 'rgba(245,243,238,.12)' : 'var(--surface-card)', color: onDark ? '#F5F3EE' : 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon name="languages" size={15} color={onDark ? '#F5F3EE' : 'var(--text-body)'} />{ar ? 'EN' : 'ع'}
    </button>
  );
}

/* ---------------- SPLASH ---------------- */
function DSplash({ lang, onDone }) {
  const ar = lang === 'ar';
  useEffectDAuth(() => { const t = setTimeout(onDone, 2100); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #2D6CB5 0%, #245A99 60%, #1C497E 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-12%', insetInlineStart: '-18%', width: 280, height: 280, borderRadius: '50%', background: 'rgba(239,159,39,.16)', filter: 'blur(8px)' }} />
      <div style={{ position: 'absolute', bottom: '-14%', insetInlineEnd: '-16%', width: 320, height: 320, borderRadius: '50%', background: 'rgba(245,243,238,.08)' }} />
      <div style={{ animation: 'dsplashPop .7s var(--ease-out) both', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
        <div style={{ width: 96, height: 96, borderRadius: 28, background: '#F5F3EE', display: 'grid', placeItems: 'center', boxShadow: '0 20px 50px -12px rgba(0,0,0,.4)', position: 'relative' }}>
          <MasarMark size={54} />
          <span style={{ position: 'absolute', bottom: -10, insetInlineEnd: -10, width: 40, height: 40, borderRadius: '50%', background: 'var(--amber-500)', display: 'grid', placeItems: 'center', border: '3px solid #F5F3EE' }}><Icon name="bus" size={20} color="#1C1C1A" /></span>
        </div>
        <div style={{ marginTop: 24, fontSize: 34, fontWeight: 800, color: '#F5F3EE', letterSpacing: '-.02em', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مسار' : 'Masar'}</div>
        <div style={{ marginTop: 6, fontSize: 14, color: 'rgba(245,243,238,.78)', fontWeight: 600, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'بوابة السائق' : 'Driver Portal'}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 70, display: 'flex', gap: 8, zIndex: 2 }}>
        {[0, 1, 2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#F5F3EE', opacity: 0.5, animation: `dsplashDot 1.2s ${i * 0.18}s infinite` }} />)}
      </div>
    </div>
  );
}

/* ---------------- ONBOARDING SCENES ---------------- */
/* Scene 1 — Route on a map with numbered stops */
function DSceneRoute({ play, onReplay }) {
  return (
    <div onClick={onReplay} style={{ cursor: 'pointer', width: 250 }}>
      <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '3px solid var(--surface-card)', boxShadow: 'var(--shadow-md)', position: 'relative', height: 200 }}>
        <svg width="100%" height="100%" viewBox="0 0 250 200" preserveAspectRatio="xMidYMid slice">
          <rect width="250" height="200" fill="#E9EEE8" />
          <rect x="14" y="12" width="64" height="44" rx="6" fill="#D7E5D4" />
          <rect x="160" y="120" width="80" height="64" rx="6" fill="#D7E5D4" />
          <g stroke="#fff" strokeWidth="9" strokeLinecap="round">
            <line x1="-5" y1="60" x2="255" y2="60" /><line x1="-5" y1="132" x2="255" y2="132" />
            <line x1="70" y1="-5" x2="70" y2="205" /><line x1="180" y1="-5" x2="180" y2="205" />
          </g>
          <path d="M30 168 L70 132 L70 60 L180 60 L180 132 L220 132" fill="none" stroke={BLU} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 9" opacity="0.9" />
        </svg>
        {[[30,168,'1'],[70,60,'2'],[180,60,'3'],[220,132,'★']].map((p, i) => (
          <span key={'p'+i+play} style={{ position: 'absolute', left: p[0]-13, top: p[1]-13, width: 26, height: 26, borderRadius: '50% 50% 50% 2px', background: p[2]==='★'?'var(--success-500)':BLU, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, transform: 'rotate(-45deg)', boxShadow: 'var(--shadow-sm)', animation: `dpop .4s ${i*0.22}s var(--ease-out) both` }}><span style={{ transform: 'rotate(45deg)' }}>{p[2]}</span></span>
        ))}
        <span style={{ position: 'absolute', width: 30, height: 30, borderRadius: '50%', background: 'var(--amber-500)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 5px rgba(239,159,39,.25)', offsetPath: "path('M30 168 L70 132 L70 60 L180 60 L180 132 L220 132')", animation: 'driveRoute 4s .3s var(--ease-out) infinite' }}><Icon name="bus" size={16} color="#1C1C1A" /></span>
      </div>
    </div>
  );
}

/* Scene 2 — One-tap pickup card */
function DScenePickup({ play, onReplay }) {
  return (
    <div onClick={onReplay} style={{ cursor: 'pointer', width: 250, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div key={'c'+play} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-md)', animation: 'dbubbleIn .45s var(--ease-out)' }}>
        <span style={{ width: 30, height: 30, borderRadius: '50% 50% 50% 2px', background: BLU, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, transform: 'rotate(-45deg)', flex: 'none' }}><span style={{ transform: 'rotate(45deg)' }}>1</span></span>
        <Avatar name="Yousef Adel" size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-strong)' }}>Yousef Adel</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>12 Tahrir St.</div>
        </div>
      </div>
      <div key={'b'+play} style={{ height: 48, borderRadius: 'var(--radius-pill)', background: BLU, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 800, boxShadow: 'var(--shadow-md)', animation: 'dbubbleIn .45s .25s var(--ease-out)' }}>
        <Icon name="hand" size={18} color="#fff" />Picked up
      </div>
      <div key={'n'+play} style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--radius-pill)', background: 'var(--success-50)', border: '1px solid var(--success-100)', animation: 'dbubbleIn .45s .6s var(--ease-out)' }}>
        <Icon name="bell-ring" size={15} color="var(--success-600)" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--success-700)' }}>Parent notified instantly</span>
      </div>
    </div>
  );
}

/* Scene 3 — Safe arrival */
function DSceneArrive({ play, onReplay }) {
  return (
    <div onClick={onReplay} style={{ cursor: 'pointer', width: 230, textAlign: 'center' }}>
      <div key={'s'+play} style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--success-50)', color: 'var(--success-600)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', animation: 'dpop .5s var(--ease-out)' }}>
        <Icon name="school" size={48} />
      </div>
      <div key={'r'+play} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 'var(--radius-pill)', background: BLU, color: '#fff', fontSize: 13, fontWeight: 800, animation: 'dbubbleIn .5s .3s var(--ease-out)' }}>
        <Icon name="check-check" size={17} color="#fff" />All 8 children arrived safely
      </div>
    </div>
  );
}

const D_ONB = [
  { scene: 'route', titleEn: 'Your route, planned for you', titleAr: 'مسارك، مُخطّط لك', subEn: 'Press start and GPS draws the best route through every child’s stop, in order.', subAr: 'اضغط ابدأ ويرسم لك الـ GPS أفضل مسار يمرّ على كل المحطات بالترتيب.' },
  { scene: 'pickup', titleEn: 'One tap to pick up', titleAr: 'استلام بضغطة واحدة', subEn: 'Mark each child as picked up — their parents are notified the moment you do.', subAr: 'سجّل استلام كل طفل — ويصل إشعار لأهله في نفس اللحظة.' },
  { scene: 'arrive', titleEn: 'Everyone arrives safely', titleAr: 'الجميع يصل بأمان', subEn: 'When you reach the nursery, all families get a safe-arrival confirmation.', subAr: 'عند الوصول إلى الحضانة، تصل كل العائلات رسالة تأكيد بالوصول الآمن.' },
];

function DOnboarding({ lang, setLang, onDone }) {
  const ar = lang === 'ar';
  const [i, setI] = useStateDAuth(0);
  const [play, setPlay] = useStateDAuth(0);
  const step = D_ONB[i];
  const next = () => { if (i < D_ONB.length - 1) { setI(i + 1); setPlay(p => p + 1); } else onDone(); };
  const back = () => { if (i > 0) { setI(i - 1); setPlay(p => p + 1); } };
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '46px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <MasarMark size={22} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DLangPill lang={lang} setLang={setLang} />
          <button onClick={onDone} style={{ height: 34, padding: '0 12px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>{ar ? 'تخطّي' : 'Skip'}</button>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px' }}>
        <div style={{ height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          {step.scene === 'route' && <DSceneRoute play={play} onReplay={() => setPlay(p => p + 1)} />}
          {step.scene === 'pickup' && <DScenePickup play={play} onReplay={() => setPlay(p => p + 1)} />}
          {step.scene === 'arrive' && <DSceneArrive play={play} onReplay={() => setPlay(p => p + 1)} />}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-subtle)', marginBottom: 14 }}>
          <Icon name="hand-pointer" size={13} color="var(--text-subtle)" />{ar ? 'اضغط على الرسم للإعادة' : 'Tap the illustration to replay'}
        </div>
        <h2 key={'t' + i} style={{ margin: 0, fontSize: 23, fontWeight: 800, color: 'var(--text-strong)', textAlign: 'center', letterSpacing: '-.01em', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', animation: 'dbubbleIn .4s var(--ease-out)' }}>{ar ? step.titleAr : step.titleEn}</h2>
        <p key={'s' + i} style={{ margin: '12px 0 0', fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 320, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', animation: 'dbubbleIn .4s .08s var(--ease-out)' }}>{ar ? step.subAr : step.subEn}</p>
      </div>
      <div style={{ padding: '0 24px 36px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
          {D_ONB.map((_, j) => (
            <button key={j} onClick={() => { setI(j); setPlay(p => p + 1); }} style={{ width: j === i ? 26 : 8, height: 8, borderRadius: 4, border: 'none', background: j === i ? BLU : 'var(--neutral-300)', cursor: 'pointer', transition: 'all .25s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {i > 0 && (
            <button onClick={back} style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}>
              <Icon name={ar ? 'chevron-right' : 'chevron-left'} size={22} color="var(--text-body)" />
            </button>
          )}
          <button onClick={next} style={{ flex: 1, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: BLU, color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {i === D_ONB.length - 1 ? (ar ? 'ابدأ الآن' : 'Get started') : (ar ? 'التالي' : 'Next')}
            <Icon name={ar ? 'arrow-left' : 'arrow-right'} size={19} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- LOGIN ---------------- */
function DPhoneField({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, direction: 'ltr' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', flex: 'none' }}>
        <span style={{ fontSize: 16 }}>🇪🇬</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>+20</span>
      </div>
      <input type="tel" inputMode="numeric" value={value} onChange={e => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))} placeholder="10 1234 5678" style={{ flex: 1, padding: '13px 15px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 15, fontFamily: 'var(--font-mono)', color: 'var(--text-strong)', background: 'var(--surface-card)', outline: 'none', letterSpacing: '.03em' }} />
    </div>
  );
}

function DLogin({ lang, setLang, onLogin, onForgot }) {
  const ar = lang === 'ar';
  const [phone, setPhone] = useStateDAuth('');
  const [pw, setPw] = useStateDAuth('');
  const [show, setShow] = useStateDAuth(false);
  const [busy, setBusy] = useStateDAuth(false);
  const [error, setError] = useStateDAuth('');
  const valid = phone.length >= 10 && pw.length >= 4;
  const lbl = { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-body)', marginBottom: 8, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' };
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true); setError('');
    try {
      await window.MasarClient.auth.signInWithPhone('+20' + phone, pw);
      onLogin();
    } catch (err) {
      setError(window.MasarClient.getErrorMessage(err, lang));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '46px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <MasarMark size={24} />
        <DLangPill lang={lang} setLang={setLang} />
      </div>
      <div style={{ padding: '24px 26px 30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: BLU_SOFT, display: 'grid', placeItems: 'center', marginBottom: 18 }}>
          <Icon name="bus" size={30} color={BLU} />
        </div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-.02em', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'أهلًا بالكابتن' : 'Welcome, captain'}</h1>
        <p style={{ margin: '8px 0 26px', fontSize: 14.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'سجّل الدخول لبدء رحلتك' : 'Sign in to start your trip'}</p>
        <label style={lbl}>{ar ? 'رقم الهاتف' : 'Phone number'}</label>
        <div style={{ marginBottom: 18 }}><DPhoneField value={phone} onChange={setPhone} /></div>
        <label style={lbl}>{ar ? 'كلمة المرور' : 'Password'}</label>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '13px 46px 13px 15px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 15, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={() => setShow(s => !s)} style={{ position: 'absolute', insetInlineEnd: 8, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <Icon name={show ? 'eye-off' : 'eye'} size={18} color="var(--text-subtle)" />
          </button>
        </div>
        <button onClick={onForgot} style={{ alignSelf: ar ? 'flex-start' : 'flex-end', background: 'none', border: 'none', color: BLU, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 26, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'نسيت كلمة المرور؟' : 'Forgot password?'}</button>
        {error && <div style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-200)', color: 'var(--danger-700)', fontSize: 13, fontWeight: 600, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{error}</div>}
        <button onClick={submit} disabled={!valid || busy} style={{ height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: valid ? BLU : 'var(--neutral-300)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: valid && !busy ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {busy ? (ar ? 'جارٍ الدخول…' : 'Signing in…') : (ar ? 'تسجيل الدخول' : 'Sign in')}<Icon name={ar ? 'arrow-left' : 'arrow-right'} size={19} color="#fff" />
        </button>
        <div style={{ marginTop: 'auto', paddingTop: 24, textAlign: 'center', fontSize: 13.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
          {ar ? 'مشكلة في الدخول؟ ' : 'Trouble signing in? '}
          <span style={{ color: BLU, fontWeight: 700, cursor: 'pointer' }}>{ar ? 'تواصل مع الإدارة' : 'Contact admin'}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- FORGOT ---------------- */
function DOTPInput({ value, onChange, len = 4 }) {
  const refs = useRefDAuth([]);
  const set = (idx, v) => {
    const d = v.replace(/[^0-9]/g, '').slice(-1);
    const arr = value.split(''); arr[idx] = d; const next = arr.join('').slice(0, len);
    onChange(next);
    if (d && idx < len - 1 && refs.current[idx + 1]) refs.current[idx + 1].focus();
  };
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', direction: 'ltr' }}>
      {Array.from({ length: len }).map((_, i) => (
        <input key={i} ref={el => refs.current[i] = el} type="tel" inputMode="numeric" maxLength={1} value={value[i] || ''} onChange={e => set(i, e.target.value)}
          onKeyDown={e => { if (e.key === 'Backspace' && !value[i] && i > 0 && refs.current[i - 1]) refs.current[i - 1].focus(); }}
          style={{ width: 56, height: 64, textAlign: 'center', fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)', border: `1.5px solid ${value[i] ? BLU : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-md)', color: 'var(--text-strong)', background: 'var(--surface-card)', outline: 'none' }} />
      ))}
    </div>
  );
}

function DForgot({ lang, setLang, onClose, onReset }) {
  const ar = lang === 'ar';
  const [step, setStep] = useStateDAuth('phone');
  const [phone, setPhone] = useStateDAuth('');
  const [channel, setChannel] = useStateDAuth('whatsapp');
  const [otp, setOtp] = useStateDAuth('');
  const [pw, setPw] = useStateDAuth('');
  const [pw2, setPw2] = useStateDAuth('');
  const [seconds, setSeconds] = useStateDAuth(45);
  const [busy, setBusy] = useStateDAuth(false);
  const [error, setError] = useStateDAuth('');
  useEffectDAuth(() => {
    if (step !== 'otp') return;
    setSeconds(45);
    const t = setInterval(() => setSeconds(s => (s <= 1 ? (clearInterval(t), 0) : s - 1)), 1000);
    return () => clearInterval(t);
  }, [step]);
  const lbl = { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-body)', marginBottom: 8, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' };
  const masked = phone ? `+20 ${phone.slice(0, 2)} •••• ${phone.slice(-2)}` : '';
  const sendCode = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await window.MasarClient.auth.sendPhoneOtp('+20' + phone);
      setOtp(''); setStep('otp');
    } catch (err) {
      setError(window.MasarClient.getErrorMessage(err, lang));
    } finally {
      setBusy(false);
    }
  };
  const verifyCode = async () => {
    if (otp.length < 4 || busy) return;
    setBusy(true); setError('');
    try {
      await window.MasarClient.auth.verifyPhoneOtp('+20' + phone, otp);
      setStep('reset');
    } catch (err) {
      setError(window.MasarClient.getErrorMessage(err, lang));
    } finally {
      setBusy(false);
    }
  };
  const savePassword = async () => {
    if (!pwValid || busy) return;
    setBusy(true); setError('');
    try {
      const supa = window.MasarClient.client();
      const res = await supa.auth.updateUser({ password: pw });
      if (res.error) throw res.error;
      setStep('done');
    } catch (err) {
      setError(window.MasarClient.getErrorMessage(err, lang));
    } finally {
      setBusy(false);
    }
  };
  const Header = ({ onBack }) => (
    <div style={{ padding: '46px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name={ar ? 'arrow-right' : 'arrow-left'} size={20} color="var(--text-body)" /></button>
      <DLangPill lang={lang} setLang={setLang} />
    </div>
  );
  const pwValid = pw.length >= 6 && pw === pw2;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {step === 'phone' && (
        <React.Fragment>
          <Header onBack={onClose} />
          <div style={{ padding: '18px 26px 30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: BLU_SOFT, display: 'grid', placeItems: 'center', marginBottom: 18 }}><Icon name="key-round" size={26} color={BLU} /></span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'نسيت كلمة المرور؟' : 'Forgot password?'}</h1>
            <p style={{ margin: '8px 0 26px', fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.55, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'أدخل رقم هاتفك المسجّل وسنرسل لك رمز تحقق.' : "Enter your registered phone number and we'll send a verification code."}</p>
            <label style={lbl}>{ar ? 'رقم الهاتف' : 'Phone number'}</label>
            <div style={{ marginBottom: 24 }}><DPhoneField value={phone} onChange={setPhone} /></div>
            <button onClick={() => phone.length >= 10 && setStep('channel')} disabled={phone.length < 10} style={{ height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: phone.length >= 10 ? BLU : 'var(--neutral-300)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: phone.length >= 10 ? 'pointer' : 'not-allowed' }}>{ar ? 'متابعة' : 'Continue'}</button>
          </div>
        </React.Fragment>
      )}
      {step === 'channel' && (
        <React.Fragment>
          <Header onBack={() => setStep('phone')} />
          <div style={{ padding: '18px 26px 30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'كيف تريد استلام الرمز؟' : 'How to receive the code?'}</h1>
            <p style={{ margin: '8px 0 24px', fontSize: 14.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `سنرسل رمزًا مكوّنًا من ٤ أرقام إلى ${masked}` : `We'll send a 4-digit code to ${masked}`}</p>
            {[
              { v: 'whatsapp', icon: 'message-circle', c: '#25D366', en: 'WhatsApp', ar: 'واتساب', dEn: 'Instant message to your WhatsApp', dA: 'رسالة فورية على واتساب' },
              { v: 'sms', icon: 'message-square', c: 'var(--info-600)', en: 'SMS', ar: 'رسالة نصية', dEn: 'Text message to your phone', dA: 'رسالة نصية على هاتفك' },
            ].map(o => {
              const on = channel === o.v;
              return (
                <button key={o.v} onClick={() => setChannel(o.v)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', marginBottom: 12, borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? BLU : 'var(--border-subtle)'}`, background: on ? BLU_SOFT : 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
                  <span style={{ width: 44, height: 44, borderRadius: '50%', background: `color-mix(in srgb, ${o.c} 14%, transparent)`, color: o.c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={o.icon} size={22} /></span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? o.ar : o.en}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? o.dA : o.dEn}</span>
                  </span>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${on ? BLU : 'var(--border-strong)'}`, display: 'grid', placeItems: 'center', flex: 'none' }}>{on && <span style={{ width: 11, height: 11, borderRadius: '50%', background: BLU }} />}</span>
                </button>
              );
            })}
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 12, padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)' }}>
                <Icon name="circle-alert" size={16} color="var(--danger-600)" style={{ flex: 'none', marginTop: 1 }} /><span style={{ fontSize: 12.5, color: 'var(--danger-700)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{error}</span>
              </div>
            )}
            <button onClick={sendCode} disabled={busy} style={{ marginTop: 12, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: BLU, opacity: busy ? 0.7 : 1, color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="send" size={18} color="#fff" />{busy ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : (ar ? 'إرسال الرمز' : 'Send code')}
            </button>
          </div>
        </React.Fragment>
      )}
      {step === 'otp' && (
        <React.Fragment>
          <Header onBack={() => setStep('channel')} />
          <div style={{ padding: '18px 26px 30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: channel === 'whatsapp' ? 'rgba(37,211,102,.12)' : 'var(--info-50)', display: 'grid', placeItems: 'center', marginBottom: 18 }}><Icon name={channel === 'whatsapp' ? 'message-circle' : 'message-square'} size={26} color={channel === 'whatsapp' ? '#25D366' : 'var(--info-600)'} /></span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'أدخل رمز التحقق' : 'Enter the code'}</h1>
            <p style={{ margin: '8px 0 26px', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.55, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `أرسلنا رمزًا عبر ${channel === 'whatsapp' ? 'واتساب' : 'رسالة نصية'} إلى ${masked}` : `We sent a code via ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to ${masked}`}</p>
            <DOTPInput value={otp} onChange={setOtp} len={4} />
            <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
              {seconds > 0
                ? (ar ? `إعادة الإرسال خلال 0:${String(seconds).padStart(2, '0')}` : `Resend in 0:${String(seconds).padStart(2, '0')}`)
                : <span onClick={() => setSeconds(45)} style={{ color: BLU, fontWeight: 700, cursor: 'pointer' }}>{ar ? 'إعادة إرسال الرمز' : 'Resend code'}</span>}
            </div>
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)' }}>
                <Icon name="circle-alert" size={16} color="var(--danger-600)" style={{ flex: 'none', marginTop: 1 }} /><span style={{ fontSize: 12.5, color: 'var(--danger-700)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{error}</span>
              </div>
            )}
            <button onClick={verifyCode} disabled={otp.length < 4 || busy} style={{ marginTop: 28, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: (otp.length === 4 && !busy) ? BLU : 'var(--neutral-300)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: (otp.length === 4 && !busy) ? 'pointer' : 'not-allowed' }}>{busy ? (ar ? 'جارٍ التحقق…' : 'Verifying…') : (ar ? 'تحقّق' : 'Verify')}</button>
          </div>
        </React.Fragment>
      )}
      {step === 'reset' && (
        <React.Fragment>
          <Header onBack={() => setStep('otp')} />
          <div style={{ padding: '18px 26px 30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: BLU_SOFT, display: 'grid', placeItems: 'center', marginBottom: 18 }}><Icon name="lock-keyhole" size={26} color={BLU} /></span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'كلمة مرور جديدة' : 'New password'}</h1>
            <p style={{ margin: '8px 0 24px', fontSize: 14.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'اختر كلمة مرور قوية لا تقل عن ٦ أحرف.' : 'Choose a strong password of at least 6 characters.'}</p>
            <label style={lbl}>{ar ? 'كلمة المرور الجديدة' : 'New password'}</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '13px 15px', marginBottom: 16, border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 15, color: 'var(--text-strong)', background: 'var(--surface-card)', outline: 'none', boxSizing: 'border-box', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }} />
            <label style={lbl}>{ar ? 'تأكيد كلمة المرور' : 'Confirm password'}</label>
            <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '13px 15px', border: `1.5px solid ${pw2 && pw !== pw2 ? 'var(--danger-400)' : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-md)', fontSize: 15, color: 'var(--text-strong)', background: 'var(--surface-card)', outline: 'none', boxSizing: 'border-box', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }} />
            {pw2 && pw !== pw2 && <span style={{ fontSize: 12, color: 'var(--danger-600)', marginTop: 6, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'}</span>}
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 14, padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)' }}>
                <Icon name="circle-alert" size={16} color="var(--danger-600)" style={{ flex: 'none', marginTop: 1 }} /><span style={{ fontSize: 12.5, color: 'var(--danger-700)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{error}</span>
              </div>
            )}
            <button onClick={savePassword} disabled={!pwValid || busy} style={{ marginTop: 28, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: (pwValid && !busy) ? BLU : 'var(--neutral-300)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: (pwValid && !busy) ? 'pointer' : 'not-allowed' }}>{busy ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ كلمة المرور' : 'Save password')}</button>
          </div>
        </React.Fragment>
      )}
      {step === 'done' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 30px', textAlign: 'center' }}>
          <span style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--success-50)', color: 'var(--success-600)', display: 'grid', placeItems: 'center', marginBottom: 22, animation: 'dsplashPop .5s var(--ease-out) both' }}><Icon name="circle-check-big" size={48} /></span>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تم تغيير كلمة المرور' : 'Password changed'}</h1>
          <p style={{ margin: '10px 0 30px', fontSize: 14.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.' : 'You can now sign in with your new password.'}</p>
          <button onClick={onReset} style={{ width: '100%', maxWidth: 280, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: BLU, color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>{ar ? 'تسجيل الدخول' : 'Back to sign in'}</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- GATE ---------------- */
function DriverAuthGate({ lang, setLang, onDone }) {
  const ar = lang === 'ar';
  const [stage, setStage] = useStateDAuth('splash');
  return (
    <div dir={ar ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0 }}>
      <style>{`
        @keyframes dsplashPop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
        @keyframes dsplashDot{0%,100%{opacity:.35;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}
        @keyframes dbubbleIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dpop{from{opacity:0;transform:scale(.3) rotate(-45deg)}to{opacity:1;transform:scale(1) rotate(-45deg)}}
        @keyframes driveRoute{from{offset-distance:0%}to{offset-distance:100%}}
      `}</style>
      {stage === 'splash' && <DSplash lang={lang} onDone={() => setStage('onboarding')} />}
      {stage === 'onboarding' && <DOnboarding lang={lang} setLang={setLang} onDone={() => setStage('login')} />}
      {stage === 'login' && <DLogin lang={lang} setLang={setLang} onLogin={onDone} onForgot={() => setStage('forgot')} />}
      {stage === 'forgot' && <DForgot lang={lang} setLang={setLang} onClose={() => setStage('login')} onReset={() => setStage('login')} />}
    </div>
  );
}

window.DriverAuthGate = DriverAuthGate;
