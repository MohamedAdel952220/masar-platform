const { useState, useEffect, useRef } = React;

/* ====================================================================
   Masar — Parent App
   Features: Home day-path · Live cameras · Conditional bus map · QR pickup pass
   ==================================================================== */

/* ---------------- Relationship options ---------------- */
const RELATIONS = [
  { v: 'father', en: 'Father', ar: 'الأب' },
  { v: 'mother', en: 'Mother', ar: 'الأم' },
  { v: 'uncle', en: 'Uncle', ar: 'العم / الخال' },
  { v: 'aunt', en: 'Aunt', ar: 'العمة / الخالة' },
  { v: 'grandfather', en: 'Grandfather', ar: 'الجد' },
  { v: 'grandmother', en: 'Grandmother', ar: 'الجدة' },
  { v: 'sibling', en: 'Sibling', ar: 'الأخ / الأخت' },
  { v: 'driver', en: 'Family driver', ar: 'سائق العائلة' },
  { v: 'other', en: 'Other', ar: 'أخرى' },
];
const relLabel = (v, ar) => { const r = RELATIONS.find(x => x.v === v); return r ? (ar ? r.ar : r.en) : ''; };

/* ---------------- Data ---------------- */
const CHILDREN = [
  {
    id: 'yousef', name: 'Yousef Adel', nameAr: 'يوسف عادل', age: 'KG2 · 5y', ageAr: 'روضة ٢ · ٥ سنوات',
    classroom: 'Sunflower Room', classroomAr: 'فصل دوّار الشمس',
    teacher: 'Ms. Sara Mahmoud', teacherAr: 'أ. سارة محمود', status: 'classroom',
    path: [
      { label: 'At Home', labelAr: 'المنزل', state: 'done', time: '7:10' },
      { label: 'In Bus', labelAr: 'الباص', state: 'done', time: '7:42' },
      { label: 'Classroom', labelAr: 'الفصل', state: 'live', time: '8:05' },
      { label: 'Nap', labelAr: 'القيلولة', state: 'pending' },
      { label: 'Home', labelAr: 'المنزل', state: 'pending' },
    ],
    schedule: [
      { time: '8:15', subj: 'English', subjAr: 'إنجليزي', topic: 'Letter Sounds — M', topicAr: 'أصوات الحروف — م', icon: 'book-open', tone: 'teal', done: true },
      { time: '9:00', subj: 'Arabic', subjAr: 'عربي', topic: 'حرف الميم', topicAr: 'حرف الميم', icon: 'pen-tool', tone: 'violet', done: true },
      { time: '9:45', subj: 'Math', subjAr: 'رياضيات', topic: 'Counting to 20', topicAr: 'العد حتى ٢٠', icon: 'calculator', tone: 'info', done: false, now: true },
      { time: '10:30', subj: 'Free Play', subjAr: 'لعب حر', topic: 'Outdoor garden', topicAr: 'حديقة خارجية', icon: 'sun', tone: 'amber', done: false },
    ],
    cameras: [
      { id: 'class', name: 'Sunflower Classroom', nameAr: 'فصل دوّار الشمس', zone: 'Indoor', zoneAr: 'داخلي', online: true, here: true },
      { id: 'play', name: 'Garden Playground', nameAr: 'حديقة اللعب', zone: 'Outdoor', zoneAr: 'خارجي', online: true, here: false },
      { id: 'nap', name: 'Nap Room', nameAr: 'غرفة القيلولة', zone: 'Indoor', zoneAr: 'داخلي', online: true, here: false },
      { id: 'gate', name: 'Main Gate', nameAr: 'البوابة الرئيسية', zone: 'Entrance', zoneAr: 'المدخل', online: false, here: false },
    ],
    package: 'Full Day · Premium', packageAr: 'يوم كامل · بريميوم', pending: 1250, mood: 'cheerful', moodAr: 'مبتهج',
  },
  {
    id: 'lina', name: 'Lina Adel', nameAr: 'لينا عادل', age: 'KG1 · 4y', ageAr: 'روضة ١ · ٤ سنوات',
    classroom: 'Tulip Room', classroomAr: 'فصل التوليب',
    teacher: 'Ms. Hala Nabil', teacherAr: 'أ. هالة نبيل', status: 'playing',
    path: [
      { label: 'At Home', labelAr: 'المنزل', state: 'done', time: '7:10' },
      { label: 'In Bus', labelAr: 'الباص', state: 'done', time: '7:42' },
      { label: 'Classroom', labelAr: 'الفصل', state: 'done', time: '8:05' },
      { label: 'Playing', labelAr: 'اللعب', state: 'live', time: '10:20' },
      { label: 'Home', labelAr: 'المنزل', state: 'pending' },
    ],
    schedule: [
      { time: '8:15', subj: 'Circle Time', subjAr: 'الحلقة', topic: 'Good Morning Song', topicAr: 'أغنية الصباح', icon: 'music', tone: 'amber', done: true },
      { time: '9:00', subj: 'Arabic', subjAr: 'عربي', topic: 'الألوان', topicAr: 'الألوان', icon: 'palette', tone: 'violet', done: true },
      { time: '9:45', subj: 'Art', subjAr: 'فن', topic: 'Finger Painting', topicAr: 'الرسم بالأصابع', icon: 'brush', tone: 'teal', done: true },
      { time: '10:20', subj: 'Free Play', subjAr: 'لعب حر', topic: 'Building blocks', topicAr: 'مكعبات البناء', icon: 'blocks', tone: 'info', done: false, now: true },
    ],
    cameras: [
      { id: 'class', name: 'Tulip Classroom', nameAr: 'فصل التوليب', zone: 'Indoor', zoneAr: 'داخلي', online: true, here: false },
      { id: 'play', name: 'Garden Playground', nameAr: 'حديقة اللعب', zone: 'Outdoor', zoneAr: 'خارجي', online: true, here: true },
      { id: 'nap', name: 'Nap Room', nameAr: 'غرفة القيلولة', zone: 'Indoor', zoneAr: 'داخلي', online: true, here: false },
      { id: 'gate', name: 'Main Gate', nameAr: 'البوابة الرئيسية', zone: 'Entrance', zoneAr: 'المدخل', online: false, here: false },
    ],
    package: 'Half Day · Standard', packageAr: 'نصف يوم · أساسي', pending: 0, mood: 'playful', moodAr: 'مرحة',
  },
];

const TONE_C = { teal: 'var(--teal-600)', violet: 'var(--role-teacher)', info: 'var(--info-500)', amber: 'var(--amber-600)' };

/* ====================================================================
   BUS — phases. Map shows ONLY while the child is physically in the bus.
   ==================================================================== */
const BUS_PHASES = [
  {
    key: 'home-am', onBus: false, place: 'home', leg: 'am',
    statusEn: 'At home — waiting for the bus', statusAr: 'في المنزل — في انتظار الباص',
  },
  {
    key: 'to-school', onBus: true, leg: 'am', from: 'Home', fromAr: 'المنزل', to: 'Nursery', toAr: 'الحضانة',
    statusEn: 'In bus — heading to nursery', statusAr: 'في الباص — في الطريق إلى الحضانة',
    onboard: 5, total: 8, etaEn: '14 min', etaAr: '١٤ د', confirmBy: 'driver',
    nextStopEn: 'Picking up children along the route', nextStopAr: 'يلتقط الأطفال على الطريق',
  },
  {
    key: 'at-school', onBus: false, place: 'school', leg: 'am',
    statusEn: 'Arrived at nursery — confirmed', statusAr: 'وصل الحضانة — تم التأكيد',
    confirmBy: 'reception', countEn: '8 of 8 children', countAr: '٨ من ٨ أطفال',
  },
  {
    key: 'to-home', onBus: true, leg: 'pm', from: 'Nursery', fromAr: 'الحضانة', to: 'Home', toAr: 'المنزل',
    statusEn: 'In bus — heading home', statusAr: 'في الباص — في الطريق إلى المنزل',
    onboard: 8, total: 8, etaEn: '12 min', etaAr: '١٢ د', confirmBy: 'driver', dropping: true,
    nextStopEn: 'Dropping children until the last one', nextStopAr: 'يُوصّل الأطفال حتى آخر طفل',
  },
  {
    key: 'home-pm', onBus: false, place: 'home', leg: 'pm',
    statusEn: 'Home — delivered to family', statusAr: 'في المنزل — تم التسليم للعائلة',
  },
];

/* Static guidance shown when the child is NOT on the bus (home / school). */
const BUS_INFO = {
  pickupAmEn: '7:10 AM', pickupAmAr: '٧:١٠ ص',
  dropPmEn: '2:25 PM', dropPmAr: '٢:٢٥ م',
  stopEn: 'Building 12 · Main gate', stopAr: 'عمارة ١٢ · البوابة الرئيسية',
  tips: [
    { icon: 'clock', en: 'Be at the stop 5 minutes early', ar: 'كون عند الموقف قبل الموعد بـ ٥ دقائق' },
    { icon: 'id-card', en: 'Child should wear the Masar ID badge', ar: 'يرتدي الطفل بطاقة مسار التعريفية' },
    { icon: 'user-round-check', en: 'Hand the child only to the bus assistant', ar: 'سلّم الطفل لمشرفة الباص فقط' },
  ],
};

/* Notification feed for each phase index (cumulative, newest first when rendered) */
function busNotifications(phaseIdx, ar) {
  const ev = [];
  if (phaseIdx >= 0) ev.push({ t: '7:08', type: 'info', icon: 'bell', titleEn: 'Bus on the way to you', titleAr: 'الباص في طريقه إليك', msgEn: 'Bus 3 will reach your stop in ~5 min.', msgAr: 'باص ٣ سيصل لموقفك خلال ٥ دقائق تقريبًا.' });
  if (phaseIdx >= 1) ev.push({ t: '7:14', type: 'amber', icon: 'bus', titleEn: 'Boarded — confirmed by driver', titleAr: 'ركب الباص — تأكيد السائق', msgEn: 'Mr. Tarek confirmed your child is on board Bus 3. Live map is open.', msgAr: 'أكّد الكابتن طارق صعود طفلك إلى باص ٣. الخريطة المباشرة مفتوحة.' });
  if (phaseIdx >= 2) ev.push({ t: '7:42', type: 'success', icon: 'circle-check-big', titleEn: 'Arrived — reception confirmed', titleAr: 'وصل — تأكيد الريسبشن', msgEn: 'Reception counted all children (8/8). Your child checked in safely.', msgAr: 'عدّت الريسبشن كل الأطفال (٨/٨). تم تسجيل دخول طفلك بأمان.' });
  if (phaseIdx >= 3) ev.push({ t: '1:40', type: 'amber', icon: 'bus', titleEn: 'On the way home — confirmed', titleAr: 'في الطريق للمنزل — تم التأكيد', msgEn: 'Driver confirmed all children boarded. Live map is open again.', msgAr: 'أكّد السائق صعود كل الأطفال. الخريطة المباشرة مفتوحة مجددًا.' });
  if (phaseIdx >= 4) ev.push({ t: '2:26', type: 'success', icon: 'house', titleEn: 'Delivered home', titleAr: 'تم التوصيل للمنزل', msgEn: 'Your child reached home and was handed to family. Trip finished.', msgAr: 'وصل طفلك إلى المنزل وتم تسليمه للعائلة. انتهت الرحلة.' });
  return ev.reverse();
}

/* ---------------- Shell pieces ---------------- */
function TopBar({ lang, setLang, unread, onBell, notifCount }) {
  const ar = lang === 'ar';
  return (
    <div style={{ padding: '42px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
      <MasarMark size={20} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setLang(ar ? 'en' : 'ar')} style={{ height: 32, padding: '0 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>{ar ? 'EN' : 'ع'}</button>
        <button onClick={onBell} style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <Icon name="bell" size={18} color="var(--text-body)" />
          {notifCount > 0 && <span style={{ position: 'absolute', top: -3, insetInlineEnd: -3, minWidth: 17, height: 17, borderRadius: '50%', background: 'var(--danger-500)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 4px', border: '2px solid var(--surface-card)' }}>{notifCount}</span>}
        </button>
      </div>
    </div>
  );
}

function ChildSwitcher({ lang, kids, activeId, setActive }) {
  const ar = lang === 'ar';
  return (
    <div style={{ display: 'flex', gap: 10, padding: '14px 18px 4px', background: 'var(--surface-card)' }}>
      {kids.map(c => {
        const on = c.id === activeId;
        return (
          <button key={c.id} onClick={() => setActive(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 12px 6px 6px', borderRadius: 'var(--radius-pill)', border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-subtle)'}`, background: on ? 'var(--teal-50)' : 'var(--surface-card)', cursor: 'pointer' }}>
            <Avatar name={c.name} size={30} status={on ? 'live' : null} />
            <span style={{ fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: on ? 'var(--teal-700)' : 'var(--text-muted)' }}>{(ar ? c.nameAr : c.name).split(' ')[0]}</span>
          </button>
        );
      })}
    </div>
  );
}

function BottomNav({ lang, tab, setTab, onMore }) {
  const ar = lang === 'ar';
  const moreTabs = ['bus', 'chat', 'pickup', 'pay', 'settings'];
  const items = [
    { k: 'home', icon: 'house', en: 'Home', a: 'الرئيسية' },
    { k: 'subjects', icon: 'book-open', en: 'Subjects', a: 'المواد' },
    { k: 'events', icon: 'calendar-days', en: 'Events', a: 'الفعاليات' },
    { k: 'cameras', icon: 'video', en: 'Cameras', a: 'الكاميرات' },
    { k: 'more', icon: 'menu', en: 'More', a: 'المزيد' },
  ];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 2px 26px', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)' }}>
      {items.map(it => {
        const on = it.k === 'more' ? moreTabs.includes(tab) : tab === it.k;
        return (
          <button key={it.k} onClick={() => it.k === 'more' ? onMore() : setTab(it.k)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 6px', minWidth: 56 }}>
            <Icon name={it.icon} size={22} color={on ? 'var(--primary)' : 'var(--text-subtle)'} strokeWidth={on ? 2.4 : 2} />
            <span style={{ fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 11, fontWeight: on ? 700 : 600, color: on ? 'var(--primary)' : 'var(--text-subtle)' }}>{ar ? it.a : it.en}</span>
          </button>
        );
      })}
    </div>
  );
}

function SectionTitle({ children, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 0 12px' }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: 'var(--tracking-snug)' }}>{children}</h3>
      {action && <span onClick={onAction} style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', cursor: onAction ? 'pointer' : 'default' }}>{action}</span>}
    </div>
  );
}

/* ====================================================================
   HOME
   ==================================================================== */
function HomeScreen({ lang, child, go }) {
  const ar = lang === 'ar';
  const steps = child.path.map(p => ({ label: ar ? p.labelAr : p.label, state: p.state, time: p.time }));
  return (
    <div style={{ padding: '0 18px 20px' }}>
      <SectionTitle>{ar ? 'مسار اليوم' : "Today's day path"}</SectionTitle>
      <Card padding="lg" accent="var(--primary)">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? child.nameAr : child.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{ar ? child.classroomAr : child.classroom} · {ar ? child.ageAr : child.age}</div>
          </div>
          <StatusPill status={child.status} lang={lang} />
        </div>
        <DayPath steps={steps} style={{ margin: '4px 0 8px' }} />
        <div style={{ display: 'flex', gap: 18, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar name={child.teacher} size={30} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>{ar ? 'المعلمة' : 'Teacher'}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? child.teacherAr : child.teacher}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginInlineStart: 'auto' }}>
            <Icon name="clock" size={15} color="var(--text-subtle)" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{ar ? 'تحديث 10:24' : 'Updated 10:24'}</span>
          </div>
        </div>
      </Card>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        {[
          { k: 'subjects', icon: 'book-open', en: 'Subjects', a: 'المواد', c: 'var(--teal-600)' },
          { k: 'events', icon: 'calendar-days', en: 'Events', a: 'الفعاليات', c: 'var(--role-teacher)' },
          { k: 'cameras', icon: 'video', en: 'Cameras', a: 'الكاميرات', c: 'var(--info-500)' },
          { k: 'pickup', icon: 'qr-code', en: 'Pickup', a: 'الاستلام', c: 'var(--amber-600)' },
        ].map(q => (
          <button key={q.k} onClick={() => go(q.k)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', textAlign: 'start' }}>
            <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${q.c} 12%, transparent)`, color: q.c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={q.icon} size={20} /></span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? q.a : q.en}</span>
          </button>
        ))}
      </div>

      <SectionTitle action={ar ? 'الكل' : 'All'}>{ar ? 'جدول اليوم' : "Today's schedule"}</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {child.schedule.map((s, i) => (
          <Card key={i} padding="sm" style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: s.done ? 0.72 : 1, borderLeft: s.now ? '3px solid var(--amber-500)' : '1px solid var(--border-subtle)' }}>
            <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: `color-mix(in srgb, ${TONE_C[s.tone]} 12%, transparent)`, color: TONE_C[s.tone], display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={s.icon} size={19} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? s.subjAr : s.subj}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ar ? s.topicAr : s.topic}</div>
            </div>
            {s.now ? <Badge tone="amber" solid>{ar ? 'الآن' : 'Now'}</Badge> : s.done ? <Icon name="check" size={16} color="var(--success-500)" /> : <span style={{ fontSize: 12, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>{s.time}</span>}
          </Card>
        ))}
      </div>

      <SectionTitle>{ar ? 'آخر نشاط' : 'Last activity'}</SectionTitle>
      <Card padding="md" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--amber-50)', color: 'var(--amber-600)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="smile" size={22} /></span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>{ar ? `المزاج: ${child.moodAr}` : `Mood: ${child.mood}`}</div>
          <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--text-body)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'شارك بنشاط في حلقة اللغة الإنجليزية وانتقل بهدوء إلى وقت الرياضيات.' : 'Participated actively in English circle and moved calmly into Math time.'}</p>
        </div>
      </Card>
    </div>
  );
}

/* ====================================================================
   CAMERAS — live feeds the parent can open to watch their child
   ==================================================================== */
function CameraFeed({ label, ar, big }) {
  // Realistic CCTV-style placeholder viewport (no real video in prototype)
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 50% 18%, #1d3b39 0%, #0E2422 70%, #081715 100%)', overflow: 'hidden' }}>
      {/* faint scene shapes */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5, background: 'linear-gradient(transparent 0 60%, rgba(20,120,95,.14) 60% 100%)' }} />
      <div style={{ position: 'absolute', left: '14%', bottom: '14%', width: big ? 70 : 40, height: big ? 70 : 40, borderRadius: 8, background: 'rgba(245,243,238,.07)' }} />
      <div style={{ position: 'absolute', right: '16%', bottom: '20%', width: big ? 54 : 30, height: big ? 54 : 30, borderRadius: '50%', background: 'rgba(239,159,39,.10)' }} />
      {/* scanlines */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px)', pointerEvents: 'none' }} />
      <Icon name="video" size={big ? 46 : 30} color="rgba(245,243,238,.16)" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
      {/* LIVE badge */}
      <div style={{ position: 'absolute', top: 10, insetInlineStart: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 'var(--radius-pill)', background: 'rgba(213,80,58,.92)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', animation: 'blink 1.4s infinite' }} />
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', color: '#fff' }}>LIVE</span>
      </div>
      {/* timestamp */}
      <div style={{ position: 'absolute', top: 10, insetInlineEnd: 12, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'rgba(245,243,238,.75)' }}>{ts}</div>
      {/* label */}
      <div style={{ position: 'absolute', bottom: 10, insetInlineStart: 12, insetInlineEnd: 12, fontSize: big ? 13 : 11.5, fontWeight: 700, color: 'rgba(245,243,238,.92)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>{label}</div>
    </div>
  );
}

function CamerasScreen({ lang, child, openCam }) {
  const ar = lang === 'ar';
  return (
    <div style={{ padding: '0 18px 20px' }}>
      <SectionTitle>{ar ? 'كاميرات مباشرة' : 'Live cameras'}</SectionTitle>
      <Card padding="md" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--teal-50)', border: '1px solid var(--teal-100)', marginBottom: 4 }}>
        <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--surface-card)', color: 'var(--teal-600)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="shield-check" size={20} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal-800)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'وصول آمن ومشفّر' : 'Secure, encrypted access'}</div>
          <div style={{ fontSize: 12, color: 'var(--teal-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مرتبط بحضانة طفلك فقط' : "Linked only to your child's nursery"}</div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
        {child.cameras.map(cam => {
          const off = !cam.online;
          return (
            <div key={cam.id} onClick={() => !off && openCam(cam)} style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', cursor: off ? 'default' : 'pointer', background: 'var(--surface-card)' }}>
              <div style={{ position: 'relative', aspectRatio: '4 / 3' }}>
                {off ? (
                  <div style={{ position: 'absolute', inset: 0, background: 'var(--neutral-800)', display: 'grid', placeItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <Icon name="video-off" size={26} color="var(--neutral-500)" />
                      <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 6, fontWeight: 700 }}>{ar ? 'غير متصلة' : 'Offline'}</div>
                    </div>
                  </div>
                ) : <CameraFeed label={ar ? cam.nameAr : cam.name} ar={ar} />}
                {cam.here && cam.online && (
                  <div style={{ position: 'absolute', bottom: 8, insetInlineEnd: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--amber-500)' }}>
                    <Icon name="map-pin" size={11} color="#1C1C1A" />
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#1C1C1A' }}>{ar ? 'طفلك هنا' : 'Here'}</span>
                  </div>
                )}
              </div>
              <div style={{ padding: '9px 11px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ar ? cam.nameAr : cam.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{ar ? cam.zoneAr : cam.zone}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CameraModal({ lang, child, cam, onClose }) {
  const ar = lang === 'ar';
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0E2422', zIndex: 70, display: 'flex', flexDirection: 'column' }}>
      {/* top bar */}
      <div style={{ padding: '46px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(245,243,238,.12)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <Icon name={ar ? 'arrow-right' : 'arrow-left'} size={20} color="#F5F3EE" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#F5F3EE', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? cam.nameAr : cam.name}</div>
          <div style={{ fontSize: 12, color: 'rgba(245,243,238,.6)' }}>{ar ? child.classroomAr : child.classroom}</div>
        </div>
      </div>
      {/* feed */}
      <div style={{ flex: 1, position: 'relative', margin: '0 12px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid rgba(245,243,238,.12)' }}>
        <CameraFeed label={ar ? cam.nameAr : cam.name} ar={ar} big />
      </div>
      {/* controls */}
      <div style={{ padding: '16px 16px 30px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {cam.here && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 'var(--radius-pill)', background: 'rgba(239,159,39,.18)', flex: 1 }}>
            <Avatar name={child.name} size={26} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#F5F3EE', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `${child.nameAr.split(' ')[0]} في هذه الغرفة` : `${child.name.split(' ')[0]} is in this room`}</span>
          </div>
        )}
        <button style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', background: 'rgba(245,243,238,.12)', display: 'grid', placeItems: 'center', cursor: 'pointer', marginInlineStart: cam.here ? 0 : 'auto' }}>
          <Icon name="volume-2" size={20} color="#F5F3EE" />
        </button>
        <button style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', background: 'rgba(245,243,238,.12)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <Icon name="maximize" size={20} color="#F5F3EE" />
        </button>
      </div>
    </div>
  );
}

/* ====================================================================
   BUS — map ONLY when child is on the bus; otherwise notifications
   ==================================================================== */
function NotifCard({ n, ar }) {
  const tones = {
    success: ['var(--success-50)', 'var(--success-500)', 'var(--success-700)'],
    amber: ['var(--amber-50)', 'var(--amber-500)', 'var(--amber-700)'],
    info: ['var(--info-50)', 'var(--info-500)', 'var(--info-700)'],
  };
  const [bg, dot, fg] = tones[n.type] || tones.info;
  return (
    <Card padding="sm" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ width: 36, height: 36, borderRadius: '50%', background: bg, color: dot, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={n.icon} size={18} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? n.titleAr : n.titleEn}</span>
          <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', flex: 'none' }}>{n.t}</span>
        </div>
        <p style={{ margin: '3px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? n.msgAr : n.msgEn}</p>
      </div>
    </Card>
  );
}

const BUS_ROUTE = 'M26 176 C 90 168, 96 110, 168 112 S 286 88, 306 44';

function BusMap({ lang, phase }) {
  const ar = lang === 'ar';
  const onboard = phase.onboard || 0;
  const total = phase.total || 8;
  const dropping = phase.dropping;
  const remaining = dropping ? onboard : (total - onboard);
  return (
    <Card padding="none" style={{ overflow: 'hidden' }}>
      <div style={{ height: 210, position: 'relative', overflow: 'hidden' }}>
        {/* Google-maps style base */}
        <svg width="100%" height="100%" viewBox="0 0 390 210" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
          <rect x="0" y="0" width="390" height="210" fill="#E9EEE8" />
          {/* parks / blocks */}
          <rect x="20" y="14" width="86" height="58" rx="7" fill="#D7E5D4" />
          <rect x="250" y="120" width="120" height="80" rx="7" fill="#D7E5D4" />
          <rect x="158" y="8" width="74" height="46" rx="6" fill="#E6E2D6" />
          <rect x="120" y="150" width="80" height="52" rx="6" fill="#E6E2D6" />
          {/* roads (white casing) */}
          <g stroke="#FFFFFF" strokeWidth="11" strokeLinecap="round">
            <line x1="-5" y1="74" x2="395" y2="74" />
            <line x1="-5" y1="150" x2="395" y2="150" />
            <line x1="90" y1="-5" x2="90" y2="215" />
            <line x1="300" y1="-5" x2="300" y2="215" />
            <line x1="-5" y1="120" x2="395" y2="120" strokeWidth="7" />
          </g>
          {/* route */}
          <path d={BUS_ROUTE} fill="none" stroke="var(--teal-500)" strokeWidth="5" strokeLinecap="round" />
          <path d={BUS_ROUTE} fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 11" opacity="0.85" />
          {/* intermediate child stops */}
          {[[96,150],[168,112],[238,104],[300,74]].map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r="5" fill={i < onboard - 1 ? 'var(--teal-500)' : '#fff'} stroke="var(--teal-500)" strokeWidth="2" />
          ))}
        </svg>

        {/* origin */}
        <span style={{ position: 'absolute', left: 18, bottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--teal-600)', boxShadow: '0 0 0 3px #fff' }} />
        </span>
        {/* destination pin */}
        <span style={{ position: 'absolute', right: 70, top: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Icon name="map-pin" size={26} color="var(--success-600)" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.25))' }} />
        </span>
        {/* moving bus marker */}
        <span style={{ position: 'absolute', width: 38, height: 38, borderRadius: '50%', background: 'var(--amber-500)', display: 'grid', placeItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.25), 0 0 0 6px rgba(239,159,39,.22)', offsetPath: `path('${BUS_ROUTE}')`, animation: 'busmove 7s ease-in-out infinite alternate' }}>
          <Icon name="bus" size={19} color="#1C1C1A" />
        </span>
        {/* leg labels */}
        <span style={{ position: 'absolute', left: 12, bottom: 6, fontSize: 11, fontWeight: 700, color: 'var(--teal-800)', background: 'rgba(255,255,255,.8)', padding: '2px 7px', borderRadius: 'var(--radius-pill)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? phase.fromAr : phase.from}</span>
        <span style={{ position: 'absolute', right: 12, top: 6, fontSize: 11, fontWeight: 700, color: 'var(--success-700)', background: 'rgba(255,255,255,.8)', padding: '2px 7px', borderRadius: 'var(--radius-pill)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? phase.toAr : phase.to}</span>
        {/* live chip */}
        <span style={{ position: 'absolute', top: 10, insetInlineStart: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'rgba(255,255,255,.92)', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--amber-500)', animation: 'blink 1.4s infinite' }} />
          <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مباشر' : 'LIVE'}</span>
        </span>
      </div>

      {/* progress: children on board / dropped */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{dropping ? (ar ? 'الأطفال المتبقون في الباص' : 'Children still on board') : (ar ? 'الأطفال على متن الباص' : 'Children on board')}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--amber-700)', fontVariantNumeric: 'tabular-nums' }}>{onboard}<span style={{ color: 'var(--text-subtle)' }}>/{total}</span></span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} style={{ flex: 1, height: 6, borderRadius: 'var(--radius-pill)', background: i < onboard ? 'var(--amber-500)' : 'var(--neutral-200)' }} />
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? phase.nextStopAr : phase.nextStopEn}</div>
      </div>

      {/* driver */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name="Mr Tarek" size={42} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'الكابتن طارق' : 'Mr. Tarek'} · {ar ? 'باص ٣' : 'Bus 3'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ar ? 'لوحة ٤٢٨١' : 'Plate 4281'}</div>
        </div>
        <Button size="sm" variant="secondary" iconLeft={<Icon name="phone" size={15} />}>{ar ? 'اتصال' : 'Call'}</Button>
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ flex: 1, padding: '12px 16px', textAlign: 'center', borderInlineEnd: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-subtle)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>{ar ? 'الوصول' : 'ETA'}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{ar ? phase.etaAr : phase.etaEn}</div>
        </div>
        <div style={{ flex: 1, padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-subtle)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>{ar ? 'الحالة' : 'Status'}</div>
          <div style={{ marginTop: 4 }}><StatusPill status="in-bus" lang={lang} size="sm" /></div>
        </div>
      </div>
    </Card>
  );
}

/* Confirmation banner — who confirmed (driver / reception) */
function ConfirmBanner({ lang, phase }) {
  const ar = lang === 'ar';
  if (phase.confirmBy === 'reception') {
    return (
      <Card padding="md" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--success-50)', border: '1px solid var(--success-100)', marginTop: 12 }}>
        <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-card)', color: 'var(--success-600)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="clipboard-check" size={21} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--success-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تأكيد الريسبشن' : 'Confirmed by reception'}</div>
          <div style={{ fontSize: 12, color: 'var(--success-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `تم عدّ ${phase.countAr} ووصولهم جميعًا` : `Counted ${phase.countEn} — all arrived`}</div>
        </div>
      </Card>
    );
  }
  return null;
}

/* Instructions card — shown when child is at home/school (map closed) */
function BusInstructions({ lang, phase }) {
  const ar = lang === 'ar';
  const finished = phase.key === 'home-pm';
  return (
    <div style={{ marginTop: 16 }}>
      <SectionTitle>{ar ? 'إرشادات الباص' : 'Bus guidelines'}</SectionTitle>
      <Card padding="none" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ flex: 1, padding: '14px 16px', textAlign: 'center', borderInlineEnd: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{ar ? 'موعد الصباح' : 'Morning pickup'}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--teal-700)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{ar ? BUS_INFO.pickupAmAr : BUS_INFO.pickupAmEn}</div>
          </div>
          <div style={{ flex: 1, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{ar ? 'موعد العودة' : 'Drop-off'}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--amber-700)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{ar ? BUS_INFO.dropPmAr : BUS_INFO.dropPmEn}</div>
          </div>
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-subtle)' }}>
          <Icon name="map-pin" size={17} color="var(--text-subtle)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{ar ? 'موقف الباص' : 'Your bus stop'}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? BUS_INFO.stopAr : BUS_INFO.stopEn}</div>
          </div>
        </div>
        <div style={{ padding: '6px 16px 12px' }}>
          {BUS_INFO.tips.map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: i < BUS_INFO.tips.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--teal-50)', color: 'var(--teal-600)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={t.icon} size={16} /></span>
              <span style={{ fontSize: 13, color: 'var(--text-body)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? t.ar : t.en}</span>
            </div>
          ))}
        </div>
      </Card>
      {finished && (
        <Card padding="md" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, background: 'var(--teal-50)', border: '1px solid var(--teal-100)' }}>
          <Icon name="circle-check-big" size={22} color="var(--teal-600)" style={{ flex: 'none' }} />
          <span style={{ fontSize: 13, color: 'var(--teal-800)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'انتهت رحلة اليوم بأمان. ستظهر الخريطة المباشرة تلقائيًا غدًا عند صعود طفلك للباص.' : "Today's trip ended safely. The live map will appear automatically tomorrow when your child boards."}</span>
        </Card>
      )}
    </div>
  );
}

function BusScreen({ lang, phaseIdx }) {
  const ar = lang === 'ar';
  const phase = BUS_PHASES[phaseIdx];
  const finished = phaseIdx >= BUS_PHASES.length - 1;
  const notifs = busNotifications(phaseIdx, ar);
  const onBus = phase.onBus;

  return (
    <div style={{ padding: '0 18px 20px' }}>
      {/* Status banner */}
      <SectionTitle>{ar ? 'حالة النقل' : 'Transport status'}</SectionTitle>
      <Card padding="md" accent={onBus ? 'var(--amber-500)' : 'var(--primary)'} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <span style={{ width: 44, height: 44, borderRadius: '50%', background: onBus ? 'var(--amber-50)' : 'var(--teal-50)', color: onBus ? 'var(--amber-600)' : 'var(--teal-600)', display: 'grid', placeItems: 'center', flex: 'none' }}>
          <Icon name={onBus ? 'bus' : phase.place === 'school' ? 'school' : 'house'} size={22} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? phase.statusAr : phase.statusEn}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? (onBus ? 'الخريطة مفتوحة للتتبع المباشر' : 'الخريطة تظهر فقط أثناء وجوده في الباص') : (onBus ? 'Map is open for live tracking' : 'Map opens only while in the bus')}</div>
        </div>
      </Card>

      {/* Reception confirmation banner at school */}
      <ConfirmBanner lang={lang} phase={phase} />

      {/* Map ONLY while on the bus */}
      {onBus && (
        <div style={{ marginTop: 16 }}>
          <SectionTitle>{ar ? 'الخريطة المباشرة' : 'Live map'}</SectionTitle>
          <BusMap lang={lang} phase={phase} />
        </div>
      )}

      {/* Instructions when NOT on the bus */}
      {!onBus && <BusInstructions lang={lang} phase={phase} />}

      {/* Notifications feed */}
      <SectionTitle>{ar ? 'الإشعارات' : 'Notifications'}</SectionTitle>
      {notifs.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifs.map((n, i) => <NotifCard key={i} n={n} ar={ar} />)}
        </div>
      ) : (
        <Card padding="md" style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>{ar ? 'لا توجد إشعارات بعد' : 'No notifications yet'}</Card>
      )}

      {/* Live status — updates on its own as the driver and reception confirm each
          step (no manual control here); nothing for the parent to trigger or drive. */}
      <div style={{ marginTop: 22, padding: '12px 14px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-sunken)', display: 'flex', alignItems: 'center', gap: 10 }}>
        {finished ? (
          <React.Fragment>
            <Icon name="circle-check-big" size={16} color="var(--success-600)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'انتهت رحلة اليوم' : "Today's trip is complete"}</span>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success-500)', flex: 'none', boxShadow: '0 0 0 3px rgba(16,163,74,.18)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'يتحدّث تلقائيًا مع كل تأكيد من السائق أو الريسبشن' : 'Updates automatically as the driver and reception confirm'}</span>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

/* ====================================================================
   PICKUP — create a QR pass for an authorized person + share
   ==================================================================== */
function QRGrid({ seed = 7, size = 168 }) {
  const n = 21; const cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const finder = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    const on = finder
      ? ((x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4)) || (x >= n - 7 && (x === n - 7 || x === n - 1)) || (y >= n - 7 && (y === n - 7 || y === n - 1)))
      : (((x * 7 + y * 13 + x * y + seed * 3) % 3 === 0));
    if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0E2422" />);
  }
  return <svg viewBox="0 0 21 21" width={size} height={size} shapeRendering="crispEdges">{cells}</svg>;
}

function PickupScreen({ lang, child, passes, onCreate, onShow }) {
  const ar = lang === 'ar';
  return (
    <div style={{ padding: '0 18px 20px' }}>
      <SectionTitle>{ar ? 'تصاريح الاستلام' : 'Pickup passes'}</SectionTitle>
      <Card padding="md" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--teal-50)', border: '1px solid var(--teal-100)' }}>
        <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--surface-card)', color: 'var(--teal-600)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="qr-code" size={20} /></span>
        <div style={{ flex: 1, fontSize: 12.5, color: 'var(--teal-800)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
          {ar ? 'أنشئ كود QR لأي شخص تأذن له باصطحاب طفلك، ويُعرض عند البوابة.' : 'Create a QR code for anyone you authorize to pick up your child, shown at the gate.'}
        </div>
      </Card>

      <Button variant="primary" fullWidth style={{ marginTop: 14 }} iconLeft={<Icon name="plus" size={18} />} onClick={onCreate}>{ar ? 'إنشاء تصريح جديد' : 'Create new pass'}</Button>

      <SectionTitle>{ar ? 'الأشخاص المخوّلون' : 'Authorized people'}</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {passes.length === 0 && (
          <Card padding="lg" style={{ textAlign: 'center' }}>
            <Icon name="user-plus" size={28} color="var(--text-subtle)" />
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'لا يوجد تصاريح بعد' : 'No passes created yet'}</div>
          </Card>
        )}
        {passes.map(p => (
          <Card key={p.id} padding="sm" interactive onClick={() => onShow(p)} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={p.name} src={p.photo} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{relLabel(p.relation, ar)}</div>
            </div>
            <Badge tone={p.active ? 'success' : p.revoked ? 'danger' : 'neutral'} dot>{p.active ? (ar ? 'فعّال' : 'Active') : p.revoked ? (ar ? 'ملغى' : 'Revoked') : (ar ? 'منتهٍ' : 'Expired')}</Badge>
            <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />
          </Card>
        ))}
      </div>
    </div>
  );
}

/* Create-pass sheet (form) */
function CreatePickupSheet({ lang, onClose, onGenerate }) {
  const ar = lang === 'ar';
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [photo, setPhoto] = useState(null);
  const fileRef = useRef(null);
  const valid = name.trim() && relation && photo;

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) { const r = new FileReader(); r.onload = ev => setPhoto(ev.target.result); r.readAsDataURL(f); }
  };

  const field = { width: '100%', padding: '12px 14px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };
  const lbl = { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)', marginBottom: 7, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' };

  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', width: '100%', borderRadius: '28px 28px 0 0', padding: '10px 22px 26px', maxHeight: '92%', overflowY: 'auto', animation: 'sheet .3s var(--ease-out)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 16px' }} />
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تصريح استلام جديد' : 'New pickup pass'}</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'أدخل بيانات الشخص المخوّل باصطحاب طفلك' : "Enter the details of the person authorized to collect your child"}</p>

        {/* Name */}
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>{ar ? 'اسم الشخص' : 'Person name'}</label>
          <input type="text" value={name} placeholder={ar ? 'مثال: محمد عادل' : 'e.g. Mohamed Adel'} onChange={e => setName(e.target.value)} style={field} />
        </div>

        {/* Relationship */}
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>{ar ? 'درجة القرابة' : 'Relationship'}</label>
          <select value={relation} onChange={e => setRelation(e.target.value)} style={{ ...field, cursor: 'pointer' }}>
            <option value="">{ar ? 'اختر القرابة' : 'Select relationship'}</option>
            {RELATIONS.map(r => <option key={r.v} value={r.v}>{ar ? r.ar : r.en}</option>)}
          </select>
        </div>

        {/* ID photo */}
        <div style={{ marginBottom: 22 }}>
          <label style={lbl}>{ar ? 'صورة بطاقة الهوية' : 'ID card photo'}</label>
          <div onClick={() => fileRef.current && fileRef.current.click()} style={{ border: '1.5px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', padding: photo ? 12 : '26px 16px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-raised)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {photo ? (
              <>
                <img src={photo} alt="ID" style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 'var(--radius-sm)', display: 'block' }} />
                <span style={{ fontSize: 12.5, color: 'var(--primary)', fontWeight: 700 }}>{ar ? 'تغيير الصورة' : 'Change photo'}</span>
              </>
            ) : (
              <>
                <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--teal-50)', color: 'var(--teal-600)', display: 'grid', placeItems: 'center' }}><Icon name="camera" size={22} /></span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'ارفع صورة البطاقة' : 'Upload ID photo'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 2 }}>PNG / JPG</div>
                </div>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
        </div>

        <Button variant="primary" fullWidth size="lg" disabled={!valid} iconLeft={<Icon name="qr-code" size={18} />} onClick={() => onGenerate({ name: name.trim(), relation, photo })}>{ar ? 'إنشاء الكود' : 'Generate QR'}</Button>
      </div>
    </div>
  );
}

/* Generated pass view + share */
function PassView({ lang, child, pass, onClose, onRevoke }) {
  const ar = lang === 'ar';
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const remainingMs = Math.max(0, (pass.expiresAt || now) - now);
  const remainingLabel = (() => {
    const s = Math.floor(remainingMs / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  })();
  const expired = remainingMs <= 0;
  const shareText = ar
    ? `تصريح استلام ${ar ? child.nameAr : child.name} — ${pass.name} (${relLabel(pass.relation, true)}). صالح اليوم فقط عبر تطبيق مسار.`
    : `Pickup pass for ${child.name} — ${pass.name} (${relLabel(pass.relation, false)}). Valid today only via Masar.`;
  const wa = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  const sysShare = () => { if (navigator.share) navigator.share({ title: 'Masar Pickup Pass', text: shareText }).catch(() => {}); else wa(); };

  const Row = ({ icon, label, value, mono }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <Icon name={icon} size={18} color="var(--text-subtle)" />
      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{label}</span>
      <span style={{ marginInlineStart: 'auto', fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: mono ? 'var(--font-mono)' : ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{value}</span>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', width: '100%', borderRadius: '28px 28px 0 0', padding: '10px 22px 28px', maxHeight: '94%', overflowY: 'auto', animation: 'sheet .3s var(--ease-out)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 16px' }} />
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'كود الاستلام' : 'Pickup QR'}</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'يُعرض عند بوابة الحضانة' : 'Show this at the nursery gate'}</p>
        </div>

        <div style={{ margin: '18px auto', width: 204, height: 204, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)', position: 'relative', opacity: (pass.revoked || expired) ? 0.25 : 1 }}>
          <QRGrid seed={pass.seed} />
          {(pass.revoked || expired) && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <Badge tone="danger" solid>{pass.revoked ? (ar ? 'ملغى' : 'Revoked') : (ar ? 'منتهٍ' : 'Expired')}</Badge>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0 4px' }}>
          <Avatar name={pass.name} src={pass.photo} size={46} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{pass.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{relLabel(pass.relation, ar)}</div>
          </div>
          {pass.revoked
            ? <Badge tone="danger" dot style={{ marginInlineStart: 'auto' }}>{ar ? 'ملغى' : 'Revoked'}</Badge>
            : expired
              ? <Badge tone="neutral" dot style={{ marginInlineStart: 'auto' }}>{ar ? 'منتهٍ' : 'Expired'}</Badge>
              : <Badge tone="success" dot style={{ marginInlineStart: 'auto' }}>{ar ? 'فعّال' : 'Active'}</Badge>}
        </div>

        <div style={{ marginTop: 8 }}>
          <Row icon="user-round" label={ar ? 'الطفل' : 'Child'} value={ar ? child.nameAr : child.name} />
          <Row icon="clock" label={ar ? 'ينتهي خلال' : 'Expires in'} value={pass.revoked ? '—' : expired ? (ar ? 'منتهٍ' : 'Expired') : remainingLabel} mono={!pass.revoked && !expired} />
          <Row icon="shield-check" label={ar ? 'النوع' : 'Type'} value={ar ? 'استخدام واحد' : 'Single use'} />
        </div>

        {/* Share — disabled once revoked or expired, so a stale pass can't keep circulating */}
        <div style={{ marginTop: 18, opacity: (pass.revoked || expired) ? 0.4 : 1, pointerEvents: (pass.revoked || expired) ? 'none' : 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>{ar ? 'مشاركة عبر' : 'Share via'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <ShareBtn icon="message-circle" label={ar ? 'واتساب' : 'WhatsApp'} bg="#25D366" onClick={wa} />
            <ShareBtn icon="share-2" label={ar ? 'مشاركة' : 'Share'} bg="var(--primary)" onClick={sysShare} />
            <ShareBtn icon="copy" label={ar ? 'نسخ' : 'Copy'} bg="var(--neutral-700)" onClick={() => navigator.clipboard && navigator.clipboard.writeText(shareText)} />
          </div>
        </div>

        {!pass.revoked && !expired && (
          <button onClick={() => setConfirmRevoke(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 44, marginTop: 18, borderRadius: 'var(--radius-md)', border: '1.5px solid var(--danger-200)', background: 'var(--danger-50)', color: 'var(--danger-600)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            <Icon name="shield-off" size={17} color="var(--danger-600)" />{ar ? 'إلغاء هذا التصريح' : 'Revoke this pass'}
          </button>
        )}
        <Button variant="secondary" fullWidth style={{ marginTop: 10 }} onClick={onClose}>{ar ? 'تم' : 'Done'}</Button>
      </div>
      {confirmRevoke && (
        <ConfirmDialog icon="shield-off" tone="danger" title={ar ? `إلغاء تصريح ${pass.name}؟` : `Revoke ${pass.name}'s pass?`}
          message={ar ? 'لن يعمل هذا الكود بعد الآن. سيظهر لموظف الاستقبال كـ«ملغى» فورًا عند مسحه.' : 'This code stops working immediately — reception will see it as Revoked the moment it is scanned.'}
          confirmLabel={ar ? 'إلغاء التصريح' : 'Revoke pass'} onConfirm={() => onRevoke && onRevoke(pass.id)} onClose={() => setConfirmRevoke(false)} />
      )}
    </div>
  );
}
function ShareBtn({ icon, label, bg, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '12px 6px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--surface-raised)', cursor: 'pointer' }}>
      <span style={{ width: 40, height: 40, borderRadius: '50%', background: bg, display: 'grid', placeItems: 'center' }}><Icon name={icon} size={19} color="#fff" /></span>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-body)' }}>{label}</span>
    </button>
  );
}

/* ====================================================================
   APP
   ==================================================================== */
const TITLES = {
  home: { en: 'Home', ar: 'الرئيسية' }, subjects: { en: 'Subjects', ar: 'المواد الدراسية' },
  events: { en: 'Events', ar: 'الفعاليات' }, cameras: { en: 'Live Cameras', ar: 'الكاميرات المباشرة' },
  bus: { en: 'Bus Tracking', ar: 'تتبع الباص' }, pickup: { en: 'Pickup Pass', ar: 'تصريح الاستلام' }, pay: { en: 'Payments', ar: 'المدفوعات' },
  chat: { en: 'Messages', ar: 'المحادثات' },
  settings: { en: 'Settings', ar: 'الإعدادات' },
};

function MoreSheet({ lang, active, onPick, onClose }) {
  const ar = lang === 'ar';
  const opts = [
    { k: 'bus', icon: 'bus', en: 'Bus Tracking', a: 'تتبع الباص', dEn: 'Live map & arrival alerts', dA: 'خريطة مباشرة وإشعارات الوصول', tone: 'amber' },
    { k: 'chat', icon: 'message-circle', en: 'Messages', a: 'محادثة المعلّم', dEn: 'Chat with subject teachers', dA: 'التواصل مع معلمي المواد', tone: 'teal' },
    { k: 'pickup', icon: 'qr-code', en: 'Pickup Pass', a: 'تصريح الاستلام', dEn: 'QR codes for authorized people', dA: 'أكواد QR للأشخاص المخوّلين', tone: 'teal' },
    { k: 'pay', icon: 'credit-card', en: 'Payments', a: 'المدفوعات', dEn: 'Packages & invoices', dA: 'الباقات والفواتير', tone: 'info' },
    { k: 'settings', icon: 'settings', en: 'Settings', a: 'الإعدادات', dEn: 'Profile, language & notifications', dA: 'الملف واللغة والإشعارات', tone: 'violet' },
  ];
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} dir={ar ? 'rtl' : 'ltr'} style={{ background: 'var(--surface-card)', width: '100%', borderRadius: '28px 28px 0 0', padding: '10px 18px 28px', animation: 'sheet .3s var(--ease-out)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 16px' }} />
        <h3 style={{ margin: '0 0 14px 4px', fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'المزيد' : 'More'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opts.map(o => {
            const c = TONE_C[o.tone] || 'var(--primary)';
            const on = active === o.k;
            return (
              <button key={o.k} onClick={() => onPick(o.k)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: `1px solid ${on ? 'var(--primary)' : 'var(--border-subtle)'}`, background: on ? 'var(--teal-50)' : 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
                <span style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={o.icon} size={22} /></span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? o.a : o.en}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? o.dA : o.dEn}</span>
                </span>
                <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ParentApp() {
  const [lang, setLang] = useState('en');
  const [authed, setAuthed] = useState(false);
  const [profile, setProfile] = useState({ name: 'Adel Mostafa', nameAr: 'عادل مصطفى', phone: '+20 10 1234 5678', photo: null });
  const [showAbout, setShowAbout] = useState(false);
  const [activeId, setActiveId] = useState('yousef');
  const [tab, setTab] = useState('home');
  const [cam, setCam] = useState(null);
  const [busPhase, setBusPhase] = useState(2); // start: at nursery
  const [showCreate, setShowCreate] = useState(false);
  const [activePass, setActivePass] = useState(null);
  const [openSubject, setOpenSubject] = useState(null);
  const [showMore, setShowMore] = useState(false);
  const [chats, setChats] = useState(window.PARENT_CHATS_SEED || []);
  const [openChatId, setOpenChatId] = useState(null);
  const [showNotif, setShowNotif] = useState(false);
  const [notifs] = useState(() => parentNotifs());
  const [passesById, setPassesById] = useState({
    yousef: [{ id: 'p1', name: 'Mohamed Adel', relation: 'father', photo: null, active: true, revoked: false, expiresAt: Date.now() + 5 * 60 * 1000, seed: 4 }],
    lina: [],
  });
  const ar = lang === 'ar';
  const child = CHILDREN.find(c => c.id === activeId);
  const passes = passesById[activeId] || [];

  const addPass = (data) => {
    const p = { id: 'p' + Date.now(), ...data, active: true, revoked: false, expiresAt: Date.now() + 5 * 60 * 1000, seed: Math.floor(Math.random() * 50) + 1 };
    setPassesById(prev => ({ ...prev, [activeId]: [p, ...(prev[activeId] || [])] }));
    setShowCreate(false);
    setActivePass(p);
  };
  // a revoked pass is immediately unusable — distinct from one that simply expired,
  // so the person holding it (and reception scanning it) knows it was actively cut off
  const revokePass = (id) => {
    setPassesById(prev => ({ ...prev, [activeId]: (prev[activeId] || []).map(p => p.id === id ? { ...p, active: false, revoked: true } : p) }));
    setActivePass(null);
  };

  // Bus tracking phases advance on their own — mirroring driver/reception
  // push confirmations arriving from the backend — never by the parent
  // tapping through a stepper themselves.
  useEffect(() => {
    if (busPhase >= BUS_PHASES.length - 1) return;
    const t = setTimeout(() => setBusPhase(p => Math.min(BUS_PHASES.length - 1, p + 1)), 9000);
    return () => clearTimeout(t);
  }, [busPhase]);

  const SUBJ_TEACHERS = {
    english: { teacher: 'Ms. Sara Mahmoud', teacherAr: 'أ. سارة محمود', subject: 'English', subjectAr: 'اللغة الإنجليزية', tone: 'teal' },
    arabic: { teacher: 'Ms. Hala Nabil', teacherAr: 'أ. هالة نبيل', subject: 'Arabic', subjectAr: 'اللغة العربية', tone: 'violet' },
    math: { teacher: 'Ms. Sara Mahmoud', teacherAr: 'أ. سارة محمود', subject: 'Math', subjectAr: 'الرياضيات', tone: 'info' },
    art: { teacher: 'Ms. Hala Nabil', teacherAr: 'أ. هالة نبيل', subject: 'Art & Music', subjectAr: 'الفن والموسيقى', tone: 'amber' },
  };
  const messageTeacher = (subjectId) => {
    let chat = chats.find(c => c.subjectId === subjectId);
    if (!chat) {
      const t = SUBJ_TEACHERS[subjectId] || SUBJ_TEACHERS.english;
      chat = { id: 'subj-' + subjectId, subjectId, ...t, unread: 0, escalated: false, msgs: [] };
      setChats(prev => [chat, ...prev]);
    }
    setOpenSubject(null);
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c));
    setOpenChatId(chat.id);
  };
  const openChatFromList = (id) => { setOpenChatId(id); setChats(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c)); };
  const sendChat = (id, text) => setChats(prev => prev.map(c => c.id === id ? { ...c, msgs: [...c.msgs, { from: 'me', text, textAr: text, t: 'now' }] } : c));
  const escalateChat = (id) => setChats(prev => prev.map(c => c.id === id ? { ...c, escalated: true, msgs: [...c.msgs, { from: 'system', text: 'You reported this conversation to administration.', textAr: 'لقد صعّدت هذه المحادثة إلى الإدارة.', t: 'now' }] } : c));
  const openChat = chats.find(c => c.id === openChatId);
  const chatUnread = chats.reduce((n, c) => n + (c.unread || 0), 0);
  const notifCount = notifs.reduce((n, g) => n + g.items.filter(i => i.unread).length, 0);

  // Auth gate — splash → onboarding → login (+ forgot) before the app
  if (!authed) {
    return <window.ParentAuthGate lang={lang} setLang={setLang} onDone={() => setAuthed(true)} />;
  }

  const onNotifPick = (n) => {
    setShowNotif(false);
    if (!n.go) return;
    if (n.go.chat) { setOpenChatId(n.go.chat); setChats(prev => prev.map(c => c.id === n.go.chat ? { ...c, unread: 0 } : c)); }
    else if (n.go.subject) setOpenSubject(n.go.subject);
    else if (n.go.tab) setTab(n.go.tab);
  };

  return (
    <div dir={ar ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <style>{`
        @keyframes sheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fade{from{opacity:0}to{opacity:1}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes busmove{from{offset-distance:8%}to{offset-distance:88%}}
        .scroll::-webkit-scrollbar{width:0}
      `}</style>

      <TopBar lang={lang} setLang={setLang} unread={busPhase < 4} onBell={() => setShowNotif(true)} notifCount={notifCount} />
      <ChildSwitcher lang={lang} kids={CHILDREN} activeId={activeId} setActive={setActiveId} />

      {/* screen title */}
      <div style={{ padding: '12px 18px 4px', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? TITLES[tab].ar : TITLES[tab].en}</h2>
      </div>

      <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'home' && <HomeScreen lang={lang} child={child} go={setTab} />}
        {tab === 'subjects' && <SubjectsScreen lang={lang} child={child} onOpen={setOpenSubject} />}
        {tab === 'events' && <EventsScreen lang={lang} />}
        {tab === 'cameras' && <CamerasScreen lang={lang} child={child} openCam={setCam} />}
        {tab === 'bus' && <BusScreen lang={lang} phaseIdx={busPhase} />}
        {tab === 'pickup' && <PickupScreen lang={lang} child={child} passes={passes} onCreate={() => setShowCreate(true)} onShow={setActivePass} />}
        {tab === 'pay' && <window.PaymentsScreen lang={lang} child={child} />}
        {tab === 'chat' && <ParentChatList lang={lang} chats={chats} onOpen={openChatFromList} />}
        {tab === 'settings' && <window.SettingsScreen lang={lang} setLang={setLang} profile={profile} setProfile={setProfile} onAbout={() => setShowAbout(true)} onLogout={() => { window.MasarClient.auth.signOut().catch(() => {}); setAuthed(false); setTab('home'); }} />}
      </div>

      <BottomNav lang={lang} tab={tab} setTab={setTab} onMore={() => setShowMore(true)} />

      {showMore && <MoreSheet lang={lang} active={tab} onPick={(k) => { setTab(k); setShowMore(false); }} onClose={() => setShowMore(false)} />}
      {openSubject && <SubjectDetail lang={lang} child={child} subjectId={openSubject} onBack={() => setOpenSubject(null)} onMessageTeacher={messageTeacher} />}
      {showNotif && <ParentNotifPanel lang={lang} groups={notifs} onPick={onNotifPick} onClose={() => setShowNotif(false)} />}
      {cam && <CameraModal lang={lang} child={child} cam={cam} onClose={() => setCam(null)} />}
      {showCreate && <CreatePickupSheet lang={lang} onClose={() => setShowCreate(false)} onGenerate={addPass} />}
      {activePass && <PassView lang={lang} child={child} pass={activePass} onClose={() => setActivePass(null)} onRevoke={revokePass} />}
      {openChat && <ParentChatThread lang={lang} chat={openChat} onClose={() => setOpenChatId(null)} onSend={sendChat} onEscalate={escalateChat} />}
      {showAbout && <window.AboutScreen lang={lang} onBack={() => setShowAbout(false)} />}
    </div>
  );
}
window.ParentApp = ParentApp;
