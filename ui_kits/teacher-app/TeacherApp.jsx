const { useState } = React;
const VIOLET = 'var(--role-teacher)';

const TEACHER = { name: 'Ms. Sara Mahmoud', nameAr: 'أ. سارة محمود', subject: 'English', subjectAr: 'اللغة الإنجليزية' };
const ROSTER = [
  { id: 1, name: 'Yousef Adel', nameAr: 'يوسف عادل', present: true, eval: 'done', part: 'high' },
  { id: 2, name: 'Lina Hassan', nameAr: 'لينا حسن', present: true, eval: 'done', part: 'high' },
  { id: 3, name: 'Omar Khaled', nameAr: 'عمر خالد', present: false, eval: null, part: null },
  { id: 4, name: 'Malak Tarek', nameAr: 'ملك طارق', present: true, eval: 'pending', part: 'mid' },
  { id: 5, name: 'Adam Sherif', nameAr: 'آدم شريف', present: true, eval: 'pending', part: null },
  { id: 6, name: 'Jana Mostafa', nameAr: 'جنى مصطفى', present: true, eval: 'done', part: 'high' },
  { id: 7, name: 'Ali Hossam', nameAr: 'علي حسام', present: true, eval: 'pending', part: 'low' },
  { id: 8, name: 'Maya Wael', nameAr: 'مايا وائل', present: false, eval: null, part: null },
];
const CLASSES = [
  { id: 'kg2a', name: 'KG2 · Sunflower', nameAr: 'روضة ٢ · دوّار الشمس', time: '8:15 – 9:00', count: 8, room: 'Room 4', roomAr: 'غرفة ٤', now: true,  lesson: { en: 'Letter Sounds — M', ar: 'أصوات الحروف — حرف M' } },
  { id: 'kg2b', name: 'KG2 · Tulip',     nameAr: 'روضة ٢ · التوليب',      time: '9:45 – 10:30', count: 11, room: 'Room 6', roomAr: 'غرفة ٦', now: false, lesson: { en: 'Sight Words — the, and', ar: 'الكلمات البصرية — the و and' } },
  { id: 'kg1a', name: 'KG1 · Daisy',     nameAr: 'روضة ١ · الأقحوان',    time: '11:15 – 12:00', count: 9,  room: 'Room 2', roomAr: 'غرفة ٢', now: false, lesson: { en: 'Letter A — Tracing', ar: 'حرف الألف — الكتابة' } },
];

/* ---------------- Shell ---------------- */
function TopBar({ lang, setLang, onBell, notifCount, profile, onProfile }) {
  const ar = lang === 'ar';
  return (
    <div style={{ padding: '42px 18px 14px', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <button onClick={onProfile} style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'start' }}>
          <Avatar name={profile.name} src={profile.photo} size={42} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? (profile.nameAr || profile.name) : profile.name}</div>
            <div style={{ marginTop: 3 }}><Badge tone="violet" solid style={{ height: 20 }}>{ar ? `معلّمة ${TEACHER.subjectAr}` : `${TEACHER.subject} Teacher`}</Badge></div>
          </div>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 'none' }}>
          <button onClick={() => setLang(ar ? 'en' : 'ar')} style={{ height: 32, padding: '0 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>{ar ? 'EN' : 'ع'}</button>
          <button onClick={onBell} style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <Icon name="bell" size={18} color="var(--text-body)" />
            {notifCount > 0 && <span style={{ position: 'absolute', top: -3, insetInlineEnd: -3, minWidth: 17, height: 17, borderRadius: '50%', background: 'var(--danger-500)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 4px', border: '2px solid var(--surface-card)' }}>{notifCount}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

function BottomNav({ lang, tab, setTab, unread }) {
  const ar = lang === 'ar';
  const items = [
    { k: 'home', icon: 'layout-grid', en: 'Classes', a: 'الفصول' },
    { k: 'roster', icon: 'users', en: 'Roster', a: 'الطلاب' },
    { k: 'reports', icon: 'file-text', en: 'Reports', a: 'التقارير' },
    { k: 'requests', icon: 'calendar-plus', en: 'Requests', a: 'الطلبات' },
    { k: 'chat', icon: 'message-circle', en: 'Chat', a: 'المحادثات' },
  ];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 2px 26px', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)' }}>
      {items.map(it => {
        const on = tab === it.k;
        return (
          <button key={it.k} onClick={() => setTab(it.k)} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 6px', minWidth: 56 }}>
            <Icon name={it.icon} size={22} color={on ? VIOLET : 'var(--text-subtle)'} strokeWidth={on ? 2.4 : 2} />
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 600, color: on ? VIOLET : 'var(--text-subtle)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? it.a : it.en}</span>
            {it.k === 'chat' && unread > 0 && <span style={{ position: 'absolute', top: 2, insetInlineEnd: 8, minWidth: 16, height: 16, borderRadius: '50%', background: 'var(--danger-500)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 4px' }}>{unread}</span>}
          </button>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h3 style={{ margin: '20px 0 12px', fontSize: 15, fontWeight: 800, color: 'var(--text-strong)' }}>{children}</h3>;
}

/* ---------------- Classes (home) ---------------- */
function HomeScreen({ lang, openClass, lessons }) {
  const ar = lang === 'ar';
  const stats = [
    { v: CLASSES.length, label: ar ? 'الفصول' : 'Classes', icon: 'layout-grid', c: VIOLET },
    { v: 28, label: ar ? 'الطلاب' : 'Students', icon: 'users', c: 'var(--teal-600)' },
    { v: 4, label: ar ? 'للتقييم' : 'To evaluate', icon: 'clipboard-list', c: 'var(--amber-600)' },
  ];
  return (
    <div style={{ padding: '0 18px 20px' }}>
      {/* stat strip */}
      <div style={{ display: 'flex', marginTop: 18, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {stats.map((s, i) => (
          <div key={i} style={{ flex: 1, padding: '15px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, borderInlineStart: i ? '1px solid var(--border-subtle)' : 'none' }}>
            <span style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${s.c} 12%, transparent)`, color: s.c, display: 'grid', placeItems: 'center' }}><Icon name={s.icon} size={18} /></span>
            <span style={{ fontSize: 25, fontWeight: 800, color: 'var(--text-strong)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.v}</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      <SectionTitle>{ar ? 'فصول اليوم' : "Today's classes"}</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CLASSES.map(c => {
          const classLesson = lessons[c.id] || c.lesson;
          return (
            <Card key={c.id} padding="md" interactive onClick={() => openClass(c)} accent={c.now ? VIOLET : null} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 46, height: 46, borderRadius: 'var(--radius-md)', background: c.now ? '#EDE8F8' : 'var(--neutral-100)', color: VIOLET, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="graduation-cap" size={22} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? c.nameAr : c.name}</span>
                  {c.now && <Badge tone="amber" solid>{ar ? 'الآن' : 'Now'}</Badge>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{c.time}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}><Icon name="map-pin" size={13} color="var(--text-subtle)" />{ar ? c.roomAr : c.room}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="users" size={13} color="var(--text-subtle)" />{c.count}</span>
                </div>
                {/* per-class lesson preview */}
                <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: '#EDE8F8' }}>
                  <Icon name="book-open" size={13} color={VIOLET} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: VIOLET, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{ar ? classLesson.ar : classLesson.en}</span>
                </div>
              </div>
              <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={20} color="var(--text-subtle)" />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function partBadge(p, ar) {
  if (p === 'high') return <Badge tone="success" dot>{ar ? 'عالي' : 'High'}</Badge>;
  if (p === 'mid') return <Badge tone="amber" dot>{ar ? 'متوسط' : 'Mid'}</Badge>;
  if (p === 'low') return <Badge tone="danger" dot>{ar ? 'منخفض' : 'Low'}</Badge>;
  return <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>—</span>;
}

/* ---------------- Roster ---------------- */
function RosterScreen({ lang, cls, lessons, onEditLesson, openStudent, openBulk }) {
  const ar = lang === 'ar';
  const present = ROSTER.filter(s => s.present).length;
  const classLesson = cls ? (lessons[cls.id] || cls.lesson) : null;
  return (
    <div style={{ padding: '0 18px 20px' }}>
      <SectionTitle>{cls ? (ar ? cls.nameAr : cls.name) : (ar ? 'روضة ٢ · دوّار الشمس' : 'KG2 · Sunflower')}</SectionTitle>

      {/* per-class lesson banner */}
      {cls && (
        <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 'var(--radius-lg)', background: '#EDE8F8', border: '1px solid color-mix(in srgb, var(--role-teacher) 20%, transparent)', display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', color: VIOLET, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="book-open" size={19} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: VIOLET, marginBottom: 2 }}>{ar ? 'درس هذا الفصل اليوم' : "Today's lesson for this class"}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ar ? classLesson.ar : classLesson.en}</div>
          </div>
          <button onClick={() => onEditLesson(cls)} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid color-mix(in srgb, var(--role-teacher) 28%, transparent)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}><Icon name="pencil" size={15} color={VIOLET} /></button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
        <Card padding="sm" style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success-700)' }}>{present}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'حاضر' : 'Present'}</div></Card>
        <Card padding="sm" style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--danger-700)' }}>{ROSTER.length - present}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'غائب' : 'Absent'}</div></Card>
        <Card padding="sm" style={{ flex: 1, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--amber-700)' }}>4</div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'للتقييم' : 'To eval'}</div></Card>
      </div>
      <Button variant="primary" fullWidth style={{ background: VIOLET, marginTop: 12 }} iconLeft={<Icon name="layers" size={18} />} onClick={openBulk}>{ar ? 'تقييم جماعي' : 'Bulk evaluation'}</Button>
      <SectionTitle>{ar ? 'الطلاب' : 'Students'}</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ROSTER.map(s => (
          <Card key={s.id} padding="sm" interactive={s.present} onClick={() => s.present && openStudent(s)} style={{ display: 'flex', alignItems: 'center', gap: 11, opacity: s.present ? 1 : 0.55 }}>
            <Avatar name={s.name} size={38} status={s.present ? 'present' : 'absent'} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? s.nameAr : s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{s.present ? (ar ? 'حاضر' : 'Present') : (ar ? 'غائب اليوم' : 'Absent today')}</div>
            </div>
            {s.present ? (s.eval === 'done' ? <Badge tone="teal" dot>{ar ? 'مُقيّم' : 'Evaluated'}</Badge> : partBadge(s.part, ar)) : <Icon name="x" size={16} color="var(--danger-500)" />}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Student profile hub ---------------- */
function StudentProfileSheet({ lang, student, onClose, onEval, onMessage, onFlag }) {
  const ar = lang === 'ar';
  const Row = ({ icon, color, bg, title, sub, onClick, danger }) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: '13px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
      <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: bg, color, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={20} /></span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: danger ? 'var(--danger-700)' : 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{sub}</span>
      </span>
      <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />
    </button>
  );
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 }}>
        <Avatar name={student.name} size={52} status="present" />
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? student.nameAr : student.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'روضة ٢ · دوّار الشمس' : 'KG2 · Sunflower'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Row icon="clipboard-pen" color={VIOLET} bg="#EDE8F8" title={ar ? 'تقييم اليوم' : 'Evaluate today'} sub={ar ? 'فهم · مشاركة · سلوك' : 'Understanding · participation · behavior'} onClick={onEval} />
        <Row icon="message-circle" color="var(--teal-600)" bg="var(--teal-50)" title={ar ? 'مراسلة ولي الأمر' : 'Message parent'} sub={ar ? 'محادثة خاصة بمادة الإنجليزي' : 'Private chat for English'} onClick={onMessage} />
        <Row icon="flag" color="var(--danger-600)" bg="var(--danger-50)" title={ar ? 'رفع ملاحظة / مشكلة' : 'Raise a concern'} sub={ar ? 'تنبيه الأهل بمشكلة' : 'Flag a problem to the parent'} onClick={onFlag} danger />
      </div>
    </Sheet>
  );
}

/* ---------------- Bulk evaluation ---------------- */
function BulkSheet({ lang, onClose }) {
  const ar = lang === 'ar';
  const present = ROSTER.filter(s => s.present);
  const [sel, setSel] = useState(present.map(s => s.id));
  const all = sel.length === present.length;
  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div><div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تقييم جماعي' : 'Bulk evaluation'}</div><div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `${sel.length} من ${present.length} محدد` : `${sel.length} of ${present.length} selected`}</div></div>
        <button onClick={() => setSel(all ? [] : present.map(s => s.id))} style={{ fontSize: 13, fontWeight: 700, color: VIOLET, background: 'none', border: 'none', cursor: 'pointer', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{all ? (ar ? 'إلغاء' : 'Clear') : (ar ? 'تحديد الكل' : 'Select all')}</button>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, margin: '0 -2px 14px' }}>
        {present.map(s => { const on = sel.includes(s.id); return (
          <button key={s.id} onClick={() => toggle(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 10px', border: `1.5px solid ${on ? VIOLET : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-md)', background: on ? '#EDE8F8' : 'var(--surface-card)', cursor: 'pointer' }}>
            <Avatar name={s.name} size={32} />
            <span style={{ flex: 1, textAlign: 'start', fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? s.nameAr : s.name}</span>
            <span style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${on ? VIOLET : 'var(--border-strong)'}`, background: on ? VIOLET : 'transparent', display: 'grid', placeItems: 'center' }}>{on && <Icon name="check" size={13} color="#fff" />}</span>
          </button>
        ); })}
      </div>
      <Field label={ar ? 'ملخّص مشترك للمحددين' : 'Shared summary for selected'}><textarea defaultValue={ar ? 'طاقة رائعة في حلقة اليوم — أتقنت المجموعة صوت الحرف M وحافظت على التركيز.' : "Great energy in today's circle time — the whole group nailed the M sound and stayed focused."} style={{ width: '100%', minHeight: 70, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '11px 14px', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14, color: 'var(--text-strong)', resize: 'none', outline: 'none', boxSizing: 'border-box' }} /></Field>
      <Button variant="primary" fullWidth style={{ background: VIOLET }} iconLeft={<Icon name="send" size={17} />} onClick={onClose}>{ar ? `إرسال إلى ${sel.length} ولي أمر` : `Send to ${sel.length} parents`}</Button>
    </Sheet>
  );
}

/* ---------------- shared helpers (exported for other files) ---------------- */
function Sheet({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', width: '100%', maxHeight: '90%', overflowY: 'auto', borderRadius: '28px 28px 0 0', padding: '10px 22px 30px', animation: 'sheet .3s var(--ease-out)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 16px' }} />
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)', marginBottom: 7 }}>{label}</div>{children}</div>;
}
function Segment({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(([v, l]) => { const on = v === value; return (
        <button key={v} onClick={() => onChange(v)} style={{ flex: 1, height: 40, borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? VIOLET : 'var(--border-subtle)'}`, background: on ? '#EDE8F8' : 'var(--surface-card)', color: on ? VIOLET : 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
      ); })}
    </div>
  );
}
Object.assign(window, { Sheet, Field, Segment });

/* ====================================================================
   APP
   ==================================================================== */
function TeacherApp() {
  const [lang, setLang] = useState('en');
  const [authed, setAuthed] = useState(false);
  const [teacherProfile, setTeacherProfile] = useState({ name: TEACHER.name, nameAr: TEACHER.nameAr, subject: TEACHER.subject, subjectAr: TEACHER.subjectAr, phone: '+20 10 9876 5432', photo: null });
  const [showAbout, setShowAbout] = useState(false);
  const [tab, setTab] = useState('home');
  const [cls, setCls] = useState(null);
  const [profile, setProfile] = useState(null);   // student profile hub
  const [evalStudent, setEvalStudent] = useState(null);
  const [concernStudent, setConcernStudent] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [reportStudent, setReportStudent] = useState(null);
  const [sentReports, setSentReports] = useState([]);
  const [requests, setRequests] = useState(window.SEED_REQUESTS || []);
  const [showNewReq, setShowNewReq] = useState(false);
  const [chats, setChats] = useState(window.SEED_CHATS || []);
  const [openChatId, setOpenChatId] = useState(null);
  // per-class lessons: keyed by class id, seeded from CLASSES data
  const [lessons, setLessons] = useState(() => Object.fromEntries(CLASSES.map(c => [c.id, { ...c.lesson }])));
  const [editingClass, setEditingClass] = useState(null); // which class lesson to edit
  const [showNotif, setShowNotif] = useState(false);
  const [notifs] = useState(() => teacherNotifs());
  const ar = lang === 'ar';
  const unread = chats.reduce((n, c) => n + (c.unread || 0), 0);
  const notifCount = notifs.reduce((n, g) => n + g.items.filter(i => i.unread).length, 0);
  // the lesson for whichever class is currently open — same lookup RosterScreen uses,
  // so the evaluation sheet always reflects the class the teacher is actually in
  const currentLesson = cls ? (lessons[cls.id] || cls.lesson) : null;

  // Auth gate — splash → onboarding → login (+ forgot) before the app
  if (!authed) {
    return <window.TeacherAuthGate lang={lang} setLang={setLang} onDone={() => setAuthed(true)} />;
  }

  const onNotifPick = (n) => {
    setShowNotif(false);
    if (!n.go) return;
    if (n.go.chat) { openChatFromList(n.go.chat); setTab('chat'); }
    else if (n.go.tab) setTab(n.go.tab);
  };

  const submitRequest = (data) => {
    const t = window.SEED_REQUESTS ? null : null;
    const titleAr = data.title;
    setRequests(prev => [{ id: 'r' + Date.now(), status: 'pending', titleAr, dateAr: data.date, timeAr: data.time, placeAr: data.place, ...data }, ...prev]);
    setShowNewReq(false);
    setTab('requests');
  };

  const messageParentFor = (student) => {
    let chat = chats.find(c => c.child === student.name);
    if (!chat) {
      chat = { id: 'c' + Date.now(), parent: student.name.split(' ')[1] ? `${student.name.split(' ')[1]} family` : student.name, parentAr: `أسرة ${student.nameAr.split(' ')[0]}`, child: student.name, childAr: student.nameAr, unread: 0, escalated: false, msgs: [] };
      setChats(prev => [chat, ...prev]);
    }
    setProfile(null);
    setOpenChatId(chat.id);
    setTab('chat');
    // clear unread
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c));
  };

  const sendMessage = (chatId, text) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, msgs: [...c.msgs, { from: 'me', text, textAr: text, t: 'now' }] } : c));
  };

  const openChatFromList = (id) => { setOpenChatId(id); setChats(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c)); };
  const openChat = chats.find(c => c.id === openChatId);

  return (
    <div dir={ar ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      <style>{`@keyframes sheet{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <TopBar lang={lang} setLang={setLang} onBell={() => setShowNotif(true)} notifCount={notifCount} profile={teacherProfile} onProfile={() => setTab('settings')} />
      <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'home' && <HomeScreen lang={lang} lessons={lessons} openClass={(c) => { setCls(c); setTab('roster'); }} />}
        {tab === 'roster' && <RosterScreen lang={lang} cls={cls} lessons={lessons} onEditLesson={(c) => setEditingClass(c)} openStudent={setProfile} openBulk={() => setBulk(true)} />}
        {tab === 'reports' && <ReportsScreen lang={lang} subject={ar ? TEACHER.subjectAr : TEACHER.subject} sent={sentReports} onOpen={setReportStudent} />}
        {tab === 'requests' && <RequestsScreen lang={lang} requests={requests} onNew={() => setShowNewReq(true)} />}
        {tab === 'chat' && <ChatListScreen lang={lang} chats={chats} onOpen={openChatFromList} />}
        {tab === 'settings' && <window.TeacherSettingsScreen lang={lang} setLang={setLang} profile={teacherProfile} setProfile={setTeacherProfile} onAbout={() => setShowAbout(true)} onLogout={() => { window.MasarClient.auth.signOut().catch(() => {}); setAuthed(false); setTab('home'); }} />}
      </div>
      <BottomNav lang={lang} tab={tab === 'settings' ? '' : tab} setTab={setTab} unread={unread} />

      {/* student profile hub */}
      {profile && <StudentProfileSheet lang={lang} student={profile} onClose={() => setProfile(null)}
        onEval={() => { setEvalStudent(profile); setProfile(null); }}
        onMessage={() => messageParentFor(profile)}
        onFlag={() => { setConcernStudent(profile); setProfile(null); }} />}

      {evalStudent && <StudentEvalSheet lang={lang} student={evalStudent} lesson={currentLesson ? (ar ? currentLesson.ar : currentLesson.en) : ''} onClose={() => setEvalStudent(null)} onFlag={(s) => { setEvalStudent(null); setConcernStudent(s); }} />}
      {concernStudent && <ConcernSheet lang={lang} student={concernStudent} onClose={() => setConcernStudent(null)} onSend={() => setConcernStudent(null)} />}
      {bulk && <BulkSheet lang={lang} onClose={() => setBulk(false)} />}
      {reportStudent && <ReportDraftSheet lang={lang} subject={ar ? TEACHER.subjectAr : TEACHER.subject} student={reportStudent} onClose={() => setReportStudent(null)} onSend={(s) => { setSentReports(prev => [...prev, s.id]); setReportStudent(null); }} />}
      {showNewReq && <NewRequestSheet lang={lang} onClose={() => setShowNewReq(false)} onSubmit={submitRequest} />}
      {openChat && <ChatThread lang={lang} chat={openChat} onClose={() => setOpenChatId(null)} onSend={sendMessage} />}
      {editingClass && <LessonEditSheet lang={lang} lesson={lessons[editingClass.id] || editingClass.lesson} klass={editingClass} onClose={() => setEditingClass(null)} onSave={(l) => { setLessons(prev => ({ ...prev, [editingClass.id]: l })); setEditingClass(null); }} />}
      {showNotif && <NotifPanel lang={lang} title={ar ? 'الإشعارات' : 'Notifications'} groups={notifs} onPick={onNotifPick} onClose={() => setShowNotif(false)} accent={VIOLET} />}
      {showAbout && <window.TeacherAboutScreen lang={lang} onBack={() => setShowAbout(false)} />}
    </div>
  );
}
window.TeacherApp = TeacherApp;
