const { useState: useStateRcp } = React;
const TERR = 'var(--role-supervisor)';
const TERR_SOFT = '#F6E7DC';

/* ====================================================================
   Masar — Reception App (main)
   QR scan → verify authorized pickup → confirm handover to person.
   Bus arrival: count children off bus → confirm → parents notified.
   Bus departure: count children handed to driver → confirm → notified.
   ==================================================================== */

const RECEPTIONIST = { name: 'Mona Adel', nameAr: 'منى عادل', phone: '+20 10 5544 3322' };
const NURSERY_R = { name: 'Sunrise Nursery', nameAr: 'حضانة الشروق' };

/* Pickup passes that could be scanned (simulated scan picks one).
   `result` mirrors the backend's four distinct scan outcomes — collapsing
   these into one generic valid/invalid was the Critical gap fixed here:
   a revoked pass (custody dispute, fired nanny, restraining order) must
   never look the same as one that simply expired or was never issued. */
const PASSES = [
  { id: 'p1', result: 'valid', person: 'Mohamed Adel', personAr: 'محمد عادل', relation: 'Father', relationAr: 'الأب', child: 'Yousef Adel', childAr: 'يوسف عادل', classroom: 'Sunflower', classroomAr: 'دوّار الشمس', parent: 'Adel Mostafa', parentAr: 'عادل مصطفى', idNo: '2880…4417', photo: null },
  { id: 'p2', result: 'valid', person: 'Hala Nabil', personAr: 'هالة نبيل', relation: 'Aunt', relationAr: 'الخالة', child: 'Lina Adel', childAr: 'لينا عادل', classroom: 'Tulip', classroomAr: 'التوليب', parent: 'Adel Mostafa', parentAr: 'عادل مصطفى', idNo: '2911…7732', photo: null },
  { id: 'p3', result: 'invalid_unknown', person: 'Unknown card', personAr: 'بطاقة غير معروفة', relation: '', relationAr: '', child: '', childAr: '', classroom: '', classroomAr: '', parent: '', parentAr: '', idNo: '—', photo: null },
  { id: 'p4', result: 'invalid_expired', person: 'Sara Fathy', personAr: 'سارة فتحي', relation: 'Grandmother', relationAr: 'الجدة', child: 'Omar Khaled', childAr: 'عمر خالد', classroom: 'Daisy', classroomAr: 'الأقحوان', parent: 'Khaled Sami', parentAr: 'خالد سامي', idNo: '2765…1290', photo: null },
  { id: 'p5', result: 'invalid_revoked', person: 'Ibrahim Nasr', personAr: 'إبراهيم نصر', relation: 'Driver (private)', relationAr: 'سائق خاص', child: 'Jana Mostafa', childAr: 'جنى مصطفى', classroom: 'Tulip', classroomAr: 'التوليب', parent: 'Mostafa Ali', parentAr: 'مصطفى علي', idNo: '3012…5588', photo: null },
];

const BUS_CHILDREN = [
  { id: 1, name: 'Yousef Adel', nameAr: 'يوسف عادل' },
  { id: 2, name: 'Lina Adel', nameAr: 'لينا عادل' },
  { id: 3, name: 'Malak Tarek', nameAr: 'ملك طارق' },
  { id: 4, name: 'Omar Khaled', nameAr: 'عمر خالد' },
  { id: 5, name: 'Jana Mostafa', nameAr: 'جنى مصطفى' },
  { id: 6, name: 'Ali Hossam', nameAr: 'علي حسام' },
];

/* Reception commonly serves more than one bus — C6 fix: a bus picker is
   required before confirming, so "Select all" can never silently target
   the wrong bus's roster. */
const BUSES_R = [
  { id: 'b3', no: '3', noAr: '٣', driver: 'Mr. Tarek', driverAr: 'الكابتن طارق', children: BUS_CHILDREN },
  { id: 'b5', no: '5', noAr: '٥', driver: 'Mr. Amr', driverAr: 'الكابتن عمرو', children: [
    { id: 7, name: 'Nour Sami', nameAr: 'نور سامي' },
    { id: 8, name: 'Kamal Reda', nameAr: 'كمال رضا' },
    { id: 9, name: 'Salma Hany', nameAr: 'سلمى هاني' },
  ] },
];

/* ---------------- QR mini ---------------- */
function QRMini({ seed = 5, size = 150 }) {
  const n = 21; const cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const finder = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    const on = finder
      ? ((x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) || (x >= n - 7 && (x === n - 7 || x === n - 1)) || (y >= n - 7 && (y === n - 7 || y === n - 1)))
      : (((x * 7 + y * 13 + x * y + seed * 3) % 3 === 0));
    if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#1C1C1A" />);
  }
  return <svg viewBox="0 0 21 21" width={size} height={size} shapeRendering="crispEdges">{cells}</svg>;
}

/* ---------------- Shell ---------------- */
function RTopBar({ lang, setLang, profile, onProfile, onBell, unread }) {
  const ar = lang === 'ar';
  return (
    <div style={{ padding: '42px 18px 14px', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <button onClick={onProfile} style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'start' }}>
        <Avatar name={profile.name} src={profile.photo} size={42} status="present" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? profile.nameAr : profile.name}</div>
          <div style={{ marginTop: 3 }}><Badge tone="amber" solid style={{ height: 20, background: TERR, color: '#fff' }}>{ar ? 'استقبال' : 'Reception'}</Badge></div>
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

function RBottomNav({ lang, tab, setTab }) {
  const ar = lang === 'ar';
  const items = [
    { k: 'home', icon: 'layout-grid', en: 'Home', a: 'الرئيسية' },
    { k: 'scan', icon: 'scan-line', en: 'Scan', a: 'مسح' },
    { k: 'bus', icon: 'bus', en: 'Bus', a: 'الباص' },
    { k: 'log', icon: 'history', en: 'Log', a: 'السجل' },
    { k: 'settings', icon: 'settings', en: 'Settings', a: 'الإعدادات' },
  ];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 2px 26px', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)' }}>
      {items.map(it => {
        const on = tab === it.k;
        if (it.k === 'scan') {
          return (
            <button key={it.k} onClick={() => setTab(it.k)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px', minWidth: 58 }}>
              <span style={{ width: 50, height: 50, borderRadius: '50%', background: TERR, display: 'grid', placeItems: 'center', marginTop: -16, boxShadow: '0 6px 16px -4px rgba(194,98,46,.6)', border: '3px solid var(--surface-card)' }}><Icon name="scan-line" size={24} color="#fff" /></span>
              <span style={{ fontSize: 11, fontWeight: on ? 700 : 600, color: on ? TERR : 'var(--text-subtle)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? it.a : it.en}</span>
            </button>
          );
        }
        return (
          <button key={it.k} onClick={() => setTab(it.k)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', minWidth: 58 }}>
            <Icon name={it.icon} size={22} color={on ? TERR : 'var(--text-subtle)'} strokeWidth={on ? 2.4 : 2} />
            <span style={{ fontSize: 11, fontWeight: on ? 700 : 600, color: on ? TERR : 'var(--text-subtle)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? it.a : it.en}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Home dashboard ---------------- */
function RHomeScreen({ lang, onScan, onBus, log }) {
  const ar = lang === 'ar';
  return (
    <div style={{ padding: '16px 18px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard label={ar ? 'تم الاستلام اليوم' : 'Picked up today'} value={log.filter(l => l.type === 'pickup').length} accent={TERR} icon={<Icon name="badge-check" size={15} />} />
        <StatCard label={ar ? 'في الحضانة' : 'On site'} value={24} accent="var(--teal-600)" icon={<Icon name="users" size={15} />} />
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Scan CTA */}
        <button onClick={onScan} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px', borderRadius: 'var(--radius-lg)', background: TERR, border: 'none', cursor: 'pointer', textAlign: 'start', boxShadow: '0 8px 22px -10px rgba(194,98,46,.6)' }}>
          <span style={{ width: 50, height: 50, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,.2)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="scan-line" size={26} color="#fff" /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مسح كود الاستلام' : 'Scan pickup QR'}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.85)', marginTop: 2, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تحقّق من هوية من يستلم الطفل' : "Verify who's collecting the child"}</div>
          </div>
          <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={22} color="#fff" />
        </button>

        {/* Bus CTA */}
        <button onClick={onBus} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', cursor: 'pointer', textAlign: 'start', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ width: 50, height: 50, borderRadius: 'var(--radius-md)', background: TERR_SOFT, color: TERR, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="bus" size={26} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تأكيد الباص' : 'Confirm the bus'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'عُدّ الأطفال عند الوصول أو المغادرة' : 'Count children on arrival or departure'}</div>
          </div>
          <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={22} color="var(--text-subtle)" />
        </button>
      </div>

      {/* recent */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '22px 0 10px', paddingInlineStart: 4 }}>{ar ? 'آخر العمليات' : 'Recent activity'}</div>
      {log.length === 0 ? (
        <Card padding="lg" style={{ textAlign: 'center' }}>
          <Icon name="inbox" size={28} color="var(--text-subtle)" />
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'لا توجد عمليات بعد اليوم' : 'No activity yet today'}</div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {log.slice(0, 5).map((l, i) => <LogRow key={i} l={l} ar={ar} />)}
        </div>
      )}
    </div>
  );
}

function LogRow({ l, ar }) {
  const icon = l.type === 'pickup' ? 'badge-check' : l.type === 'alert' ? 'siren' : 'bus';
  const color = l.type === 'pickup' ? TERR : l.type === 'alert' ? 'var(--danger-600)' : 'var(--teal-600)';
  return (
    <Card padding="sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 38, height: 38, borderRadius: '50%', background: `color-mix(in srgb, ${color} 12%, transparent)`, color, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={18} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? l.titleAr : l.titleEn}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? l.subAr : l.subEn}</div>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', flex: 'none' }}>{l.time}</span>
    </Card>
  );
}

/* Per-result copy for the three invalid outcomes — kept apart deliberately
   so a revoked pass never shares wording (or urgency) with a merely-expired
   or unrecognized one. */
const SCAN_RESULT_META = {
  invalid_expired: {
    icon: 'clock-alert', tone: 'amber',
    titleEn: 'Code expired', titleAr: 'انتهت صلاحية الكود',
    bodyEn: 'This pass has expired. Do not hand over the child — ask the parent to generate a new pass in the app.',
    bodyAr: 'انتهت صلاحية هذا التصريح. لا تُسلّم الطفل — اطلب من ولي الأمر إنشاء تصريح جديد من التطبيق.',
  },
  invalid_unknown: {
    icon: 'help-circle', tone: 'danger',
    titleEn: 'Code not recognized', titleAr: 'كود غير معروف',
    bodyEn: "This code doesn't match any pass on file. Do not hand over the child — verify identity manually and contact the parent.",
    bodyAr: 'هذا الكود لا يطابق أي تصريح مسجّل. لا تُسلّم الطفل — تحقق من الهوية يدويًا وتواصل مع ولي الأمر.',
  },
  invalid_revoked: {
    icon: 'shield-x', tone: 'danger',
    titleEn: 'Access revoked', titleAr: 'تم إلغاء التصريح',
    bodyEn: 'The parent actively revoked this pass. Do NOT hand over the child under any circumstances — alert the administration immediately.',
    bodyAr: 'قام ولي الأمر بإلغاء هذا التصريح فعليًا. لا تُسلّم الطفل تحت أي ظرف — نبّه الإدارة فورًا.',
  },
};

/* ---------------- Scan flow ---------------- */
function ScanScreen({ lang, onVerified, pushLog }) {
  const ar = lang === 'ar';
  const [phase, setPhase] = useStateRcp('ready'); // ready | scanning | result
  const [pass, setPass] = useStateRcp(null);
  const [confirmHandover, setConfirmHandover] = useStateRcp(false);
  const [alerted, setAlerted] = useStateRcp(false);

  const startScan = (forcePass) => {
    setPhase('scanning');
    setAlerted(false);
    setTimeout(() => {
      const p = forcePass || (Math.random() < 0.75 ? PASSES[Math.floor(Math.random() * 2)] : PASSES[2 + Math.floor(Math.random() * 3)]);
      setPass(p);
      setPhase('result');
    }, 1600);
  };

  const doConfirm = () => {
    pushLog({ type: 'pickup', titleEn: `${pass.child} picked up`, titleAr: `تم استلام ${pass.childAr}`, subEn: `By ${pass.person} (${pass.relation})`, subAr: `بواسطة ${pass.personAr} (${pass.relationAr})`, time: nowTime() });
    onVerified(pass);
    setConfirmHandover(false);
    setPhase('ready'); setPass(null);
  };

  const alertAdmin = () => {
    pushLog({ type: 'alert', titleEn: 'Revoked pass scanned — admin alerted', titleAr: 'محاولة مسح تصريح ملغى — تم تنبيه الإدارة', subEn: `${pass.person} attempted pickup for ${pass.child}`, subAr: `${pass.personAr} حاول استلام ${pass.childAr}`, time: nowTime() });
    setAlerted(true);
  };

  return (
    <div style={{ padding: '16px 18px 20px' }}>
      {phase !== 'result' && (
        <React.Fragment>
          {/* scanner viewport */}
          <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', aspectRatio: '1 / 1', background: '#0E2422', display: 'grid', placeItems: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0 1px, transparent 1px 3px)' }} />
            {/* corner frames */}
            {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h],i)=>(
              <span key={i} style={{ position:'absolute', [v]:24, [h]:24, width:38, height:38, [`border${v[0].toUpperCase()+v.slice(1)}`]:`3px solid ${TERR}`, [`border${h[0].toUpperCase()+h.slice(1)}`]:`3px solid ${TERR}`, borderRadius: v==='top'&&h==='left'?'10px 0 0 0':v==='top'&&h==='right'?'0 10px 0 0':v==='bottom'&&h==='left'?'0 0 0 10px':'0 0 10px 0' }} />
            ))}
            {phase === 'scanning' ? (
              <React.Fragment>
                <QRMini seed={8} size={160} />
                <div style={{ position: 'absolute', insetInline: 40, height: 3, background: TERR, boxShadow: `0 0 14px ${TERR}`, animation: 'rscan 1.4s ease-in-out infinite' }} />
                <div style={{ position: 'absolute', bottom: 26, fontSize: 13, fontWeight: 700, color: '#F5F3EE', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'جاري المسح…' : 'Scanning…'}</div>
              </React.Fragment>
            ) : (
              <div style={{ textAlign: 'center', color: 'rgba(245,243,238,.6)', zIndex: 2 }}>
                <Icon name="qr-code" size={54} color="rgba(245,243,238,.4)" />
                <div style={{ fontSize: 13.5, marginTop: 12, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'وجّه الكاميرا نحو كود QR' : 'Point camera at the QR code'}</div>
              </div>
            )}
          </div>

          {phase === 'ready' && (
            <React.Fragment>
              <button onClick={() => startScan()} style={{ marginTop: 16, width: '100%', height: 56, borderRadius: 'var(--radius-pill)', border: 'none', background: TERR, color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                <Icon name="scan-line" size={20} color="#fff" />{ar ? 'بدء المسح' : 'Start scan'}
              </button>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <button onClick={() => startScan(PASSES[3])} style={{ height: 40, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{ar ? 'محاكاة: منتهٍ' : 'Simulate: Expired'}</button>
                <button onClick={() => startScan(PASSES[2])} style={{ height: 40, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{ar ? 'محاكاة: غير معروف' : 'Simulate: Unknown'}</button>
                <button onClick={() => startScan(PASSES[4])} style={{ height: 40, borderRadius: 'var(--radius-md)', border: '1px solid var(--danger-200)', background: 'var(--danger-50)', color: 'var(--danger-600)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{ar ? 'محاكاة: ملغى' : 'Simulate: Revoked'}</button>
              </div>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: TERR_SOFT, border: '1px solid color-mix(in srgb, var(--role-supervisor) 18%, transparent)' }}>
                <Icon name="shield-check" size={18} color={TERR} style={{ flex: 'none', marginTop: 1 }} />
                <span style={{ fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تأكّد من تطابق صورة البطاقة مع الشخص قبل تسليم الطفل.' : "Match the ID photo to the person before handing over the child."}</span>
              </div>
            </React.Fragment>
          )}
        </React.Fragment>
      )}

      {/* RESULT */}
      {phase === 'result' && pass && (
        pass.result === 'valid' ? (
          <div style={{ animation: 'rfade .25s var(--ease-out)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--success-50)', border: '1px solid var(--success-100)', marginBottom: 14 }}>
              <Icon name="badge-check" size={20} color="var(--success-600)" />
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--success-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'كود صالح · مخوّل بالاستلام' : 'Valid code · Authorized'}</span>
            </div>

            {/* authorized person */}
            <Card padding="md">
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 10 }}>{ar ? 'الشخص المستلِم' : 'Person collecting'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <Avatar name={pass.person} src={pass.photo} size={56} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? pass.personAr : pass.person}</div>
                  <Badge tone="violet" style={{ marginTop: 4 }}>{ar ? pass.relationAr : pass.relation}</Badge>
                </div>
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="id-card" size={16} color="var(--text-subtle)" />
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'رقم الهوية' : 'ID No.'}</span>
                <span style={{ marginInlineStart: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>{pass.idNo}</span>
              </div>
            </Card>

            {/* child */}
            <Card padding="md" style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 10 }}>{ar ? 'الطفل' : 'Child'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <Avatar name={pass.child} size={48} status="present" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? pass.childAr : pass.child}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `فصل ${pass.classroomAr}` : `${pass.classroom} room`} · {ar ? `ولي الأمر: ${pass.parentAr}` : `Parent: ${pass.parent}`}</div>
                </div>
              </div>
            </Card>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Button variant="secondary" onClick={() => { setPhase('ready'); setPass(null); }}>{ar ? 'إلغاء' : 'Cancel'}</Button>
              <button onClick={() => setConfirmHandover(true)} style={{ flex: 1, height: 52, borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--success-500)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 15.5, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon name="check" size={19} color="#fff" />{ar ? 'تأكيد التسليم' : 'Confirm handover'}
              </button>
            </div>
            {confirmHandover && (
              <ConfirmDialog icon="check" tone="amber" title={ar ? `تسليم ${pass.childAr} لـ${pass.personAr}؟` : `Hand over ${pass.child} to ${pass.person}?`}
                message={ar ? `سيتم إشعار ${pass.parentAr} فورًا بأن الطفل تم استلامه. تأكد من مطابقة الشخص أمامك لصورة الهوية قبل المتابعة.` : `${pass.parent} will be notified immediately that the child was collected. Make sure the person in front of you matches the ID before continuing.`}
                confirmLabel={ar ? 'تأكيد التسليم' : 'Confirm handover'} onConfirm={doConfirm} onClose={() => setConfirmHandover(false)} />
            )}
          </div>
        ) : (
          <div style={{ animation: 'rfade .25s var(--ease-out)', textAlign: 'center', paddingTop: 8 }}>
            <span style={{ width: 80, height: 80, borderRadius: '50%', background: SCAN_RESULT_META[pass.result].tone === 'amber' ? 'var(--amber-50)' : 'var(--danger-50)', color: SCAN_RESULT_META[pass.result].tone === 'amber' ? 'var(--amber-600)' : 'var(--danger-600)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}><Icon name={SCAN_RESULT_META[pass.result].icon} size={42} /></span>
            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: SCAN_RESULT_META[pass.result].tone === 'amber' ? 'var(--amber-700)' : 'var(--danger-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? SCAN_RESULT_META[pass.result].titleAr : SCAN_RESULT_META[pass.result].titleEn}</h3>
            <p style={{ margin: '8px auto 0', fontSize: 14, color: 'var(--text-muted)', maxWidth: 300, lineHeight: 1.55, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? SCAN_RESULT_META[pass.result].bodyAr : SCAN_RESULT_META[pass.result].bodyEn}</p>

            {pass.result === 'invalid_revoked' && pass.child && (
              <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', textAlign: 'start' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `حاول ${pass.personAr} (${pass.relationAr}) استلام ${pass.childAr}` : `${pass.person} (${pass.relation}) attempted to collect ${pass.child}`}</div>
              </div>
            )}

            {pass.result === 'invalid_revoked' && (
              alerted ? (
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--success-700)', fontSize: 13.5, fontWeight: 700, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
                  <Icon name="check-circle" size={17} color="var(--success-600)" />{ar ? 'تم تنبيه الإدارة' : 'Administration alerted'}
                </div>
              ) : (
                <button onClick={alertAdmin} style={{ marginTop: 16, width: '100%', height: 50, borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--danger-500)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Icon name="siren" size={18} color="#fff" />{ar ? 'تنبيه الإدارة الآن' : 'Alert admin now'}
                </button>
              )
            )}
            <Button variant="secondary" fullWidth style={{ marginTop: 12 }} onClick={() => { setPhase('ready'); setPass(null); setAlerted(false); }}>{ar ? 'مسح كود آخر' : 'Scan another'}</Button>
          </div>
        )
      )}
    </div>
  );
}

function nowTime() {
  const d = new Date();
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

/* ---------------- Bus confirm flow ---------------- */
function BusScreen({ lang, pushLog, pushNotif }) {
  const ar = lang === 'ar';
  // C6 fix: nothing below is reachable until a specific bus is chosen —
  // "Select all" can never silently apply to the wrong bus's roster.
  const [selectedBusId, setSelectedBusId] = useStateRcp(null);
  const [mode, setMode] = useStateRcp('arrival'); // arrival | departure
  const [checked, setChecked] = useStateRcp([]);
  const [done, setDone] = useStateRcp(false);
  const [confirmNotify, setConfirmNotify] = useStateRcp(false);
  const bus = BUSES_R.find(b => b.id === selectedBusId);

  if (!bus) {
    return (
      <div style={{ padding: '16px 18px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, paddingInlineStart: 4 }}>{ar ? 'اختر الباص' : 'Select a bus'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BUSES_R.map(b => (
            <button key={b.id} onClick={() => setSelectedBusId(b.id)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', textAlign: 'start' }}>
              <span style={{ width: 44, height: 44, borderRadius: '50%', background: TERR_SOFT, color: TERR, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="bus" size={22} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `باص ${b.noAr}` : `Bus ${b.no}`} · {ar ? b.driverAr : b.driver}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{b.children.length} {ar ? 'أطفال' : 'children'}</div>
              </div>
              <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={20} color="var(--text-subtle)" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const all = bus.children.length;
  const allChecked = checked.length === all;

  const toggle = (id) => setChecked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setChecked(allChecked ? [] : bus.children.map(c => c.id));

  const doConfirm = () => {
    setDone(true);
    setConfirmNotify(false);
    if (mode === 'arrival') {
      pushLog({ type: 'arrival', titleEn: `Bus ${bus.no} arrival confirmed`, titleAr: `تم تأكيد وصول باص ${bus.noAr}`, subEn: `${checked.length}/${all} children counted in`, subAr: `تم عدّ ${checked.length}/${all} أطفال`, time: nowTime() });
      pushNotif({ titleEn: 'All children arrived', titleAr: 'وصل جميع الأطفال', msgEn: `Reception confirmed ${checked.length} of ${all} children arrived at ${NURSERY_R.name}.`, msgAr: `أكّد الاستقبال وصول ${checked.length} من ${all} أطفال إلى ${NURSERY_R.nameAr}.` });
    } else {
      pushLog({ type: 'departure', titleEn: `Bus ${bus.no} departure confirmed`, titleAr: `تم تأكيد مغادرة باص ${bus.noAr}`, subEn: `${checked.length}/${all} children handed to driver`, subAr: `تم تسليم ${checked.length}/${all} أطفال للسائق`, time: nowTime() });
      pushNotif({ titleEn: 'Children handed to the bus', titleAr: 'تم تسليم الأطفال للباص', msgEn: `Reception handed ${checked.length} of ${all} children to the driver — on the way home.`, msgAr: `سلّم الاستقبال ${checked.length} من ${all} أطفال للسائق — في الطريق إلى المنزل.` });
    }
  };

  const reset = () => { setChecked([]); setDone(false); setSelectedBusId(null); };

  return (
    <div style={{ padding: '16px 18px 20px' }}>
      {!done && (
        <button onClick={() => { setSelectedBusId(null); setChecked([]); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 12 }}>
          <Icon name={ar ? 'chevron-right' : 'chevron-left'} size={15} color="var(--text-muted)" />{ar ? 'تغيير الباص' : 'Change bus'}
        </button>
      )}
      {/* mode toggle */}
      <div style={{ display: 'flex', gap: 8, background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', padding: 4, marginBottom: 14 }}>
        {[['arrival', ar ? 'وصول (نزول)' : 'Arrival (off)', 'log-in'], ['departure', ar ? 'مغادرة (صعود)' : 'Departure (on)', 'log-out']].map(([v, label, ic]) => {
          const on = mode === v;
          return (
            <button key={v} disabled={done} onClick={() => { setMode(v); setChecked([]); }} style={{ flex: 1, height: 42, borderRadius: 'var(--radius-sm)', border: 'none', background: on ? 'var(--surface-card)' : 'transparent', boxShadow: on ? 'var(--shadow-sm)' : 'none', color: on ? TERR : 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 13, fontWeight: 800, cursor: done ? 'not-allowed' : 'pointer', opacity: done && !on ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name={ic} size={16} />{label}
            </button>
          );
        })}
      </div>

      {done ? (
        <div style={{ animation: 'rfade .25s var(--ease-out)' }}>
          <div style={{ padding: '24px 20px', borderRadius: 'var(--radius-lg)', background: 'var(--success-50)', border: '1px solid var(--success-100)', textAlign: 'center' }}>
            <span style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface-card)', color: 'var(--success-600)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><Icon name="check-check" size={34} /></span>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--success-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{mode === 'arrival' ? (ar ? 'تم تأكيد الوصول' : 'Arrival confirmed') : (ar ? 'تم تأكيد المغادرة' : 'Departure confirmed')}</div>
            <div style={{ fontSize: 13.5, color: 'var(--success-700)', marginTop: 6, lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{mode === 'arrival' ? (ar ? `تم عدّ ${all} أطفال وإشعار جميع الأهل بوصولهم بأمان.` : `${all} children counted — all parents notified of safe arrival.`) : (ar ? `تم تسليم ${all} أطفال للسائق وإشعار جميع الأهل.` : `${all} children handed to driver — all parents notified.`)}</div>
          </div>
          <Button variant="secondary" fullWidth style={{ marginTop: 12 }} iconLeft={<Icon name="rotate-ccw" size={17} />} onClick={reset}>{ar ? 'عملية جديدة' : 'New count'}</Button>
        </div>
      ) : (
        <React.Fragment>
          {/* bus header + count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', marginBottom: 14 }}>
            <span style={{ width: 44, height: 44, borderRadius: '50%', background: TERR_SOFT, color: TERR, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="bus" size={22} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `باص ${bus.noAr} · ${bus.driverAr}` : `Bus ${bus.no} · ${bus.driver}`}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{mode === 'arrival' ? (ar ? 'عند الوصول للحضانة' : 'Arriving at nursery') : (ar ? 'قبل المغادرة' : 'Before departure')}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: TERR, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{checked.length}<span style={{ fontSize: 14, color: 'var(--text-subtle)' }}>/{all}</span></div>
            </div>
          </div>

          {/* select all */}
          <button onClick={toggleAll} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', marginBottom: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)', cursor: 'pointer' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تحديد الكل' : 'Select all'}</span>
            <span style={{ width: 24, height: 24, borderRadius: 7, border: `2px solid ${allChecked ? TERR : 'var(--border-strong)'}`, background: allChecked ? TERR : 'transparent', display: 'grid', placeItems: 'center' }}>{allChecked && <Icon name="check" size={15} color="#fff" />}</span>
          </button>

          {/* children checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bus.children.map(c => {
              const on = checked.includes(c.id);
              return (
                <button key={c.id} onClick={() => toggle(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? TERR : 'var(--border-subtle)'}`, background: on ? TERR_SOFT : 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
                  <Avatar name={c.name} size={40} status={on ? 'present' : null} />
                  <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? c.nameAr : c.name}</span>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${on ? TERR : 'var(--border-strong)'}`, background: on ? TERR : 'transparent', display: 'grid', placeItems: 'center', flex: 'none' }}>{on && <Icon name="check" size={16} color="#fff" />}</span>
                </button>
              );
            })}
          </div>

          <button onClick={() => setConfirmNotify(true)} disabled={!allChecked} style={{ marginTop: 16, width: '100%', height: 56, borderRadius: 'var(--radius-pill)', border: 'none', background: allChecked ? 'var(--success-500)' : 'var(--neutral-300)', color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 16, fontWeight: 800, cursor: allChecked ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
            <Icon name="bell-ring" size={20} color="#fff" />
            {allChecked
              ? (mode === 'arrival' ? (ar ? 'تأكيد الوصول وإشعار الأهل' : 'Confirm arrival & notify parents') : (ar ? 'تأكيد المغادرة وإشعار الأهل' : 'Confirm departure & notify parents'))
              : (ar ? `عُدّ كل الأطفال (${checked.length}/${all})` : `Count all children (${checked.length}/${all})`)}
          </button>

          {confirmNotify && (
            <ConfirmDialog icon="bell-ring" tone="amber"
              title={ar ? `إشعار ${all} من أولياء الأمور؟` : `Notify ${all} parent${all > 1 ? 's' : ''}?`}
              message={ar
                ? `سيتم إرسال إشعار فوري لكل أولياء أمور باص ${bus.noAr} بأن أطفالهم ${mode === 'arrival' ? 'وصلوا بأمان' : 'في الطريق للمنزل'}. تأكد أن العدّ صحيح قبل المتابعة.`
                : `Every parent on Bus ${bus.no} will be notified immediately that their child has ${mode === 'arrival' ? 'arrived safely' : 'left for home'}. Make sure the count is correct before continuing.`}
              confirmLabel={ar ? 'تأكيد وإشعار' : 'Confirm & notify'} onConfirm={doConfirm} onClose={() => setConfirmNotify(false)} />
          )}
        </React.Fragment>
      )}
    </div>
  );
}

/* ---------------- Log screen ---------------- */
function LogScreen({ lang, log }) {
  const ar = lang === 'ar';
  return (
    <div style={{ padding: '16px 18px 20px' }}>
      {log.length === 0 ? (
        <Card padding="lg" style={{ textAlign: 'center', marginTop: 20 }}>
          <Icon name="inbox" size={30} color="var(--text-subtle)" />
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 10, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'لا توجد عمليات مسجّلة بعد' : 'No activity logged yet'}</div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {log.map((l, i) => <LogRow key={i} l={l} ar={ar} />)}
        </div>
      )}
    </div>
  );
}

/* ---------------- Notifications panel ---------------- */
function RNotifPanel({ lang, items, onClose }) {
  const ar = lang === 'ar';
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', width: '100%', borderRadius: '28px 28px 0 0', padding: '10px 18px 28px', maxHeight: '80%', overflowY: 'auto', animation: 'rsheet .3s var(--ease-out)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 14px' }} />
        <h3 style={{ margin: '0 0 14px 4px', fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'الإشعارات المرسلة للأهل' : 'Notifications sent to parents'}</h3>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-subtle)', fontSize: 13.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'لا توجد إشعارات بعد' : 'No notifications sent yet'}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: 11, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--success-50)', border: '1px solid var(--success-100)' }}>
                <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--surface-card)', color: 'var(--success-600)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="check-check" size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? n.titleAr : n.titleEn}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? n.msgAr : n.msgEn}</div>
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
const R_TITLES = {
  home: { en: 'Reception', ar: 'الاستقبال' }, scan: { en: 'Scan Pickup', ar: 'مسح الاستلام' },
  bus: { en: 'Bus Confirmation', ar: 'تأكيد الباص' }, log: { en: 'Activity Log', ar: 'سجل العمليات' }, settings: { en: 'Settings', ar: 'الإعدادات' },
};

function ReceptionApp() {
  const [lang, setLang] = useStateRcp('en');
  const [authed, setAuthed] = useStateRcp(false);
  const [tab, setTab] = useStateRcp('home');
  const [log, setLog] = useStateRcp([]);
  const [notifs, setNotifs] = useStateRcp([]);
  const [showNotif, setShowNotif] = useStateRcp(false);
  const [showAbout, setShowAbout] = useStateRcp(false);
  const [profile, setProfile] = useStateRcp({ name: RECEPTIONIST.name, nameAr: RECEPTIONIST.nameAr, phone: RECEPTIONIST.phone, photo: null });
  const ar = lang === 'ar';

  const pushLog = (e) => setLog(prev => [e, ...prev]);
  const pushNotif = (n) => setNotifs(prev => [n, ...prev]);

  if (!authed) {
    return <window.ReceptionAuthGate lang={lang} setLang={setLang} onDone={() => setAuthed(true)} />;
  }

  return (
    <div dir={ar ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <style>{`
        @keyframes rsheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes rscan{0%{top:14%}50%{top:84%}100%{top:14%}}
        @keyframes rfade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .scroll::-webkit-scrollbar{width:0}
      `}</style>

      <RTopBar lang={lang} setLang={setLang} profile={profile} onProfile={() => setTab('settings')} onBell={() => setShowNotif(true)} unread={notifs.length > 0} />

      {tab !== 'settings' && (
        <div style={{ padding: '12px 18px 4px', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? R_TITLES[tab].ar : R_TITLES[tab].en}</h2>
        </div>
      )}

      <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'home' && <RHomeScreen lang={lang} onScan={() => setTab('scan')} onBus={() => setTab('bus')} log={log} />}
        {tab === 'scan' && <ScanScreen lang={lang} onVerified={() => {}} pushLog={pushLog} />}
        {tab === 'bus' && <BusScreen lang={lang} pushLog={pushLog} pushNotif={pushNotif} />}
        {tab === 'log' && <LogScreen lang={lang} log={log} />}
        {tab === 'settings' && <window.ReceptionSettingsScreen lang={lang} setLang={setLang} profile={profile} setProfile={setProfile} onAbout={() => setShowAbout(true)} onLogout={() => { window.MasarClient.auth.signOut().catch(() => {}); setAuthed(false); setTab('home'); setLog([]); setNotifs([]); }} />}
      </div>

      <RBottomNav lang={lang} tab={tab} setTab={setTab} />

      {showNotif && <RNotifPanel lang={lang} items={notifs} onClose={() => setShowNotif(false)} />}
      {showAbout && <window.ReceptionAboutScreen lang={lang} onBack={() => setShowAbout(false)} />}
    </div>
  );
}
window.ReceptionApp = ReceptionApp;
