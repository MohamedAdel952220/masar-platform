const { useState: useStateRAuth, useEffect: useEffectRAuth, useRef: useRefRAuth } = React;

/* ====================================================================
   Masar — Reception App · Auth gate
   Splash → Onboarding (3 reception scenes) → Login → Forgot password
   Exposes window.ReceptionAuthGate({ lang, setLang, onDone })
   ==================================================================== */

const TER = 'var(--role-supervisor)';
const TER_SOFT = '#F6E7DC';

function RLangPill({ lang, setLang }) {
  const ar = lang === 'ar';
  return (
    <button onClick={() => setLang(ar ? 'en' : 'ar')} style={{ height: 34, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon name="languages" size={15} color="var(--text-body)" />{ar ? 'EN' : 'ع'}
    </button>
  );
}

/* ---------------- SPLASH ---------------- */
function RSplash({ lang, onDone }) {
  const ar = lang === 'ar';
  useEffectRAuth(() => { const t = setTimeout(onDone, 2100); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #C2622E 0%, #A85324 60%, #8C4419 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-12%', insetInlineStart: '-18%', width: 280, height: 280, borderRadius: '50%', background: 'rgba(245,243,238,.10)', filter: 'blur(8px)' }} />
      <div style={{ position: 'absolute', bottom: '-14%', insetInlineEnd: '-16%', width: 320, height: 320, borderRadius: '50%', background: 'rgba(245,243,238,.07)' }} />
      <div style={{ animation: 'rsplashPop .7s var(--ease-out) both', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
        <div style={{ width: 96, height: 96, borderRadius: 28, background: '#F5F3EE', display: 'grid', placeItems: 'center', boxShadow: '0 20px 50px -12px rgba(0,0,0,.4)', position: 'relative' }}>
          <MasarMark size={54} />
          <span style={{ position: 'absolute', bottom: -10, insetInlineEnd: -10, width: 40, height: 40, borderRadius: '50%', background: 'var(--amber-500)', display: 'grid', placeItems: 'center', border: '3px solid #F5F3EE' }}><Icon name="scan-line" size={20} color="#1C1C1A" /></span>
        </div>
        <div style={{ marginTop: 24, fontSize: 34, fontWeight: 800, color: '#F5F3EE', letterSpacing: '-.02em', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مسار' : 'Masar'}</div>
        <div style={{ marginTop: 6, fontSize: 14, color: 'rgba(245,243,238,.82)', fontWeight: 600, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'بوابة الاستقبال' : 'Reception Portal'}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 70, display: 'flex', gap: 8, zIndex: 2 }}>
        {[0, 1, 2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#F5F3EE', opacity: 0.5, animation: `rsplashDot 1.2s ${i * 0.18}s infinite` }} />)}
      </div>
    </div>
  );
}

/* ---------------- ONBOARDING SCENES ---------------- */
/* Scene 1 — Scan QR to verify pickup */
function RSceneScan({ play, onReplay }) {
  return (
    <div onClick={onReplay} style={{ cursor: 'pointer', width: 230, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div key={'q'+play} style={{ position: 'relative', width: 150, height: 150, borderRadius: 'var(--radius-lg)', background: '#fff', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-md)', display: 'grid', placeItems: 'center', overflow: 'hidden', animation: 'rpop .5s var(--ease-out)' }}>
        <svg viewBox="0 0 21 21" width={104} height={104} shapeRendering="crispEdges">
          {(() => { const c=[]; for(let y=0;y<21;y++)for(let x=0;x<21;x++){ const f=(x<7&&y<7)||(x>=14&&y<7)||(x<7&&y>=14); const on=f?((x===0||x===6||y===0||y===6||(x>=2&&x<=4&&y>=2&&y<=4))||(x>=14&&(x===14||x===20))||(y>=14&&(y===14||y===20))):(((x*7+y*13+x*y)%3===0)); if(on)c.push(<rect key={x+'-'+y} x={x} y={y} width="1" height="1" fill="#1C1C1A"/>);} return c; })()}
        </svg>
        <div style={{ position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, height: 3, background: TER, boxShadow: `0 0 12px ${TER}`, animation: 'scanLine 1.8s ease-in-out infinite' }} />
      </div>
      <div key={'b'+play} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--radius-pill)', background: 'var(--success-50)', border: '1px solid var(--success-100)', animation: 'rbubbleIn .5s .5s var(--ease-out)' }}>
        <Icon name="badge-check" size={16} color="var(--success-600)" />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--success-700)' }}>Identity verified</span>
      </div>
    </div>
  );
}

/* Scene 2 — Confirm bus arrival count */
function RSceneCount({ play, onReplay }) {
  return (
    <div onClick={onReplay} style={{ cursor: 'pointer', width: 240 }}>
      <div style={{ borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-md)', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: TER_SOFT, color: TER, display: 'grid', placeItems: 'center' }}><Icon name="bus" size={18} /></span>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)' }}>Bus 3 arriving</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[0,1,2,3,4,5,6,7].map(i => (
            <span key={'a'+i+play} style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--success-50)', border: '2px solid var(--success-500)', display: 'grid', placeItems: 'center', animation: `rpop .3s ${i*0.12}s var(--ease-out) both` }}><Icon name="check" size={18} color="var(--success-600)" /></span>
          ))}
        </div>
        <div key={'t'+play} style={{ marginTop: 14, textAlign: 'center', fontSize: 13, fontWeight: 800, color: TER, animation: `rbubbleIn .4s 1.1s var(--ease-out) both` }}>8 / 8 children counted</div>
      </div>
    </div>
  );
}

/* Scene 3 — Notify parents */
function RSceneNotify({ play, onReplay }) {
  return (
    <div onClick={onReplay} style={{ cursor: 'pointer', width: 230, textAlign: 'center' }}>
      <div key={'s'+play} style={{ width: 96, height: 96, borderRadius: '50%', background: TER_SOFT, color: TER, display: 'grid', placeItems: 'center', margin: '0 auto 16px', animation: 'rpop .5s var(--ease-out)' }}>
        <Icon name="bell-ring" size={46} />
      </div>
      <div key={'r'+play} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 'var(--radius-pill)', background: 'var(--success-500)', color: '#fff', fontSize: 13, fontWeight: 800, animation: 'rbubbleIn .5s .3s var(--ease-out)' }}>
        <Icon name="check-check" size={17} color="#fff" />All parents notified
      </div>
    </div>
  );
}

const R_ONB = [
  { scene: 'scan', titleEn: 'Scan to verify every pickup', titleAr: 'امسح للتحقق من كل استلام', subEn: 'Scan the QR a parent or authorized person shows — see the child and who is collecting them.', subAr: 'امسح كود الـ QR الذي يعرضه ولي الأمر أو الشخص المخوّل — وشاهد الطفل ومن يستلمه.' },
  { scene: 'count', titleEn: 'Confirm the bus, child by child', titleAr: 'أكّد الباص، طفلًا طفلًا', subEn: 'Count children on and off the bus and confirm before any notification is sent.', subAr: 'عُدّ الأطفال عند النزول والصعود وأكّد قبل إرسال أي إشعار.' },
  { scene: 'notify', titleEn: 'Parents are kept in the loop', titleAr: 'الأهل دائمًا على اطّلاع', subEn: 'Once you confirm, every family gets an instant, trusted notification.', subAr: 'بمجرد التأكيد، تصل كل عائلة إشعارًا فوريًا وموثوقًا.' },
];

function ROnboarding({ lang, setLang, onDone }) {
  const ar = lang === 'ar';
  const [i, setI] = useStateRAuth(0);
  const [play, setPlay] = useStateRAuth(0);
  const step = R_ONB[i];
  const next = () => { if (i < R_ONB.length - 1) { setI(i + 1); setPlay(p => p + 1); } else onDone(); };
  const back = () => { if (i > 0) { setI(i - 1); setPlay(p => p + 1); } };
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '46px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <MasarMark size={22} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RLangPill lang={lang} setLang={setLang} />
          <button onClick={onDone} style={{ height: 34, padding: '0 12px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>{ar ? 'تخطّي' : 'Skip'}</button>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px' }}>
        <div style={{ height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          {step.scene === 'scan' && <RSceneScan play={play} onReplay={() => setPlay(p => p + 1)} />}
          {step.scene === 'count' && <RSceneCount play={play} onReplay={() => setPlay(p => p + 1)} />}
          {step.scene === 'notify' && <RSceneNotify play={play} onReplay={() => setPlay(p => p + 1)} />}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-subtle)', marginBottom: 14 }}>
          <Icon name="hand-pointer" size={13} color="var(--text-subtle)" />{ar ? 'اضغط على الرسم للإعادة' : 'Tap the illustration to replay'}
        </div>
        <h2 key={'t' + i} style={{ margin: 0, fontSize: 23, fontWeight: 800, color: 'var(--text-strong)', textAlign: 'center', letterSpacing: '-.01em', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', animation: 'rbubbleIn .4s var(--ease-out)' }}>{ar ? step.titleAr : step.titleEn}</h2>
        <p key={'s' + i} style={{ margin: '12px 0 0', fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 320, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', animation: 'rbubbleIn .4s .08s var(--ease-out)' }}>{ar ? step.subAr : step.subEn}</p>
      </div>
      <div style={{ padding: '0 24px 36px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
          {R_ONB.map((_, j) => (
            <button key={j} onClick={() => { setI(j); setPlay(p => p + 1); }} style={{ width: j === i ? 26 : 8, height: 8, borderRadius: 4, border: 'none', background: j === i ? TER : 'var(--neutral-300)', cursor: 'pointer', transition: 'all .25s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {i > 0 && (
            <button onClick={back} style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}>
              <Icon name={ar ? 'chevron-right' : 'chevron-left'} size={22} color="var(--text-body)" />
            </button>
          )}
          <button onClick={next} style={{ flex: 1, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: TER, color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {i === R_ONB.length - 1 ? (ar ? 'ابدأ الآن' : 'Get started') : (ar ? 'التالي' : 'Next')}
            <Icon name={ar ? 'arrow-left' : 'arrow-right'} size={19} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- LOGIN ---------------- */
function RPhoneField({ value, onChange }) {
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

function RLogin({ lang, setLang, onLogin, onForgot }) {
  const ar = lang === 'ar';
  const [phone, setPhone] = useStateRAuth('');
  const [pw, setPw] = useStateRAuth('');
  const [show, setShow] = useStateRAuth(false);
  const [busy, setBusy] = useStateRAuth(false);
  const [error, setError] = useStateRAuth('');
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
        <RLangPill lang={lang} setLang={setLang} />
      </div>
      <div style={{ padding: '24px 26px 30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: TER_SOFT, display: 'grid', placeItems: 'center', marginBottom: 18 }}>
          <Icon name="scan-line" size={30} color={TER} />
        </div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-.02em', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مرحبًا بالاستقبال' : 'Welcome, reception'}</h1>
        <p style={{ margin: '8px 0 26px', fontSize: 14.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'سجّل الدخول لإدارة الاستلام' : 'Sign in to manage handovers'}</p>
        <label style={lbl}>{ar ? 'رقم الهاتف' : 'Phone number'}</label>
        <div style={{ marginBottom: 18 }}><RPhoneField value={phone} onChange={setPhone} /></div>
        <label style={lbl}>{ar ? 'كلمة المرور' : 'Password'}</label>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '13px 46px 13px 15px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 15, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={() => setShow(s => !s)} style={{ position: 'absolute', insetInlineEnd: 8, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <Icon name={show ? 'eye-off' : 'eye'} size={18} color="var(--text-subtle)" />
          </button>
        </div>
        <button onClick={onForgot} style={{ alignSelf: ar ? 'flex-start' : 'flex-end', background: 'none', border: 'none', color: TER, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 26, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'نسيت كلمة المرور؟' : 'Forgot password?'}</button>
        {error && <div style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-200)', color: 'var(--danger-700)', fontSize: 13, fontWeight: 600, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{error}</div>}
        <button onClick={submit} disabled={!valid || busy} style={{ height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: valid ? TER : 'var(--neutral-300)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: valid && !busy ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {busy ? (ar ? 'جارٍ الدخول…' : 'Signing in…') : (ar ? 'تسجيل الدخول' : 'Sign in')}<Icon name={ar ? 'arrow-left' : 'arrow-right'} size={19} color="#fff" />
        </button>
        <div style={{ marginTop: 'auto', paddingTop: 24, textAlign: 'center', fontSize: 13.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
          {ar ? 'مشكلة في الدخول؟ ' : 'Trouble signing in? '}
          <span style={{ color: TER, fontWeight: 700, cursor: 'pointer' }}>{ar ? 'تواصل مع الإدارة' : 'Contact admin'}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- FORGOT ---------------- */
function ROTPInput({ value, onChange, len = 4 }) {
  const refs = useRefRAuth([]);
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
          style={{ width: 56, height: 64, textAlign: 'center', fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)', border: `1.5px solid ${value[i] ? TER : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-md)', color: 'var(--text-strong)', background: 'var(--surface-card)', outline: 'none' }} />
      ))}
    </div>
  );
}

function RForgot({ lang, setLang, onClose, onReset }) {
  const ar = lang === 'ar';
  const [step, setStep] = useStateRAuth('phone');
  const [phone, setPhone] = useStateRAuth('');
  const [channel, setChannel] = useStateRAuth('whatsapp');
  const [otp, setOtp] = useStateRAuth('');
  const [pw, setPw] = useStateRAuth('');
  const [pw2, setPw2] = useStateRAuth('');
  const [seconds, setSeconds] = useStateRAuth(45);
  const [busy, setBusy] = useStateRAuth(false);
  const [error, setError] = useStateRAuth('');
  useEffectRAuth(() => {
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
      <RLangPill lang={lang} setLang={setLang} />
    </div>
  );
  const pwValid = pw.length >= 6 && pw === pw2;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {step === 'phone' && (
        <React.Fragment>
          <Header onBack={onClose} />
          <div style={{ padding: '18px 26px 30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: TER_SOFT, display: 'grid', placeItems: 'center', marginBottom: 18 }}><Icon name="key-round" size={26} color={TER} /></span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'نسيت كلمة المرور؟' : 'Forgot password?'}</h1>
            <p style={{ margin: '8px 0 26px', fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.55, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'أدخل رقم هاتفك المسجّل وسنرسل لك رمز تحقق.' : "Enter your registered phone number and we'll send a verification code."}</p>
            <label style={lbl}>{ar ? 'رقم الهاتف' : 'Phone number'}</label>
            <div style={{ marginBottom: 24 }}><RPhoneField value={phone} onChange={setPhone} /></div>
            <button onClick={() => phone.length >= 10 && setStep('channel')} disabled={phone.length < 10} style={{ height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: phone.length >= 10 ? TER : 'var(--neutral-300)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: phone.length >= 10 ? 'pointer' : 'not-allowed' }}>{ar ? 'متابعة' : 'Continue'}</button>
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
                <button key={o.v} onClick={() => setChannel(o.v)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', marginBottom: 12, borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? TER : 'var(--border-subtle)'}`, background: on ? TER_SOFT : 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
                  <span style={{ width: 44, height: 44, borderRadius: '50%', background: `color-mix(in srgb, ${o.c} 14%, transparent)`, color: o.c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={o.icon} size={22} /></span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? o.ar : o.en}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? o.dA : o.dEn}</span>
                  </span>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${on ? TER : 'var(--border-strong)'}`, display: 'grid', placeItems: 'center', flex: 'none' }}>{on && <span style={{ width: 11, height: 11, borderRadius: '50%', background: TER }} />}</span>
                </button>
              );
            })}
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 12, padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)' }}>
                <Icon name="circle-alert" size={16} color="var(--danger-600)" style={{ flex: 'none', marginTop: 1 }} /><span style={{ fontSize: 12.5, color: 'var(--danger-700)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{error}</span>
              </div>
            )}
            <button onClick={sendCode} disabled={busy} style={{ marginTop: 12, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: TER, opacity: busy ? 0.7 : 1, color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
            <ROTPInput value={otp} onChange={setOtp} len={4} />
            <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
              {seconds > 0
                ? (ar ? `إعادة الإرسال خلال 0:${String(seconds).padStart(2, '0')}` : `Resend in 0:${String(seconds).padStart(2, '0')}`)
                : <span onClick={() => setSeconds(45)} style={{ color: TER, fontWeight: 700, cursor: 'pointer' }}>{ar ? 'إعادة إرسال الرمز' : 'Resend code'}</span>}
            </div>
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)' }}>
                <Icon name="circle-alert" size={16} color="var(--danger-600)" style={{ flex: 'none', marginTop: 1 }} /><span style={{ fontSize: 12.5, color: 'var(--danger-700)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{error}</span>
              </div>
            )}
            <button onClick={verifyCode} disabled={otp.length < 4 || busy} style={{ marginTop: 28, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: (otp.length === 4 && !busy) ? TER : 'var(--neutral-300)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: (otp.length === 4 && !busy) ? 'pointer' : 'not-allowed' }}>{busy ? (ar ? 'جارٍ التحقق…' : 'Verifying…') : (ar ? 'تحقّق' : 'Verify')}</button>
          </div>
        </React.Fragment>
      )}
      {step === 'reset' && (
        <React.Fragment>
          <Header onBack={() => setStep('otp')} />
          <div style={{ padding: '18px 26px 30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: TER_SOFT, display: 'grid', placeItems: 'center', marginBottom: 18 }}><Icon name="lock-keyhole" size={26} color={TER} /></span>
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
            <button onClick={savePassword} disabled={!pwValid || busy} style={{ marginTop: 28, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: (pwValid && !busy) ? TER : 'var(--neutral-300)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: (pwValid && !busy) ? 'pointer' : 'not-allowed' }}>{busy ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ كلمة المرور' : 'Save password')}</button>
          </div>
        </React.Fragment>
      )}
      {step === 'done' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 30px', textAlign: 'center' }}>
          <span style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--success-50)', color: 'var(--success-600)', display: 'grid', placeItems: 'center', marginBottom: 22, animation: 'rsplashPop .5s var(--ease-out) both' }}><Icon name="circle-check-big" size={48} /></span>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تم تغيير كلمة المرور' : 'Password changed'}</h1>
          <p style={{ margin: '10px 0 30px', fontSize: 14.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.' : 'You can now sign in with your new password.'}</p>
          <button onClick={onReset} style={{ width: '100%', maxWidth: 280, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: TER, color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>{ar ? 'تسجيل الدخول' : 'Back to sign in'}</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- GATE ---------------- */
function ReceptionAuthGate({ lang, setLang, onDone }) {
  const ar = lang === 'ar';
  const [stage, setStage] = useStateRAuth('splash');
  return (
    <div dir={ar ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0 }}>
      <style>{`
        @keyframes rsplashPop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
        @keyframes rsplashDot{0%,100%{opacity:.35;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}
        @keyframes rbubbleIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rpop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
        @keyframes scanLine{0%{top:8%}50%{top:88%}100%{top:8%}}
      `}</style>
      {stage === 'splash' && <RSplash lang={lang} onDone={() => setStage('onboarding')} />}
      {stage === 'onboarding' && <ROnboarding lang={lang} setLang={setLang} onDone={() => setStage('login')} />}
      {stage === 'login' && <RLogin lang={lang} setLang={setLang} onLogin={onDone} onForgot={() => setStage('forgot')} />}
      {stage === 'forgot' && <RForgot lang={lang} setLang={setLang} onClose={() => setStage('login')} onReset={() => setStage('login')} />}
    </div>
  );
}

window.ReceptionAuthGate = ReceptionAuthGate;
