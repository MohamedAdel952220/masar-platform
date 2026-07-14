const { useState: useStateAuth, useEffect: useEffectAuth, useRef: useRefAuth } = React;

/* ====================================================================
   Masar — Parent App · Auth gate
   Splash → Onboarding (3 interactive scenes) → Login → (Forgot password)
   Exposes window.ParentAuthGate({ lang, setLang, onDone })
   ==================================================================== */

const TEAL = 'var(--primary)';
const fAr = (ar) => ar ? 'var(--font-arabic)' : 'var(--font-sans)';

/* ---------------- Language pill (shared) ---------------- */
function LangPill({ lang, setLang, onDark }) {
  const ar = lang === 'ar';
  return (
    <button onClick={() => setLang(ar ? 'en' : 'ar')} style={{ height: 34, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: `1px solid ${onDark ? 'rgba(245,243,238,.3)' : 'var(--border-subtle)'}`, background: onDark ? 'rgba(245,243,238,.12)' : 'var(--surface-card)', color: onDark ? '#F5F3EE' : 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon name="languages" size={15} color={onDark ? '#F5F3EE' : 'var(--text-body)'} />{ar ? 'EN' : 'ع'}
    </button>
  );
}

/* ====================================================================
   SPLASH
   ==================================================================== */
function SplashScreen({ lang, onDone }) {
  const ar = lang === 'ar';
  useEffectAuth(() => {
    const t = setTimeout(onDone, 2100);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #0F6E56 0%, #0C5946 60%, #0A4A3A 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {/* soft background blobs */}
      <div style={{ position: 'absolute', top: '-12%', insetInlineStart: '-18%', width: 280, height: 280, borderRadius: '50%', background: 'rgba(239,159,39,.16)', filter: 'blur(8px)' }} />
      <div style={{ position: 'absolute', bottom: '-14%', insetInlineEnd: '-16%', width: 320, height: 320, borderRadius: '50%', background: 'rgba(245,243,238,.08)' }} />

      <div style={{ animation: 'splashPop .7s var(--ease-out) both', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
        <div style={{ width: 96, height: 96, borderRadius: 28, background: '#F5F3EE', display: 'grid', placeItems: 'center', boxShadow: '0 20px 50px -12px rgba(0,0,0,.4)' }}>
          <MasarMark size={54} />
        </div>
        <div style={{ marginTop: 22, fontSize: 34, fontWeight: 800, color: '#F5F3EE', letterSpacing: '-.02em', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مسار' : 'Masar'}</div>
        <div style={{ marginTop: 6, fontSize: 14, color: 'rgba(245,243,238,.75)', fontWeight: 600, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'بوابة الأهل' : 'Parent Portal'}</div>
      </div>

      {/* loading dots */}
      <div style={{ position: 'absolute', bottom: 70, display: 'flex', gap: 8, zIndex: 2 }}>
        {[0, 1, 2].map(i => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#F5F3EE', opacity: 0.5, animation: `splashDot 1.2s ${i * 0.18}s infinite` }} />)}
      </div>
    </div>
  );
}

/* ====================================================================
   ONBOARDING — 3 interactive illustration scenes
   ==================================================================== */
/* Scene 1 — Track the day (animated day-path; visible at rest, animates on tap) */
function SceneDay({ play, onReplay }) {
  const stops = [
    { icon: 'house', c: 'var(--teal-500)' },
    { icon: 'bus', c: 'var(--amber-500)' },
    { icon: 'school', c: 'var(--info-500)' },
    { icon: 'smile', c: 'var(--role-teacher)' },
  ];
  return (
    <div onClick={onReplay} style={{ cursor: 'pointer', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: 260, height: 150 }}>
        {/* connecting track */}
        <div style={{ position: 'absolute', top: 30, insetInlineStart: 24, insetInlineEnd: 24, height: 5, borderRadius: 3, background: 'var(--neutral-200)' }} />
        <div key={play} style={{ position: 'absolute', top: 30, insetInlineStart: 24, height: 5, borderRadius: 3, background: TEAL, width: 212, animation: 'fillTrack 1.6s .15s var(--ease-out)' }} />
        {/* stops (always visible) */}
        <div style={{ position: 'absolute', top: 8, insetInlineStart: 0, insetInlineEnd: 0, display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
          {stops.map((s, i) => (
            <span key={i} style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--surface-card)', border: `3px solid ${s.c}`, color: s.c, display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}><Icon name={s.icon} size={22} /></span>
          ))}
        </div>
        {/* moving child dot (rests at end, rides on replay) */}
        <span key={'d' + play} style={{ position: 'absolute', top: 22, insetInlineStart: 228, width: 16, height: 16, borderRadius: '50%', background: 'var(--amber-500)', boxShadow: '0 0 0 4px rgba(239,159,39,.25)', animation: 'rideTrack 1.6s .15s var(--ease-out)' }} />
      </div>
    </div>
  );
}

/* Scene 2 — Live camera + bus (CCTV viewport with LIVE pulse + bus marker) */
function SceneWatch({ play, onReplay }) {
  return (
    <div onClick={onReplay} style={{ cursor: 'pointer', width: 250, position: 'relative' }}>
      {/* camera frame */}
      <div style={{ borderRadius: 18, overflow: 'hidden', border: '3px solid var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ position: 'relative', height: 150, background: 'radial-gradient(120% 90% at 50% 20%, #1d3b39, #0E2422 75%)' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 3px)' }} />
          {/* play figures */}
          <span style={{ position: 'absolute', left: '28%', bottom: '24%', width: 26, height: 26, borderRadius: '50%', background: 'rgba(239,159,39,.5)', animation: 'floaty 2.4s infinite' }} />
          <span style={{ position: 'absolute', right: '30%', bottom: '20%', width: 20, height: 20, borderRadius: '50%', background: 'rgba(245,243,238,.22)', animation: 'floaty 2.4s .6s infinite' }} />
          <Icon name="video" size={34} color="rgba(245,243,238,.18)" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
          {/* LIVE */}
          <div style={{ position: 'absolute', top: 10, insetInlineStart: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 'var(--radius-pill)', background: 'rgba(213,80,58,.92)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', animation: 'blink 1.4s infinite' }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '.1em' }}>LIVE</span>
          </div>
        </div>
      </div>
      {/* bus chip floating below */}
      <div style={{ position: 'absolute', insetInlineEnd: -10, bottom: -18, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-subtle)' }}>
        <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--amber-500)', display: 'grid', placeItems: 'center' }}><Icon name="bus" size={15} color="#1C1C1A" /></span>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>5 min</span>
      </div>
    </div>
  );
}

/* Scene 3 — Stay connected (chat bubbles + report card popping in) */
function SceneConnect({ play, onReplay }) {
  return (
    <div onClick={onReplay} style={{ cursor: 'pointer', width: 250, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div key={'a' + play} style={{ alignSelf: 'flex-start', maxWidth: '78%', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', boxShadow: 'var(--shadow-sm)', animation: 'bubbleIn .5s .05s var(--ease-out)' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--role-teacher)', marginBottom: 2 }}>Ms. Sara</div>
        <div style={{ fontSize: 13, color: 'var(--text-body)' }}>Yousef did great today! 🌟</div>
      </div>
      <div key={'b' + play} style={{ alignSelf: 'flex-end', maxWidth: '70%', background: TEAL, color: '#fff', borderRadius: '16px 16px 4px 16px', padding: '10px 14px', boxShadow: 'var(--shadow-sm)', animation: 'bubbleIn .5s .35s var(--ease-out)' }}>
        <div style={{ fontSize: 13 }}>Thank you! 💚</div>
      </div>
      {/* report chip */}
      <div key={'c' + play} style={{ alignSelf: 'center', marginTop: 4, display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', borderRadius: 'var(--radius-md)', background: 'var(--teal-50)', border: '1px solid var(--teal-100)', animation: 'bubbleIn .5s .6s var(--ease-out)' }}>
        <Icon name="file-check" size={18} color={TEAL} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--teal-800)' }}>Monthly report ready</span>
      </div>
    </div>
  );
}

const ONB = [
  { scene: 'day', icon: 'route', titleEn: "Follow every step of the day", titleAr: 'تابِع كل خطوة في يوم طفلك', subEn: "From home to bus to classroom — see your child's day path update live.", subAr: 'من المنزل إلى الباص إلى الفصل — تابع مسار يوم طفلك لحظة بلحظة.' },
  { scene: 'watch', icon: 'video', titleEn: 'Watch live & track the bus', titleAr: 'شاهد مباشرة وتابع الباص', subEn: 'Open the nursery cameras any time, and follow the bus on a live map.', subAr: 'افتح كاميرات الحضانة في أي وقت، وتابع الباص على خريطة حيّة.' },
  { scene: 'connect', icon: 'messages-square', titleEn: 'Stay connected with teachers', titleAr: 'ابقَ على تواصل مع المعلمين', subEn: 'Chat with subject teachers, get reports, and manage payments — all in one place.', subAr: 'تواصل مع معلمي المواد، واستلم التقارير، وأدِر المدفوعات — في مكان واحد.' },
];

function Onboarding({ lang, setLang, onDone }) {
  const ar = lang === 'ar';
  const [i, setI] = useStateAuth(0);
  const [play, setPlay] = useStateAuth(0); // replay key
  const step = ONB[i];

  const next = () => { if (i < ONB.length - 1) { setI(i + 1); setPlay(p => p + 1); } else onDone(); };
  const back = () => { if (i > 0) { setI(i - 1); setPlay(p => p + 1); } };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
      {/* top bar */}
      <div style={{ padding: '46px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <MasarMark size={22} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LangPill lang={lang} setLang={setLang} />
          <button onClick={onDone} style={{ height: 34, padding: '0 12px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>{ar ? 'تخطّي' : 'Skip'}</button>
        </div>
      </div>

      {/* illustration */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 28px' }}>
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          {step.scene === 'day' && <SceneDay play={play} onReplay={() => setPlay(p => p + 1)} />}
          {step.scene === 'watch' && <SceneWatch play={play} onReplay={() => setPlay(p => p + 1)} />}
          {step.scene === 'connect' && <SceneConnect play={play} onReplay={() => setPlay(p => p + 1)} />}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-subtle)', marginBottom: 14 }}>
          <Icon name="hand-pointer" size={13} color="var(--text-subtle)" />{ar ? 'اضغط على الرسم للإعادة' : 'Tap the illustration to replay'}
        </div>
        <h2 key={'t' + i} style={{ margin: 0, fontSize: 23, fontWeight: 800, color: 'var(--text-strong)', textAlign: 'center', letterSpacing: '-.01em', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', animation: 'bubbleIn .4s var(--ease-out) both' }}>{ar ? step.titleAr : step.titleEn}</h2>
        <p key={'s' + i} style={{ margin: '12px 0 0', fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 320, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', animation: 'bubbleIn .4s .08s var(--ease-out) both' }}>{ar ? step.subAr : step.subEn}</p>
      </div>

      {/* footer */}
      <div style={{ padding: '0 24px 36px' }}>
        {/* dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
          {ONB.map((_, j) => (
            <button key={j} onClick={() => { setI(j); setPlay(p => p + 1); }} style={{ width: j === i ? 26 : 8, height: 8, borderRadius: 4, border: 'none', background: j === i ? TEAL : 'var(--neutral-300)', cursor: 'pointer', transition: 'all .25s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {i > 0 && (
            <button onClick={back} style={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}>
              <Icon name={ar ? 'chevron-right' : 'chevron-left'} size={22} color="var(--text-body)" />
            </button>
          )}
          <button onClick={next} style={{ flex: 1, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: TEAL, color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {i === ONB.length - 1 ? (ar ? 'ابدأ الآن' : 'Get started') : (ar ? 'التالي' : 'Next')}
            <Icon name={ar ? 'arrow-left' : 'arrow-right'} size={19} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
   LOGIN
   ==================================================================== */
function PhoneField({ lang, value, onChange }) {
  const ar = lang === 'ar';
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

function LoginScreen({ lang, setLang, onLogin, onForgot }) {
  const ar = lang === 'ar';
  const [phone, setPhone] = useStateAuth('');
  const [pw, setPw] = useStateAuth('');
  const [show, setShow] = useStateAuth(false);
  const [busy, setBusy] = useStateAuth(false);
  const [error, setError] = useStateAuth('');
  const valid = phone.length >= 10 && pw.length >= 4;
  const lbl = { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-body)', marginBottom: 8, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' };

  // Epic 1 live backend: real Supabase Auth phone+password sign-in (§10.2).
  // Guardian accounts don't exist yet (populated starting Epic 2, §3.7), so
  // this correctly fails with "invalid credentials" today — the call itself
  // is real. See EPIC_1_INTEGRATION_REPORT.md.
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
      {/* header */}
      <div style={{ padding: '46px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <MasarMark size={24} />
        <LangPill lang={lang} setLang={setLang} />
      </div>

      <div style={{ padding: '24px 26px 30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--teal-50)', display: 'grid', placeItems: 'center', marginBottom: 18 }}>
          <Icon name="user-round" size={30} color={TEAL} />
        </div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-.02em', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مرحبًا بعودتك' : 'Welcome back'}</h1>
        <p style={{ margin: '8px 0 26px', fontSize: 14.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'سجّل الدخول لمتابعة طفلك' : 'Sign in to follow your child'}</p>

        <label style={lbl}>{ar ? 'رقم الهاتف' : 'Phone number'}</label>
        <div style={{ marginBottom: 18 }}><PhoneField lang={lang} value={phone} onChange={setPhone} /></div>

        <label style={lbl}>{ar ? 'كلمة المرور' : 'Password'}</label>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder={ar ? '••••••••' : '••••••••'} style={{ width: '100%', padding: '13px 46px 13px 15px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 15, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={() => setShow(s => !s)} style={{ position: 'absolute', insetInlineEnd: 8, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <Icon name={show ? 'eye-off' : 'eye'} size={18} color="var(--text-subtle)" />
          </button>
        </div>

        <button onClick={onForgot} style={{ alignSelf: ar ? 'flex-start' : 'flex-end', background: 'none', border: 'none', color: TEAL, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 26, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'نسيت كلمة المرور؟' : 'Forgot password?'}</button>

        {error && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 16, padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)' }}>
            <Icon name="circle-alert" size={16} color="var(--danger-600)" style={{ flex: 'none', marginTop: 1 }} /><span style={{ fontSize: 12.5, color: 'var(--danger-700)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{error}</span>
          </div>
        )}

        <button onClick={submit} disabled={!valid || busy} style={{ height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: (valid && !busy) ? TEAL : 'var(--neutral-300)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: (valid && !busy) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {busy ? (ar ? 'جارٍ الدخول…' : 'Signing in…') : (ar ? 'تسجيل الدخول' : 'Sign in')}{!busy && <Icon name={ar ? 'arrow-left' : 'arrow-right'} size={19} color="#fff" />}
        </button>

        <div style={{ marginTop: 'auto', paddingTop: 24, textAlign: 'center', fontSize: 13.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
          {ar ? 'ليس لديك حساب؟ ' : "Don't have an account? "}
          <span style={{ color: TEAL, fontWeight: 700, cursor: 'pointer' }}>{ar ? 'تواصل مع حضانتك' : 'Contact your nursery'}</span>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
   FORGOT PASSWORD — phone → channel (WhatsApp/SMS) → OTP → reset
   ==================================================================== */
function OTPInput({ value, onChange, len = 4 }) {
  const refs = useRefAuth([]);
  const set = (idx, v) => {
    const d = v.replace(/[^0-9]/g, '').slice(-1);
    const arr = value.split('');
    arr[idx] = d; const next = arr.join('').slice(0, len);
    onChange(next);
    if (d && idx < len - 1 && refs.current[idx + 1]) refs.current[idx + 1].focus();
  };
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', direction: 'ltr' }}>
      {Array.from({ length: len }).map((_, i) => (
        <input key={i} ref={el => refs.current[i] = el} type="tel" inputMode="numeric" maxLength={1} value={value[i] || ''} onChange={e => set(i, e.target.value)}
          onKeyDown={e => { if (e.key === 'Backspace' && !value[i] && i > 0 && refs.current[i - 1]) refs.current[i - 1].focus(); }}
          style={{ width: 56, height: 64, textAlign: 'center', fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)', border: `1.5px solid ${value[i] ? TEAL : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-md)', color: 'var(--text-strong)', background: 'var(--surface-card)', outline: 'none' }} />
      ))}
    </div>
  );
}

function ForgotFlow({ lang, setLang, onClose, onReset }) {
  const ar = lang === 'ar';
  const [step, setStep] = useStateAuth('phone'); // phone | channel | otp | reset | done
  const [phone, setPhone] = useStateAuth('');
  const [channel, setChannel] = useStateAuth('whatsapp');
  const [otp, setOtp] = useStateAuth('');
  const [pw, setPw] = useStateAuth('');
  const [pw2, setPw2] = useStateAuth('');
  const [seconds, setSeconds] = useStateAuth(45);
  const [busy, setBusy] = useStateAuth(false);
  const [error, setError] = useStateAuth('');

  // Real Supabase phone-OTP recovery (§10.4). The WhatsApp/SMS "channel"
  // choice above stays as UI (matches the design), but actual delivery
  // routing is provider-determined once an SMS provider is configured on
  // the project — see EPIC_1_INTEGRATION_REPORT.md.
  const sendCode = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await window.MasarClient.auth.sendPhoneOtp('+20' + phone);
      setOtp('');
      setStep('otp');
    } catch (err) {
      setError(window.MasarClient.getErrorMessage(err, lang));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (otp.length !== 4 || busy) return;
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
    if (!(pw.length >= 6 && pw === pw2) || busy) return;
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

  useEffectAuth(() => {
    if (step !== 'otp') return;
    setSeconds(45);
    const t = setInterval(() => setSeconds(s => (s <= 1 ? (clearInterval(t), 0) : s - 1)), 1000);
    return () => clearInterval(t);
  }, [step]);

  const lbl = { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-body)', marginBottom: 8, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' };
  const masked = phone ? `+20 ${phone.slice(0, 2)} •••• ${phone.slice(-2)}` : '';

  const Header = ({ onBack }) => (
    <div style={{ padding: '46px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name={ar ? 'arrow-right' : 'arrow-left'} size={20} color="var(--text-body)" /></button>
      <LangPill lang={lang} setLang={setLang} />
    </div>
  );

  const pwValid = pw.length >= 6 && pw === pw2;

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* STEP: phone */}
      {step === 'phone' && (
        <React.Fragment>
          <Header onBack={onClose} />
          <div style={{ padding: '18px 26px 30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--teal-50)', display: 'grid', placeItems: 'center', marginBottom: 18 }}><Icon name="key-round" size={26} color={TEAL} /></span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'نسيت كلمة المرور؟' : 'Forgot password?'}</h1>
            <p style={{ margin: '8px 0 26px', fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.55, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'أدخل رقم هاتفك المسجّل وسنرسل لك رمز تحقق.' : "Enter your registered phone number and we'll send a verification code."}</p>
            <label style={lbl}>{ar ? 'رقم الهاتف' : 'Phone number'}</label>
            <div style={{ marginBottom: 24 }}><PhoneField lang={lang} value={phone} onChange={setPhone} /></div>
            <button onClick={() => phone.length >= 10 && setStep('channel')} disabled={phone.length < 10} style={{ height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: phone.length >= 10 ? TEAL : 'var(--neutral-300)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: phone.length >= 10 ? 'pointer' : 'not-allowed' }}>{ar ? 'متابعة' : 'Continue'}</button>
          </div>
        </React.Fragment>
      )}

      {/* STEP: channel */}
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
                <button key={o.v} onClick={() => setChannel(o.v)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 16px', marginBottom: 12, borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? TEAL : 'var(--border-subtle)'}`, background: on ? 'var(--teal-50)' : 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
                  <span style={{ width: 44, height: 44, borderRadius: '50%', background: `color-mix(in srgb, ${o.c} 14%, transparent)`, color: o.c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={o.icon} size={22} /></span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? o.ar : o.en}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? o.dA : o.dEn}</span>
                  </span>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${on ? TEAL : 'var(--border-strong)'}`, display: 'grid', placeItems: 'center', flex: 'none' }}>{on && <span style={{ width: 11, height: 11, borderRadius: '50%', background: TEAL }} />}</span>
                </button>
              );
            })}

            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 12, padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)' }}>
                <Icon name="circle-alert" size={16} color="var(--danger-600)" style={{ flex: 'none', marginTop: 1 }} /><span style={{ fontSize: 12.5, color: 'var(--danger-700)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{error}</span>
              </div>
            )}
            <button onClick={sendCode} disabled={busy} style={{ marginTop: 12, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: TEAL, opacity: busy ? 0.7 : 1, color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="send" size={18} color="#fff" />{busy ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : (ar ? 'إرسال الرمز' : 'Send code')}
            </button>
          </div>
        </React.Fragment>
      )}

      {/* STEP: otp */}
      {step === 'otp' && (
        <React.Fragment>
          <Header onBack={() => setStep('channel')} />
          <div style={{ padding: '18px 26px 30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: channel === 'whatsapp' ? 'rgba(37,211,102,.12)' : 'var(--info-50)', display: 'grid', placeItems: 'center', marginBottom: 18 }}><Icon name={channel === 'whatsapp' ? 'message-circle' : 'message-square'} size={26} color={channel === 'whatsapp' ? '#25D366' : 'var(--info-600)'} /></span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'أدخل رمز التحقق' : 'Enter the code'}</h1>
            <p style={{ margin: '8px 0 26px', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.55, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `أرسلنا رمزًا عبر ${channel === 'whatsapp' ? 'واتساب' : 'رسالة نصية'} إلى ${masked}` : `We sent a code via ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to ${masked}`}</p>

            <OTPInput value={otp} onChange={setOtp} len={4} />

            <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
              {seconds > 0
                ? (ar ? `إعادة الإرسال خلال 0:${String(seconds).padStart(2, '0')}` : `Resend in 0:${String(seconds).padStart(2, '0')}`)
                : <span onClick={() => setSeconds(45)} style={{ color: TEAL, fontWeight: 700, cursor: 'pointer' }}>{ar ? 'إعادة إرسال الرمز' : 'Resend code'}</span>}
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', border: '1px solid var(--danger-100)' }}>
                <Icon name="circle-alert" size={16} color="var(--danger-600)" style={{ flex: 'none', marginTop: 1 }} /><span style={{ fontSize: 12.5, color: 'var(--danger-700)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{error}</span>
              </div>
            )}
            <button onClick={verifyCode} disabled={otp.length < 4 || busy} style={{ marginTop: 28, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: (otp.length === 4 && !busy) ? TEAL : 'var(--neutral-300)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: (otp.length === 4 && !busy) ? 'pointer' : 'not-allowed' }}>{busy ? (ar ? 'جارٍ التحقق…' : 'Verifying…') : (ar ? 'تحقّق' : 'Verify')}</button>
          </div>
        </React.Fragment>
      )}

      {/* STEP: reset */}
      {step === 'reset' && (
        <React.Fragment>
          <Header onBack={() => setStep('otp')} />
          <div style={{ padding: '18px 26px 30px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--teal-50)', display: 'grid', placeItems: 'center', marginBottom: 18 }}><Icon name="lock-keyhole" size={26} color={TEAL} /></span>
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

            <button onClick={savePassword} disabled={!pwValid || busy} style={{ marginTop: 28, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: (pwValid && !busy) ? TEAL : 'var(--neutral-300)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: (pwValid && !busy) ? 'pointer' : 'not-allowed' }}>{busy ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ كلمة المرور' : 'Save password')}</button>
          </div>
        </React.Fragment>
      )}

      {/* STEP: done */}
      {step === 'done' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 30px', textAlign: 'center' }}>
          <span style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--success-50)', color: 'var(--success-600)', display: 'grid', placeItems: 'center', marginBottom: 22, animation: 'splashPop .5s var(--ease-out) both' }}><Icon name="circle-check-big" size={48} /></span>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تم تغيير كلمة المرور' : 'Password changed'}</h1>
          <p style={{ margin: '10px 0 30px', fontSize: 14.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.' : 'You can now sign in with your new password.'}</p>
          <button onClick={onReset} style={{ width: '100%', maxWidth: 280, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: TEAL, color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>{ar ? 'تسجيل الدخول' : 'Back to sign in'}</button>
        </div>
      )}
    </div>
  );
}

/* ====================================================================
   GATE — orchestrates the pre-app flow
   ==================================================================== */
function ParentAuthGate({ lang, setLang, onDone }) {
  const ar = lang === 'ar';
  const [stage, setStage] = useStateAuth('splash'); // splash | onboarding | login | forgot
  return (
    <div dir={ar ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0 }}>
      <style>{`
        @keyframes splashPop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
        @keyframes splashDot{0%,100%{opacity:.35;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}
        @keyframes fillTrack{from{width:0}to{width:212px}}
        @keyframes rideTrack{0%{inset-inline-start:16px}100%{inset-inline-start:228px}}
        @keyframes popStop{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}
        @keyframes bubbleIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
      `}</style>
      {stage === 'splash' && <SplashScreen lang={lang} onDone={() => setStage('onboarding')} />}
      {stage === 'onboarding' && <Onboarding lang={lang} setLang={setLang} onDone={() => setStage('login')} />}
      {stage === 'login' && <LoginScreen lang={lang} setLang={setLang} onLogin={onDone} onForgot={() => setStage('forgot')} />}
      {stage === 'forgot' && <ForgotFlow lang={lang} setLang={setLang} onClose={() => setStage('login')} onReset={() => setStage('login')} />}
    </div>
  );
}

window.ParentAuthGate = ParentAuthGate;
