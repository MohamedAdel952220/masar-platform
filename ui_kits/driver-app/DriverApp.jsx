const { useState: useStateDrv, useEffect: useEffectDrv } = React;
const BLUE = 'var(--role-driver)';
const BLUE_SOFT = '#E4EEF9';

/* ====================================================================
   Masar — Driver App (main)
   START → GPS route through stops → per-child pickup (parent notified)
   → ARRIVE at nursery (all parents notified). AM pickup / PM drop-off.
   ==================================================================== */

const DRIVER = { name: 'Tarek Saeed', nameAr: 'طارق سعيد', phone: '+20 10 9876 5432' };
const BUS = { no: '3', noAr: '٣', plate: '4281', plateAr: '٤٢٨١', seats: 14 };

/* Students on this bus, in route order. xy = position on the mini-map (0–250 / 0–210). */
const STUDENTS = [
  { id: 1, name: 'Yousef Adel', nameAr: 'يوسف عادل', parent: 'Adel Mostafa', parentAr: 'عادل مصطفى', phone: '+20 10 1234 5678', addr: '12 Tahrir St., Dokki', addrAr: '١٢ ش التحرير، الدقي', xy: [30, 170] },
  { id: 2, name: 'Lina Adel', nameAr: 'لينا عادل', parent: 'Adel Mostafa', parentAr: 'عادل مصطفى', phone: '+20 10 1234 5678', addr: '12 Tahrir St., Dokki', addrAr: '١٢ ش التحرير، الدقي', xy: [30, 170] },
  { id: 3, name: 'Malak Tarek', nameAr: 'ملك طارق', parent: 'Tarek Hassan', parentAr: 'طارق حسن', phone: '+20 11 2345 6789', addr: '5 Nile Ave., Giza', addrAr: '٥ ش النيل، الجيزة', xy: [70, 64] },
  { id: 4, name: 'Omar Khaled', nameAr: 'عمر خالد', parent: 'Khaled Sami', parentAr: 'خالد سامي', phone: '+20 12 3456 7890', addr: '22 Mossadak St.', addrAr: '٢٢ ش مصدق', xy: [150, 64] },
  { id: 5, name: 'Jana Mostafa', nameAr: 'جنى مصطفى', parent: 'Mostafa Ali', parentAr: 'مصطفى علي', phone: '+20 10 4567 8901', addr: '8 Hegaz St., Mohandessin', addrAr: '٨ ش الحجاز، المهندسين', xy: [200, 120] },
  { id: 6, name: 'Ali Hossam', nameAr: 'علي حسام', parent: 'Hossam Adel', parentAr: 'حسام عادل', phone: '+20 11 5678 9012', addr: '3 Lebanon Sq.', addrAr: '٣ ميدان لبنان', xy: [212, 168] },
];
const NURSERY = { name: 'Sunrise Nursery', nameAr: 'حضانة الشروق', xy: [225, 120] };

/* Map route path connecting the stops in order, then to nursery */
const ROUTE = 'M30 170 L70 132 L70 64 L150 64 L150 100 L200 120 L212 168 L225 120';

/* ---------------- Shell ---------------- */
function DTopBar({ lang, setLang, profile, onProfile, onBell, unread }) {
  const ar = lang === 'ar';
  return (
    <div style={{ padding: '42px 18px 14px', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <button onClick={onProfile} style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'start' }}>
        <Avatar name={profile.name} src={profile.photo} size={42} status="present" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? profile.nameAr : profile.name}</div>
          <div style={{ marginTop: 3 }}><Badge tone="info" solid style={{ height: 20, background: BLUE }}>{ar ? `باص ${BUS.noAr}` : `Bus ${BUS.no}`} · {ar ? 'سائق' : 'Driver'}</Badge></div>
        </div>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setLang(ar ? 'en' : 'ar')} style={{ height: 34, padding: '0 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>{ar ? 'EN' : 'ع'}</button>
        <button onClick={onBell} style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <Icon name="bell" size={18} color="var(--text-body)" />
          {unread && <span style={{ position: 'absolute', top: 7, insetInlineEnd: 8, width: 8, height: 8, borderRadius: '50%', background: 'var(--amber-500)', boxShadow: '0 0 0 2px var(--surface-card)' }} />}
        </button>
      </div>
    </div>
  );
}

function DBottomNav({ lang, tab, setTab }) {
  const ar = lang === 'ar';
  const items = [
    { k: 'trip', icon: 'route', en: 'Trip', a: 'الرحلة' },
    { k: 'students', icon: 'users', en: 'Students', a: 'الطلاب' },
    { k: 'history', icon: 'history', en: 'History', a: 'السجل' },
    { k: 'settings', icon: 'settings', en: 'Settings', a: 'الإعدادات' },
  ];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 4px 26px', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)' }}>
      {items.map(it => {
        const on = tab === it.k;
        return (
          <button key={it.k} onClick={() => setTab(it.k)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', minWidth: 64 }}>
            <Icon name={it.icon} size={22} color={on ? BLUE : 'var(--text-subtle)'} strokeWidth={on ? 2.4 : 2} />
            <span style={{ fontSize: 11, fontWeight: on ? 700 : 600, color: on ? BLUE : 'var(--text-subtle)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? it.a : it.en}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Route map ---------------- */
function DriverMap({ lang, leg, students, doneIds, started, currentIdx }) {
  const ar = lang === 'ar';
  // Bus progresses along the route based on how many done
  const total = students.length;
  const progress = started ? Math.min(1, (doneIds.length) / total) : 0;
  return (
    <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ position: 'relative', height: 280 }}>
        <svg width="100%" height="100%" viewBox="0 0 250 210" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
          <rect width="250" height="210" fill="#E9EEE8" />
          <rect x="12" y="10" width="60" height="40" rx="6" fill="#D7E5D4" />
          <rect x="158" y="120" width="84" height="74" rx="6" fill="#D7E5D4" />
          <rect x="95" y="14" width="48" height="34" rx="5" fill="#E6E2D6" />
          <rect x="20" y="120" width="50" height="40" rx="5" fill="#E6E2D6" />
          <g stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round">
            <line x1="-5" y1="64" x2="255" y2="64" /><line x1="-5" y1="132" x2="255" y2="132" />
            <line x1="70" y1="-5" x2="70" y2="215" /><line x1="150" y1="-5" x2="150" y2="215" /><line x1="212" y1="-5" x2="212" y2="215" />
          </g>
          <path d={ROUTE} fill="none" stroke={BLUE} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={ROUTE} fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="1 10" opacity="0.8" />
        </svg>

        {/* student stop pins */}
        {students.map((s, i) => {
          // group duplicate addresses (siblings) by xy — show once
          const firstAtXY = students.findIndex(o => o.xy[0] === s.xy[0] && o.xy[1] === s.xy[1]) === i;
          if (!firstAtXY) return null;
          const done = doneIds.includes(s.id);
          const isCurrent = started && i === currentIdx && !done;
          const [x, y] = s.xy;
          return (
            <span key={s.id} style={{ position: 'absolute', left: `${x / 250 * 100}%`, top: `${y / 210 * 100}%`, transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ width: isCurrent ? 32 : 26, height: isCurrent ? 32 : 26, borderRadius: '50% 50% 50% 2px', transform: 'rotate(-45deg)', background: done ? 'var(--success-500)' : isCurrent ? 'var(--amber-500)' : BLUE, color: done || !isCurrent ? '#fff' : '#1C1C1A', display: 'grid', placeItems: 'center', boxShadow: isCurrent ? '0 0 0 5px rgba(239,159,39,.25)' : 'var(--shadow-sm)', border: '2px solid #fff' }}>
                <span style={{ transform: 'rotate(45deg)', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{done ? <Icon name="check" size={14} color="#fff" /> : (i + 1)}</span>
              </span>
            </span>
          );
        })}

        {/* nursery pin */}
        <span style={{ position: 'absolute', left: `${NURSERY.xy[0] / 250 * 100}%`, top: `${NURSERY.xy[1] / 210 * 100}%`, transform: 'translate(-50%,-50%)' }}>
          <Icon name="school" size={26} color="var(--teal-700)" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.25))' }} />
        </span>

        {/* moving bus */}
        <span style={{ position: 'absolute', width: 38, height: 38, borderRadius: '50%', background: 'var(--amber-500)', display: 'grid', placeItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.25), 0 0 0 6px rgba(239,159,39,.22)', offsetPath: `path('${ROUTE}')`, offsetDistance: `${progress * 100}%`, transition: 'offset-distance 1s var(--ease-out)' }}>
          <Icon name="bus" size={19} color="#1C1C1A" />
        </span>

        {/* live chip */}
        {started && (
          <span style={{ position: 'absolute', top: 10, insetInlineStart: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'rgba(255,255,255,.92)', boxShadow: 'var(--shadow-sm)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--amber-500)', animation: 'dblink 1.4s infinite' }} />
            <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مباشر' : 'LIVE'}</span>
          </span>
        )}
        {/* leg chip */}
        <span style={{ position: 'absolute', top: 10, insetInlineEnd: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 'var(--radius-pill)', background: 'rgba(255,255,255,.92)', boxShadow: 'var(--shadow-sm)' }}>
          <Icon name={leg === 'am' ? 'sunrise' : 'sunset'} size={13} color={BLUE} />
          <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{leg === 'am' ? (ar ? 'صباحًا' : 'AM') : (ar ? 'ظهرًا' : 'PM')}</span>
        </span>
      </div>
    </div>
  );
}

/* ---------------- Trip screen ---------------- */
function TripScreen({ lang, leg, setLeg, started, setStarted, doneIds, setDoneIds, pushNotif, isOnline }) {
  const ar = lang === 'ar';
  const amVerb = leg === 'am';
  const pickWord = amVerb ? (ar ? 'استلام' : 'Pick up') : (ar ? 'تسليم' : 'Drop off');
  const pickedWord = amVerb ? (ar ? 'تم الاستلام' : 'Picked up') : (ar ? 'تم التسليم' : 'Dropped off');
  const students = STUDENTS;
  const total = students.length;
  const remaining = students.filter(s => !doneIds.includes(s.id));
  const currentIdx = students.findIndex(s => !doneIds.includes(s.id));
  const current = remaining[0];
  const allDone = doneIds.length === total;
  const [arrived, setArrived] = useStateDrv(false);
  // C3 fix: a confirm step (with the child's photo/name) before the irreversible
  // parent notification fires, plus a short Undo window right after — no more
  // single mis-tap telling a parent their child is on/off the bus incorrectly.
  const [confirmStudent, setConfirmStudent] = useStateDrv(null);
  const [undo, setUndo] = useStateDrv(null); // { id, name }

  const start = () => {
    setStarted(true);
    pushNotif(amVerb
      ? { titleEn: 'Driver on the way', titleAr: 'السائق في الطريق', msgEn: 'Bus 3 has started the morning route.', msgAr: 'بدأ باص ٣ رحلة الصباح.' }
      : { titleEn: 'Heading home', titleAr: 'في الطريق إلى المنزل', msgEn: 'Bus 3 has started the afternoon route.', msgAr: 'بدأ باص ٣ رحلة العودة.' });
  };

  const doStudent = (s) => {
    const next = [...doneIds, s.id];
    setDoneIds(next);
    pushNotif({
      titleEn: `${s.name.split(' ')[0]} ${amVerb ? 'picked up' : 'dropped home'}`,
      titleAr: `${amVerb ? 'تم استلام' : 'تم توصيل'} ${s.nameAr.split(' ')[0]}`,
      msgEn: amVerb ? `Handed to the bus by family — on the way to nursery.` : `Delivered home and handed to family.`,
      msgAr: amVerb ? 'تم تسليمه للباص من العائلة — في الطريق إلى الحضانة.' : 'تم توصيله للمنزل وتسليمه للعائلة.',
      to: s.parent,
    }, s);
    setConfirmStudent(null);
    setUndo({ id: s.id, name: ar ? s.nameAr.split(' ')[0] : s.name.split(' ')[0] });
  };

  const undoLast = () => {
    if (!undo) return;
    setDoneIds(prev => prev.filter(id => id !== undo.id));
    pushNotif({
      titleEn: `${undo.name} — correction`, titleAr: `${undo.name} — تصحيح`,
      msgEn: `The previous update for ${undo.name} was undone by the driver.`,
      msgAr: `تم التراجع عن آخر تحديث لـ${undo.name} بواسطة السائق.`,
    });
    setUndo(null);
  };

  const arrive = () => {
    setArrived(true);
    pushNotif(amVerb
      ? { titleEn: 'All children arrived safely', titleAr: 'وصل جميع الأطفال بأمان', msgEn: `All ${total} children reached ${NURSERY.name} safely.`, msgAr: `وصل كل الأطفال (${total}) إلى ${NURSERY.nameAr} بأمان.`, big: true }
      : { titleEn: 'Route complete', titleAr: 'اكتملت الرحلة', msgEn: `All ${total} children delivered home safely.`, msgAr: `تم توصيل كل الأطفال (${total}) إلى منازلهم بأمان.`, big: true });
  };

  const reset = () => { setStarted(false); setDoneIds([]); setArrived(false); };

  return (
    <div style={{ padding: '16px 18px 20px' }}>
      {/* leg toggle */}
      <div style={{ display: 'flex', gap: 8, background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', padding: 4, marginBottom: 14 }}>
        {[['am', ar ? 'رحلة الصباح' : 'Morning pickup', 'sunrise'], ['pm', ar ? 'رحلة العودة' : 'Afternoon drop-off', 'sunset']].map(([v, label, ic]) => {
          const on = leg === v;
          return (
            <button key={v} disabled={started} onClick={() => setLeg(v)} style={{ flex: 1, height: 42, borderRadius: 'var(--radius-sm)', border: 'none', background: on ? 'var(--surface-card)' : 'transparent', boxShadow: on ? 'var(--shadow-sm)' : 'none', color: on ? BLUE : 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 13, fontWeight: 800, cursor: started ? 'not-allowed' : 'pointer', opacity: started && !on ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name={ic} size={16} />{label}
            </button>
          );
        })}
      </div>

      <DriverMap lang={lang} leg={leg} students={students} doneIds={doneIds} started={started} currentIdx={currentIdx} />

      {/* progress strip */}
      <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{amVerb ? (ar ? 'تم استلامهم' : 'Picked up') : (ar ? 'تم توصيلهم' : 'Dropped off')}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: BLUE, fontVariantNumeric: 'tabular-nums' }}>{doneIds.length}<span style={{ color: 'var(--text-subtle)' }}>/{total}</span></span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {students.map((s, i) => (
            <span key={s.id} style={{ flex: 1, height: 7, borderRadius: 'var(--radius-pill)', background: doneIds.includes(s.id) ? 'var(--success-500)' : 'var(--neutral-200)' }} />
          ))}
        </div>
      </div>

      {/* main action */}
      {!started ? (
        <button onClick={start} style={{ marginTop: 16, width: '100%', height: 60, borderRadius: 'var(--radius-pill)', border: 'none', background: BLUE, color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 18, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 22px -8px rgba(45,108,181,.6)' }}>
          <Icon name="play" size={22} color="#fff" />{ar ? 'ابدأ الرحلة' : 'Start trip'}
        </button>
      ) : allDone ? (
        arrived ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ padding: '20px', borderRadius: 'var(--radius-lg)', background: 'var(--success-50)', border: '1px solid var(--success-100)', textAlign: 'center' }}>
              <span style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--surface-card)', color: 'var(--success-600)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}><Icon name="check-check" size={32} /></span>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--success-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{amVerb ? (ar ? 'وصل الجميع بأمان' : 'Everyone arrived safely') : (ar ? 'اكتملت الرحلة' : 'Route complete')}</div>
              <div style={{ fontSize: 13, color: 'var(--success-700)', marginTop: 4, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تم إشعار جميع الأهل' : 'All parents have been notified'}</div>
            </div>
            <Button variant="secondary" fullWidth style={{ marginTop: 12 }} iconLeft={<Icon name="rotate-ccw" size={17} />} onClick={reset}>{ar ? 'رحلة جديدة' : 'New trip'}</Button>
          </div>
        ) : (
          <button onClick={arrive} style={{ marginTop: 16, width: '100%', height: 60, borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--success-500)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 18, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 22px -8px rgba(31,138,91,.6)' }}>
            <Icon name={amVerb ? 'school' : 'flag'} size={22} color="#fff" />{amVerb ? (ar ? 'تأكيد الوصول للحضانة' : 'Confirm arrival at nursery') : (ar ? 'إنهاء الرحلة' : 'Finish route')}
          </button>
        )
      ) : (
        <div style={{ marginTop: 16 }}>
          {/* current stop card */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, paddingInlineStart: 4 }}>{ar ? 'المحطة الحالية' : 'Current stop'} · {currentIdx + 1}/{total}</div>
          <Card padding="md" accent="var(--amber-500)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={current.name} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? current.nameAr : current.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}><Icon name="map-pin" size={13} color="var(--text-subtle)" />{ar ? current.addrAr : current.addr}</div>
              </div>
              <a href={`tel:${current.phone}`} style={{ width: 44, height: 44, borderRadius: '50%', background: BLUE_SOFT, color: BLUE, display: 'grid', placeItems: 'center', flex: 'none', textDecoration: 'none' }}><Icon name="phone" size={20} /></a>
            </div>
            <button onClick={() => setConfirmStudent(current)} style={{ marginTop: 14, width: '100%', height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: BLUE, color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
              <Icon name="hand" size={19} color="#fff" />{pickWord} · {ar ? current.nameAr.split(' ')[0] : current.name.split(' ')[0]}
            </button>
          </Card>

          {/* upcoming */}
          {remaining.length > 1 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, paddingInlineStart: 4 }}>{ar ? 'المحطات القادمة' : 'Upcoming stops'}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {remaining.slice(1).map((s) => {
                  const idx = students.findIndex(o => o.id === s.id);
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--neutral-200)', color: 'var(--text-muted)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, flex: 'none' }}>{idx + 1}</span>
                      <Avatar name={s.name} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? s.nameAr : s.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? s.addrAr : s.addr}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {confirmStudent && (
        <ConfirmDialog icon="hand" tone="amber" title={`${pickWord} ${ar ? confirmStudent.nameAr : confirmStudent.name}?`}
          message={ar ? `سيتم إشعار ${confirmStudent.parentAr} فورًا. تأكد أن هذا هو الطفل الصحيح عند هذه المحطة قبل المتابعة.` : `${confirmStudent.parent} will be notified immediately. Make sure this is the right child at this stop before continuing.`}
          confirmLabel={pickWord} onConfirm={() => doStudent(confirmStudent)} onClose={() => setConfirmStudent(null)} />
      )}
      {undo && (
        <Toast icon="check" tone="success" message={ar ? `تم تأكيد ${undo.name}` : `Confirmed ${undo.name}`}
          actionLabel={ar ? 'تراجع' : 'Undo'} onAction={undoLast} duration={6000} onDone={() => setUndo(null)} />
      )}
    </div>
  );
}

/* ---------------- Students manifest ---------------- */
function StudentsScreen({ lang, doneIds, leg }) {
  const ar = lang === 'ar';
  const amVerb = leg === 'am';
  return (
    <div style={{ padding: '16px 18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', borderRadius: 'var(--radius-lg)', background: BLUE_SOFT, border: '1px solid color-mix(in srgb, var(--role-driver) 18%, transparent)', marginBottom: 16 }}>
        <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-card)', color: BLUE, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="bus" size={21} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `باص ${BUS.noAr} · ${STUDENTS.length} طلاب` : `Bus ${BUS.no} · ${STUDENTS.length} students`}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `لوحة ${BUS.plateAr}` : `Plate ${BUS.plate}`}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {STUDENTS.map((s, i) => {
          const done = doneIds.includes(s.id);
          return (
            <Card key={s.id} padding="sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: done ? 'var(--success-50)' : 'var(--neutral-200)', color: done ? 'var(--success-600)' : 'var(--text-muted)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, flex: 'none' }}>{done ? <Icon name="check" size={14} /> : (i + 1)}</span>
              <Avatar name={s.name} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? s.nameAr : s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? s.addrAr : s.addr}</div>
              </div>
              {done
                ? <Badge tone="success" dot>{amVerb ? (ar ? 'مُستلَم' : 'Picked') : (ar ? 'وُصِّل' : 'Dropped')}</Badge>
                : <a href={`tel:${s.phone}`} style={{ width: 38, height: 38, borderRadius: '50%', background: BLUE_SOFT, color: BLUE, display: 'grid', placeItems: 'center', flex: 'none', textDecoration: 'none' }}><Icon name="phone" size={17} /></a>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- History ---------------- */
function HistoryScreen({ lang }) {
  const ar = lang === 'ar';
  const trips = [
    { date: ar ? 'اليوم · الصباح' : 'Today · Morning', n: 6, status: 'done', t: '7:08 – 7:42' },
    { date: ar ? 'أمس · العودة' : 'Yesterday · Afternoon', n: 6, status: 'done', t: '1:40 – 2:26' },
    { date: ar ? 'أمس · الصباح' : 'Yesterday · Morning', n: 6, status: 'done', t: '7:05 – 7:40' },
    { date: ar ? 'الإثنين · العودة' : 'Mon · Afternoon', n: 5, status: 'done', t: '1:38 – 2:20' },
  ];
  return (
    <div style={{ padding: '16px 18px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatCard label={ar ? 'رحلات اليوم' : 'Trips today'} value={1} accent={BLUE} icon={<Icon name="route" size={15} />} />
        <StatCard label={ar ? 'هذا الأسبوع' : 'This week'} value={9} accent="var(--teal-600)" icon={<Icon name="calendar-check" size={15} />} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, paddingInlineStart: 4 }}>{ar ? 'الرحلات السابقة' : 'Past trips'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {trips.map((t, i) => (
          <Card key={i} padding="sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--success-50)', color: 'var(--success-600)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="check-check" size={20} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{t.date}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{t.t}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>{t.n}</div>
              <div style={{ fontSize: 10, color: 'var(--text-subtle)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'طلاب' : 'students'}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Notifications panel ---------------- */
function DNotifPanel({ lang, items, onClose }) {
  const ar = lang === 'ar';
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', width: '100%', borderRadius: '28px 28px 0 0', padding: '10px 18px 28px', maxHeight: '80%', overflowY: 'auto', animation: 'sheet .3s var(--ease-out)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 14px' }} />
        <h3 style={{ margin: '0 0 14px 4px', fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'سجل الإشعارات المرسلة' : 'Sent notifications'}</h3>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-subtle)', fontSize: 13.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'لا توجد إشعارات بعد' : 'No notifications sent yet'}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: 11, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: n.big ? 'var(--success-50)' : 'var(--surface-raised)', border: `1px solid ${n.big ? 'var(--success-100)' : 'var(--border-subtle)'}` }}>
                <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-card)', color: n.big ? 'var(--success-600)' : BLUE, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={n.big ? 'check-check' : 'bell-ring'} size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? n.titleAr : n.titleEn}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? n.msgAr : n.msgEn}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 3, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{n.to ? (ar ? `إلى: ${n.to}` : `To: ${n.to}`) : (ar ? 'إلى جميع الأهل' : 'To all parents')}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- App ---------------- */
const D_TITLES = {
  trip: { en: 'Today’s Trip', ar: 'رحلة اليوم' }, students: { en: 'Students', ar: 'الطلاب' },
  history: { en: 'History', ar: 'السجل' }, settings: { en: 'Settings', ar: 'الإعدادات' },
};

function DriverApp() {
  const [lang, setLang] = useStateDrv('en');
  const [authed, setAuthed] = useStateDrv(false);
  const [tab, setTab] = useStateDrv('trip');
  const [leg, setLeg] = useStateDrv('am');
  const [started, setStarted] = useStateDrv(false);
  const [doneIds, setDoneIds] = useStateDrv([]);
  const [notifs, setNotifs] = useStateDrv([]);
  const [showNotif, setShowNotif] = useStateDrv(false);
  const [showAbout, setShowAbout] = useStateDrv(false);
  const [profile, setProfile] = useStateDrv({ name: DRIVER.name, nameAr: DRIVER.nameAr, phone: DRIVER.phone, photo: null });
  const [isOnline, setIsOnline] = useStateDrv(typeof navigator === 'undefined' || navigator.onLine !== false);
  const [pendingSync, setPendingSync] = useStateDrv([]); // notifications waiting to reach parents once back online
  const ar = lang === 'ar';

  const pushNotif = (n) => setNotifs(prev => [n, ...prev]);
  // Every parent-facing notification goes through here: sent immediately while
  // online, queued (and clearly surfaced as queued) while offline, and flushed
  // the moment connectivity returns — so a pickup confirmed with no signal is
  // never silently lost.
  const sendOrQueue = (n) => { if (isOnline) pushNotif(n); else setPendingSync(prev => [...prev, n]); };

  useEffectDrv(() => {
    const goOnline = () => {
      setIsOnline(true);
      setPendingSync(prev => { prev.forEach(n => pushNotif(n)); return []; });
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  if (!authed) {
    return <window.DriverAuthGate lang={lang} setLang={setLang} onDone={() => setAuthed(true)} />;
  }

  return (
    <div dir={ar ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <style>{`
        @keyframes sheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes dblink{0%,100%{opacity:1}50%{opacity:.25}}
        .scroll::-webkit-scrollbar{width:0}
      `}</style>

      <DTopBar lang={lang} setLang={setLang} profile={profile} onProfile={() => setTab('settings')} onBell={() => setShowNotif(true)} unread={notifs.length > 0} />

      {(!isOnline || pendingSync.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 18px', background: isOnline ? 'var(--amber-50)' : 'var(--danger-50)', borderBottom: `1px solid ${isOnline ? 'var(--amber-200)' : 'var(--danger-200)'}` }}>
          <Icon name={isOnline ? 'loader' : 'wifi-off'} size={16} color={isOnline ? 'var(--amber-700)' : 'var(--danger-600)'} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: isOnline ? 'var(--amber-800)' : 'var(--danger-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
            {isOnline
              ? (ar ? `جارٍ المزامنة… ${pendingSync.length} إشعار` : `Syncing… ${pendingSync.length} update${pendingSync.length > 1 ? 's' : ''}`)
              : (ar ? `لا يوجد اتصال — ${pendingSync.length} إشعار في الانتظار` : `No connection — ${pendingSync.length} update${pendingSync.length !== 1 ? 's' : ''} waiting to send`)}
          </span>
        </div>
      )}

      {tab !== 'settings' && (
        <div style={{ padding: '12px 18px 4px', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? D_TITLES[tab].ar : D_TITLES[tab].en}</h2>
        </div>
      )}

      <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'trip' && <TripScreen lang={lang} leg={leg} setLeg={setLeg} started={started} setStarted={setStarted} doneIds={doneIds} setDoneIds={setDoneIds} pushNotif={sendOrQueue} isOnline={isOnline} />}
        {tab === 'students' && <StudentsScreen lang={lang} doneIds={doneIds} leg={leg} />}
        {tab === 'history' && <HistoryScreen lang={lang} />}
        {tab === 'settings' && <window.DriverSettingsScreen lang={lang} setLang={setLang} profile={profile} setProfile={setProfile} onAbout={() => setShowAbout(true)} onLogout={() => { window.MasarClient.auth.signOut().catch(() => {}); setAuthed(false); setTab('trip'); setStarted(false); setDoneIds([]); }} />}
      </div>

      <DBottomNav lang={lang} tab={tab} setTab={setTab} />

      {showNotif && <DNotifPanel lang={lang} items={notifs} onClose={() => setShowNotif(false)} />}
      {showAbout && <window.DriverAboutScreen lang={lang} onBack={() => setShowAbout(false)} />}
    </div>
  );
}
window.DriverApp = DriverApp;
