const { useState: useStateA } = React;

/* ====================================================================
   Masar — Parent App · Academics (Subjects) + Events
   Loaded after masar-ui.jsx and before ParentApp.jsx.
   Globals available: Icon, Button, Badge, Avatar, Card, Tabs, StatusPill...
   ==================================================================== */

const TONE_CA = { teal: 'var(--teal-600)', violet: 'var(--role-teacher)', info: 'var(--info-500)', amber: 'var(--amber-600)', success: 'var(--success-500)' };

/* ---------------- Subjects data (per child) ---------------- */
const SUBJECTS_DATA = {
  yousef: [
    {
      id: 'english', name: 'English', nameAr: 'اللغة الإنجليزية', icon: 'book-open', tone: 'teal',
      teacher: 'Ms. Sara Mahmoud', teacherAr: 'أ. سارة محمود', mastery: 88,
      daily: [
        { when: 'Today', whenAr: 'اليوم', date: 'Tue · Jun 24', dateAr: 'الثلاثاء · ٢٤ يونيو', lesson: 'Letter Sounds — M', lessonAr: 'أصوات الحروف — حرف M', desc: 'Recognised the /m/ sound, traced the letter and matched 4 picture cards.', descAr: 'تعرّف على صوت /m/، وكتب الحرف، وطابق ٤ بطاقات صور.', understanding: 5, participation: 4, behavior: 5, homework: 'done', note: 'Yousef led the picture game today and helped a friend sound out "moon". Lovely focus.', noteAr: 'قاد يوسف لعبة الصور اليوم وساعد زميله في نطق كلمة moon. تركيز رائع.' },
        { when: 'Yesterday', whenAr: 'أمس', date: 'Mon · Jun 23', dateAr: 'الإثنين · ٢٣ يونيو', lesson: 'Sight Words — “the, and”', lessonAr: 'كلمات بصرية — the و and', desc: 'Practised reading two sight words inside short sentences.', descAr: 'تدرّب على قراءة كلمتين بصريتين داخل جمل قصيرة.', understanding: 4, participation: 5, behavior: 5, homework: 'done', note: 'Very enthusiastic in circle time — answered every prompt.', noteAr: 'متحمّس جدًا في الحلقة — أجاب على كل سؤال.' },
        { when: '', whenAr: '', date: 'Sun · Jun 22', dateAr: 'الأحد · ٢٢ يونيو', lesson: 'Story Time — “The Big Red Bus”', lessonAr: 'وقت القصة — الباص الأحمر الكبير', desc: 'Listened to the story and answered comprehension questions.', descAr: 'استمع للقصة وأجاب على أسئلة الفهم.', understanding: 4, participation: 3, behavior: 4, homework: 'none', note: 'A little tired after lunch but engaged well in the retelling.', noteAr: 'كان متعبًا قليلًا بعد الغداء لكنه تفاعل جيدًا في إعادة سرد القصة.' },
      ],
      monthly: { understanding: 90, participation: 86, homework: 95, attendance: 98, dU: 6, dP: 4, dH: 2, dA: 0,
        skills: [ { en: 'Letter recognition', ar: 'تمييز الحروف', v: 92 }, { en: 'Phonics / sounds', ar: 'الصوتيات', v: 84 }, { en: 'Listening', ar: 'الاستماع', v: 88 }, { en: 'Speaking confidence', ar: 'الثقة في التحدث', v: 80 } ],
        summary: 'Yousef has made strong progress in phonics this month and now blends simple CVC words independently. Next focus: building speaking confidence in group activities.', summaryAr: 'حقّق يوسف تقدمًا قويًا في الصوتيات هذا الشهر وأصبح يدمج الكلمات البسيطة بمفرده. التركيز القادم: بناء الثقة في التحدث ضمن الأنشطة الجماعية.' },
    },
    {
      id: 'arabic', name: 'Arabic', nameAr: 'اللغة العربية', icon: 'pen-tool', tone: 'violet',
      teacher: 'Ms. Hala Nabil', teacherAr: 'أ. هالة نبيل', mastery: 82,
      daily: [
        { when: 'Today', whenAr: 'اليوم', date: 'Tue · Jun 24', dateAr: 'الثلاثاء · ٢٤ يونيو', lesson: 'حرف الميم', lessonAr: 'حرف الميم', desc: 'Wrote the letter م in its three positions and read 3 words.', descAr: 'كتب حرف الميم في مواضعه الثلاثة وقرأ ٣ كلمات.', understanding: 4, participation: 4, behavior: 5, homework: 'done', note: 'Handwriting is improving — neat strokes today.', noteAr: 'خطه يتحسّن — كتابة منظمة اليوم.' },
        { when: 'Yesterday', whenAr: 'أمس', date: 'Mon · Jun 23', dateAr: 'الإثنين · ٢٣ يونيو', lesson: 'الألوان', lessonAr: 'الألوان', desc: 'Named six colours and matched them to objects.', descAr: 'سمّى ستة ألوان وطابقها بالأشياء.', understanding: 5, participation: 4, behavior: 4, homework: 'done', note: 'Knew all the colours confidently.', noteAr: 'عرف كل الألوان بثقة.' },
      ],
      monthly: { understanding: 84, participation: 82, homework: 90, attendance: 98, dU: 4, dP: 6, dH: -2, dA: 0,
        skills: [ { en: 'Letter writing', ar: 'كتابة الحروف', v: 80 }, { en: 'Vocabulary', ar: 'المفردات', v: 88 }, { en: 'Listening', ar: 'الاستماع', v: 86 } ],
        summary: 'Good month in Arabic. Vocabulary is strong; we will keep practising letter formation at home.', summaryAr: 'شهر جيد في العربية. المفردات قوية، وسنواصل التدرّب على رسم الحروف في المنزل.' },
    },
    {
      id: 'math', name: 'Math', nameAr: 'الرياضيات', icon: 'calculator', tone: 'info',
      teacher: 'Ms. Sara Mahmoud', teacherAr: 'أ. سارة محمود', mastery: 79,
      daily: [
        { when: 'Today', whenAr: 'اليوم', date: 'Tue · Jun 24', dateAr: 'الثلاثاء · ٢٤ يونيو', lesson: 'Counting to 20', lessonAr: 'العد حتى ٢٠', desc: 'Counted objects up to 20 and ordered number cards.', descAr: 'عدّ الأشياء حتى ٢٠ ورتّب بطاقات الأرقام.', understanding: 4, participation: 4, behavior: 5, homework: 'none', note: 'Confident counting to 15, needs a little support 16–20.', noteAr: 'واثق في العد حتى ١٥، يحتاج دعمًا بسيطًا من ١٦–٢٠.' },
        { when: 'Yesterday', whenAr: 'أمس', date: 'Mon · Jun 23', dateAr: 'الإثنين · ٢٣ يونيو', lesson: 'Shapes — circle & square', lessonAr: 'الأشكال — دائرة ومربع', desc: 'Identified circles and squares around the classroom.', descAr: 'تعرّف على الدوائر والمربعات في الفصل.', understanding: 4, participation: 3, behavior: 4, homework: 'done', note: 'Enjoyed the shape hunt activity.', noteAr: 'استمتع بنشاط البحث عن الأشكال.' },
      ],
      monthly: { understanding: 80, participation: 78, homework: 88, attendance: 98, dU: 5, dP: 3, dH: 4, dA: 0,
        skills: [ { en: 'Counting', ar: 'العد', v: 82 }, { en: 'Shapes', ar: 'الأشكال', v: 86 }, { en: 'Patterns', ar: 'الأنماط', v: 72 } ],
        summary: 'Counting is developing nicely. We will introduce simple patterns next and reinforce numbers 16–20.', summaryAr: 'العد يتطور بشكل جيد. سنقدّم الأنماط البسيطة لاحقًا ونعزّز الأرقام ١٦–٢٠.' },
    },
    {
      id: 'art', name: 'Art & Music', nameAr: 'الفن والموسيقى', icon: 'palette', tone: 'amber',
      teacher: 'Ms. Hala Nabil', teacherAr: 'أ. هالة نبيل', mastery: 94,
      daily: [
        { when: 'Today', whenAr: 'اليوم', date: 'Tue · Jun 24', dateAr: 'الثلاثاء · ٢٤ يونيو', lesson: 'Finger Painting — Summer', lessonAr: 'الرسم بالأصابع — الصيف', desc: 'Created a sun and sea scene with finger paints.', descAr: 'رسم مشهد شمس وبحر بالأصابع.', understanding: 5, participation: 5, behavior: 5, homework: 'none', note: 'Wonderful creativity — proud of his painting!', noteAr: 'إبداع رائع — فخور بلوحته!' },
      ],
      monthly: { understanding: 95, participation: 96, homework: 100, attendance: 98, dU: 2, dP: 1, dH: 0, dA: 0,
        skills: [ { en: 'Creativity', ar: 'الإبداع', v: 96 }, { en: 'Fine motor', ar: 'المهارات الدقيقة', v: 90 }, { en: 'Rhythm', ar: 'الإيقاع', v: 92 } ],
        summary: 'A real strength for Yousef — expressive, creative and always engaged.', summaryAr: 'نقطة قوة حقيقية ليوسف — معبّر ومبدع ومتفاعل دائمًا.' },
    },
  ],
};
SUBJECTS_DATA.lina = SUBJECTS_DATA.yousef; // prototype: reuse for second child

/* ---------------- Events data (school-wide) ---------------- */
const EVENTS_DATA = {
  exams: [
    { subj: 'English', subjAr: 'اللغة الإنجليزية', icon: 'book-open', tone: 'teal', type: 'weekly', date: 'Sun · Jun 29', dateAr: 'الأحد · ٢٩ يونيو', time: '9:00 AM', timeAr: '٩:٠٠ ص', inDays: 5, topics: ['Letters M, N, O', 'Sight words'], topicsAr: ['حروف M, N, O', 'الكلمات البصرية'] },
    { subj: 'Math', subjAr: 'الرياضيات', icon: 'calculator', tone: 'info', type: 'monthly', date: 'Wed · Jul 2', dateAr: 'الأربعاء · ٢ يوليو', time: '9:45 AM', timeAr: '٩:٤٥ ص', inDays: 8, topics: ['Counting 1–20', 'Shapes'], topicsAr: ['العد ١–٢٠', 'الأشكال'] },
    { subj: 'Arabic', subjAr: 'اللغة العربية', icon: 'pen-tool', tone: 'violet', type: 'weekly', date: 'Thu · Jul 3', dateAr: 'الخميس · ٣ يوليو', time: '9:00 AM', timeAr: '٩:٠٠ ص', inDays: 9, topics: ['حرف الميم والنون', 'الألوان'], topicsAr: ['حرف الميم والنون', 'الألوان'] },
    { subj: 'General', subjAr: 'تقييم عام', icon: 'clipboard-check', tone: 'amber', type: 'final', date: 'Thu · Jul 10', dateAr: 'الخميس · ١٠ يوليو', time: '9:00 AM', timeAr: '٩:٠٠ ص', inDays: 16, topics: ['End-of-term assessment'], topicsAr: ['تقييم نهاية الفصل'] },
  ],
  celebrations: [
    { title: 'End-of-Year Concert', titleAr: 'حفل نهاية العام', icon: 'music', tone: 'amber', date: 'Sat · Jul 5', dateAr: 'السبت · ٥ يوليو', time: '11:00 AM', timeAr: '١١:٠٠ ص', inDays: 11, desc: "Children's play and songs on the main stage. Families are welcome to attend.", descAr: 'مسرحية وأغاني الأطفال على المسرح الرئيسي. الأهل مدعوون للحضور.', rsvp: true },
    { title: 'KG2 Graduation Day', titleAr: 'حفل تخرّج روضة ٢', icon: 'graduation-cap', tone: 'teal', date: 'Thu · Jul 10', dateAr: 'الخميس · ١٠ يوليو', time: '10:00 AM', timeAr: '١٠:٠٠ ص', inDays: 16, desc: 'Caps, certificates and a small celebration for our graduates.', descAr: 'قبّعات وشهادات واحتفال صغير لخريجينا.', rsvp: false },
    { title: 'Summer Fun Day', titleAr: 'يوم المرح الصيفي', icon: 'sun', tone: 'info', date: 'Mon · Jul 14', dateAr: 'الإثنين · ١٤ يوليو', time: '9:00 AM', timeAr: '٩:٠٠ ص', inDays: 20, desc: 'Water games, face painting and ice cream in the garden.', descAr: 'ألعاب مائية ورسم على الوجه وآيس كريم في الحديقة.', rsvp: false },
  ],
  trips: [
    { title: 'Aquarium Trip', titleAr: 'رحلة إلى الأكواريوم', place: 'Grand Aquarium', placeAr: 'الأكواريوم الكبير', icon: 'fish', tone: 'info', date: 'Mon · Jun 30', dateAr: 'الإثنين · ٣٠ يونيو', inDays: 6, price: 250, spots: 8, desc: 'A guided visit to see sea creatures. Lunch included.', descAr: 'زيارة مع مرشد لمشاهدة الكائنات البحرية. الغداء مشمول.', status: 'open' },
    { title: 'Public Garden Picnic', titleAr: 'نزهة الحديقة العامة', place: 'Al-Azhar Park', placeAr: 'حديقة الأزهر', icon: 'trees', tone: 'success', date: 'Thu · Jul 3', dateAr: 'الخميس · ٣ يوليو', inDays: 9, price: 0, spots: 14, desc: 'Outdoor play and a nature walk. Bring a hat!', descAr: 'لعب في الهواء الطلق وجولة في الطبيعة. أحضر قبعة!', status: 'open' },
    { title: 'Science Museum', titleAr: 'متحف العلوم', place: 'Children’s Science Museum', placeAr: 'متحف العلوم للأطفال', icon: 'flask-conical', tone: 'violet', date: 'Tue · Jul 8', dateAr: 'الثلاثاء · ٨ يوليو', inDays: 14, price: 180, spots: 3, desc: 'Hands-on experiments and a planetarium show.', descAr: 'تجارب عملية وعرض في القبة الفلكية.', status: 'registered' },
  ],
};

/* ---------------- Small helpers ---------------- */
function Rating({ value, max = 5, color = 'var(--amber-500)', size = 9 }) {
  return React.createElement('span', { style: { display: 'inline-flex', gap: 4, alignItems: 'center' } },
    Array.from({ length: max }).map((_, i) =>
      React.createElement('span', { key: i, style: { width: size, height: size, borderRadius: '50%', background: i < value ? color : 'var(--neutral-300)' } })));
}

function Meter({ label, value, color = 'var(--primary)', delta }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)' }}>{label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
          {delta != null && delta !== 0 && (
            <span style={{ fontSize: 10.5, fontWeight: 700, color: delta > 0 ? 'var(--success-700)' : 'var(--danger-700)' }}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}</span>
          )}
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{value}%</span>
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--neutral-200)', overflow: 'hidden' }}>
        <div style={{ width: value + '%', height: '100%', borderRadius: 'var(--radius-pill)', background: color }} />
      </div>
    </div>
  );
}

function SectionTitleA({ children }) {
  return <h3 style={{ margin: '22px 0 12px', fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: 'var(--tracking-snug)' }}>{children}</h3>;
}

/* ====================================================================
   SUBJECTS — list
   ==================================================================== */
function SubjectsScreen({ lang, child, onOpen }) {
  const ar = lang === 'ar';
  const subjects = SUBJECTS_DATA[child.id] || [];
  return (
    <div style={{ padding: '0 18px 20px' }}>
      <SectionTitleA>{ar ? 'المواد الدراسية' : 'Subjects'}</SectionTitleA>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {subjects.map(s => {
          const c = TONE_CA[s.tone];
          const last = s.daily[0];
          return (
            <Card key={s.id} padding="md" interactive onClick={() => onOpen(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <span style={{ width: 46, height: 46, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={s.icon} size={24} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? s.nameAr : s.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `آخر درس: ${last.lessonAr}` : `Last: ${last.lesson}`}</div>
                <div style={{ marginTop: 8, height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--neutral-200)', overflow: 'hidden' }}>
                  <div style={{ width: s.mastery + '%', height: '100%', background: c, borderRadius: 'var(--radius-pill)' }} />
                </div>
              </div>
              <div style={{ textAlign: 'center', flex: 'none' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: c, fontVariantNumeric: 'tabular-nums' }}>{s.mastery}%</div>
                <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ====================================================================
   SUBJECT DETAIL — Daily log + Monthly report tabs
   ==================================================================== */
function EvalRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{label}</span>
      <Rating value={value} />
    </div>
  );
}

function SubjectDetail({ lang, child, subjectId, onBack, onMessageTeacher }) {
  const ar = lang === 'ar';
  const s = (SUBJECTS_DATA[child.id] || []).find(x => x.id === subjectId);
  const [view, setView] = useStateA('daily');
  if (!s) return null;
  const c = TONE_CA[s.tone];
  const m = s.monthly;

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)', zIndex: 40, display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div style={{ padding: '46px 16px 0', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12 }}>
          <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}>
            <Icon name={ar ? 'arrow-right' : 'arrow-left'} size={20} color="var(--text-body)" />
          </button>
          <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={s.icon} size={21} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? s.nameAr : s.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? s.teacherAr : s.teacher}</div>
          </div>
          {onMessageTeacher && (
            <button onClick={() => onMessageTeacher(s.id)} title={ar ? 'مراسلة المعلّم' : 'Message teacher'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 13px', borderRadius: 'var(--radius-pill)', border: 'none', background: c, color: '#fff', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>
              <Icon name="message-circle" size={16} color="#fff" />{ar ? 'راسل' : 'Message'}
            </button>
          )}
        </div>
        <Tabs value={view} onChange={setView} items={[
          { value: 'daily', label: ar ? 'يومي' : 'Daily log' },
          { value: 'report', label: ar ? 'تقرير شهري' : 'Monthly report' },
        ]} />
      </div>

      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 18px 24px' }}>
        {view === 'daily' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 14 }}>
            {s.daily.map((d, i) => (
              <Card key={i} padding="md" accent={d.when ? c : null}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {d.when && <Badge tone={s.tone === 'violet' ? 'violet' : s.tone} solid>{ar ? d.whenAr : d.when}</Badge>}
                    <span style={{ fontSize: 12, color: 'var(--text-subtle)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? d.dateAr : d.date}</span>
                  </div>
                  {d.homework === 'done' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--success-700)' }}><Icon name="check" size={14} color="var(--success-500)" />{ar ? 'الواجب' : 'Homework'}</span>}
                </div>

                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? d.lessonAr : d.lesson}</div>
                <p style={{ margin: '5px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-body)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? d.descAr : d.desc}</p>

                {/* evaluation */}
                <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 1 }}>{ar ? 'تقييم المعلّم' : "Teacher's evaluation"}</div>
                  <EvalRow label={ar ? 'الفهم والاستيعاب' : 'Understanding'} value={d.understanding} />
                  <EvalRow label={ar ? 'التجاوب والمشاركة' : 'Participation'} value={d.participation} />
                  <EvalRow label={ar ? 'السلوك' : 'Behavior'} value={d.behavior} />
                </div>

                {/* teacher note */}
                <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Avatar name={ar ? s.teacherAr : s.teacher} size={30} />
                  <p style={{ margin: 0, flex: 1, fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-body)', fontStyle: 'italic', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>“{ar ? d.noteAr : d.note}”</p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {view === 'report' && (
          <div style={{ paddingTop: 14 }}>
            <Card padding="lg" accent={c}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تقرير شهر يونيو' : 'June progress report'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مقارنة بالشهر السابق' : 'Compared to last month'}</div>
                </div>
                <Badge tone="teal" solid style={{ flex: 'none' }}>{s.mastery}%</Badge>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Meter label={ar ? 'الفهم والاستيعاب' : 'Understanding'} value={m.understanding} delta={m.dU} color={c} />
                <Meter label={ar ? 'التجاوب والمشاركة' : 'Participation'} value={m.participation} delta={m.dP} color={c} />
                <Meter label={ar ? 'إنجاز الواجبات' : 'Homework'} value={m.homework} delta={m.dH} color={c} />
                <Meter label={ar ? 'الحضور' : 'Attendance'} value={m.attendance} delta={m.dA} color={c} />
              </div>
            </Card>

            <SectionTitleA>{ar ? 'المهارات' : 'Skills breakdown'}</SectionTitleA>
            <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {m.skills.map((sk, i) => <Meter key={i} label={ar ? sk.ar : sk.en} value={sk.v} color={c} />)}
            </Card>

            <SectionTitleA>{ar ? 'ملخّص المعلّم' : "Teacher's summary"}</SectionTitleA>
            <Card padding="md" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Avatar name={ar ? s.teacherAr : s.teacher} size={38} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? s.teacherAr : s.teacher}</div>
                <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--text-body)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? m.summaryAr : m.summary}</p>
              </div>
            </Card>

            <Button variant="secondary" fullWidth style={{ marginTop: 16 }} iconLeft={<Icon name="download" size={17} />}>{ar ? 'تحميل التقرير PDF' : 'Download report PDF'}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================================================================
   EVENTS — Exams / Celebrations / Trips
   ==================================================================== */
const EXAM_TYPE = {
  weekly: { en: 'Weekly', ar: 'أسبوعي', tone: 'info' },
  monthly: { en: 'Monthly', ar: 'شهري', tone: 'teal' },
  midterm: { en: 'Mid-term', ar: 'نصف الفصل', tone: 'amber' },
  final: { en: 'End of term', ar: 'نهاية الفصل', tone: 'danger' },
};

function InDays({ n, ar }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 50, padding: '6px 8px', borderRadius: 'var(--radius-md)', background: 'var(--teal-50)', flex: 'none' }}>
      <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--teal-700)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--teal-600)' }}>{ar ? 'يوم' : 'days'}</span>
    </span>
  );
}

function ExamsTab({ lang }) {
  const ar = lang === 'ar';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 14 }}>
      {EVENTS_DATA.exams.map((e, i) => {
        const c = TONE_CA[e.tone]; const t = EXAM_TYPE[e.type];
        return (
          <Card key={i} padding="md">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={e.icon} size={21} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? e.subjAr : e.subj}</span>
                  <Badge tone={t.tone}>{ar ? t.ar : t.en}</Badge>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 12.5, color: 'var(--text-muted)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}><Icon name="calendar" size={14} color="var(--text-subtle)" />{ar ? e.dateAr : e.date}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="clock" size={14} color="var(--text-subtle)" />{ar ? e.timeAr : e.time}</span>
                </div>
              </div>
              <InDays n={e.inDays} ar={ar} />
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 7 }}>{ar ? 'المنهج' : 'Topics'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(ar ? e.topicsAr : e.topics).map((tp, j) => <Badge key={j} tone="neutral">{tp}</Badge>)}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* RSVP attendee sheet */
const ATTENDEE_OPTS = [
  { v: 'child', iconN: 'baby', en: 'Child only', ar: 'الطفل وحده' },
  { v: 'father', iconN: 'user', en: 'With Father', ar: 'مع الأب' },
  { v: 'mother', iconN: 'user', en: 'With Mother', ar: 'مع الأم' },
  { v: 'both', iconN: 'users', en: 'Both parents', ar: 'الوالدان' },
];

function RSVPSheet({ lang, event, onClose, onConfirm }) {
  const ar = lang === 'ar';
  const [attendee, setAttendee] = useStateA('both');
  const [extraName, setExtraName] = useStateA('');
  const [extraRel, setExtraRel] = useStateA('');
  const [phone, setPhone] = useStateA('');
  const c = TONE_CA[event.tone];
  const inp = { width: '100%', padding: '11px 13px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };
  const lbl = { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)', marginBottom: 7, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 9999 }}>
      <div onClick={ev => ev.stopPropagation()} style={{ background: 'var(--surface-card)', width: '100%', borderRadius: '28px 28px 0 0', padding: '10px 22px 28px', maxHeight: '90%', overflowY: 'auto', animation: 'sheet .3s var(--ease-out)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ width: 44, height: 44, borderRadius: '50%', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={event.icon} size={23} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? event.titleAr : event.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? event.dateAr : event.date} · {ar ? event.timeAr : event.time}</div>
          </div>
        </div>
        <label style={lbl}>{ar ? 'مَن سيحضر الحفل؟' : 'Who will attend?'}</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 18 }}>
          {ATTENDEE_OPTS.map(o => {
            const on = attendee === o.v;
            return (
              <button key={o.v} onClick={() => setAttendee(o.v)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? c : 'var(--border-subtle)'}`, background: on ? `color-mix(in srgb, ${c} 10%, transparent)` : 'var(--surface-card)', cursor: 'pointer' }}>
                <Icon name={o.iconN} size={18} color={on ? c : 'var(--text-subtle)'} />
                <span style={{ fontSize: 13, fontWeight: 700, color: on ? c : 'var(--text-body)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? o.ar : o.en}</span>
              </button>
            );
          })}
        </div>
        <label style={lbl}>{ar ? 'ضيف إضافي؟ (اختياري)' : 'Additional guest? (optional)'}</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 18 }}>
          <input type="text" value={extraName} onChange={e => setExtraName(e.target.value)} placeholder={ar ? 'الاسم' : 'Name'} style={inp} />
          <input type="text" value={extraRel} onChange={e => setExtraRel(e.target.value)} placeholder={ar ? 'الصلة' : 'Relation'} style={inp} />
        </div>
        <label style={lbl}>{ar ? 'رقم للتواصل يوم الحفل' : 'Contact number on event day'}</label>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XX XXX XXXX" style={{ ...inp, fontFamily: 'var(--font-mono)', marginBottom: 22, letterSpacing: '.04em' }} />
        <button onClick={() => onConfirm({ attendee, extraName, extraRel, phone })} style={{ width: '100%', padding: '14px', background: c, color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="check" size={18} color="white" />{ar ? 'تأكيد الحضور' : 'Confirm attendance'}
        </button>
      </div>
    </div>
  );
}

function CelebrationsTab({ lang }) {
  const ar = lang === 'ar';
  const [rsvps, setRsvps] = useStateA({});
  const [formFor, setFormFor] = useStateA(null);
  const confirm = (ev, data) => { setRsvps(prev => ({ ...prev, [ev.title]: data })); setFormFor(null); };
  const attLabel = (data) => {
    if (!data) return '';
    const opt = ATTENDEE_OPTS.find(o => o.v === data.attendee);
    const base = opt ? (ar ? opt.ar : opt.en) : '';
    return data.extraName ? `${base} + ${data.extraName}` : base;
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 14 }}>
      {EVENTS_DATA.celebrations.map((e, i) => {
        const c = TONE_CA[e.tone];
        const confirmed = rsvps[e.title];
        return (
          <Card key={i} padding="none" style={{ overflow: 'hidden' }}>
            <div style={{ height: 78, background: `linear-gradient(135deg, color-mix(in srgb, ${c} 22%, transparent), color-mix(in srgb, ${c} 8%, transparent))`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px' }}>
              <span style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--surface-card)', color: c, display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}><Icon name={e.icon} size={26} /></span>
              <InDays n={e.inDays} ar={ar} />
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? e.titleAr : e.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 12.5, color: 'var(--text-muted)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}><Icon name="calendar" size={14} color="var(--text-subtle)" />{ar ? e.dateAr : e.date}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="clock" size={14} color="var(--text-subtle)" />{ar ? e.timeAr : e.time}</span>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-body)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? e.descAr : e.desc}</p>
              {e.rsvp && (
                confirmed ? (
                  <div style={{ marginTop: 14, padding: '11px 14px', borderRadius: 'var(--radius-md)', background: 'var(--success-50)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon name="circle-check-big" size={20} color="var(--success-600)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--success-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تم تأكيد الحضور' : 'Attendance confirmed'}</div>
                      <div style={{ fontSize: 12, color: 'var(--success-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{attLabel(confirmed)}</div>
                    </div>
                    <button onClick={() => setRsvps(prev => { const n = {...prev}; delete n[e.title]; return n; })} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تعديل' : 'Edit'}</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button onClick={() => setFormFor(e)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: c, color: 'white', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                      <Icon name="check" size={16} color="white" />{ar ? 'سأحضر' : 'Attending'}
                    </button>
                    <button style={{ padding: '11px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'flex', alignItems: 'center', gap: 6, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>
                      <Icon name="bell" size={15} color="var(--text-subtle)" />{ar ? 'تذكير' : 'Remind'}
                    </button>
                  </div>
                )
              )}
            </div>
          </Card>
        );
      })}
      {formFor && <RSVPSheet lang={lang} event={formFor} onClose={() => setFormFor(null)} onConfirm={(data) => confirm(formFor, data)} />}
    </div>
  );
}

function TripCard({ e, lang }) {
  const ar = lang === 'ar';
  const c = TONE_CA[e.tone];
  const free = e.price === 0;
  const [status, setStatus] = useStateA(e.status);
  const [payMethod, setPayMethod] = useStateA(null);
  const [showPay, setShowPay] = useStateA(false);
  const [showInv, setShowInv] = useStateA(false);
  const registered = status === 'registered';

  const tripPayItem = { id: e.id, en: e.title, ar: e.titleAr, subEn: e.date, subAr: e.dateAr, amount: e.price, icon: e.icon, tone: e.tone };

  return (
    <Card padding="md">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ width: 46, height: 46, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={e.icon} size={24} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? e.titleAr : e.title}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 3, fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}><Icon name="map-pin" size={14} color="var(--text-subtle)" />{ar ? e.placeAr : e.place}</div>
        </div>
        {free
          ? <Badge tone="success" solid>{ar ? 'مجانًا' : 'Free'}</Badge>
          : <span style={{ textAlign: ar ? 'left' : 'right', flex: 'none' }}><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{e.price}</div><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)' }}>EGP</div></span>}
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--text-body)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? e.descAr : e.desc}</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, fontSize: 12.5, color: 'var(--text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}><Icon name="calendar" size={14} color="var(--text-subtle)" />{ar ? e.dateAr : e.date}</span>
        {!registered && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: e.spots <= 3 ? 'var(--amber-700)' : 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}><Icon name="users" size={14} />{ar ? `${e.spots} مقاعد متبقية` : `${e.spots} spots left`}</span>}
      </div>

      <div style={{ marginTop: 14 }}>
        {registered ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 'var(--radius-md)', background: 'var(--success-50)', marginBottom: free ? 0 : 10 }}>
              <Icon name="circle-check-big" size={20} color="var(--success-600)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--success-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{free ? (ar ? 'مسجّل — الطفل فقط' : 'Registered — child only') : (ar ? 'تم التسجيل والدفع' : 'Registered & paid')}</div>
                {payMethod && (() => { const pm = window.PAY_METHODS && window.PAY_METHODS.find(x => x.id === payMethod); return pm ? <div style={{ fontSize: 11.5, color: 'var(--success-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? pm.ar : pm.en}</div> : null; })()}
              </div>
            </div>
            {!free && (
              <button onClick={() => setShowInv(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', cursor: 'pointer' }}>
                <Icon name="receipt" size={17} color="var(--primary)" />{ar ? 'عرض الفاتورة وتحميلها' : 'View & download invoice'}
              </button>
            )}
          </div>
        ) : free ? (
          <button onClick={() => setStatus('registered')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--teal-600)', color: 'white', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            <Icon name="user-plus" size={18} color="white" />{ar ? 'سجّل طفلي' : 'Register child'}
          </button>
        ) : (
          <button onClick={() => setShowPay(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--amber-500)', color: '#1C1C1A', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            <Icon name="credit-card" size={18} color="#1C1C1A" />{ar ? `اشترك · ${e.price} ج.م` : `Register · ${e.price} EGP`}
          </button>
        )}
      </div>

      {showPay && (() => { const PF = window.PayFlow; return PF ? <PF lang={lang} item={tripPayItem} onClose={() => setShowPay(false)} onPaid={(id) => { setStatus('registered'); setPayMethod('bank'); setShowPay(false); }} /> : null; })()}
      {showInv && <TripInvoiceSheet lang={lang} trip={e} payMethod={payMethod} onClose={() => setShowInv(false)} />}
    </Card>
  );
}

function TripInvoiceSheet({ lang, trip, payMethod, onClose }) {
  const ar = lang === 'ar';
  const invNo = 'MSR-TRIP-' + trip.id.toUpperCase().replace(/-/g,'') + '-' + String(Date.now()).slice(-4);
  const pm = window.PAY_METHODS && window.PAY_METHODS.find(x => x.id === payMethod);
  const [downloaded, setDownloaded] = useStateA(false);
  const download = () => {
    const fn = window.openPrintableInvoice;
    if (fn) {
      fn({
        ar,
        title: ar ? `${trip.titleAr} — فاتورة رحلة` : `${trip.title} — Trip invoice`,
        invNo,
        meta: [
          [ar ? 'الوجهة' : 'Place', ar ? trip.placeAr : trip.place],
          [ar ? 'التاريخ' : 'Date', ar ? trip.dateAr : trip.date],
        ],
        lines: [{ label: ar ? 'رسوم الرحلة' : 'Trip fee', amount: trip.price }],
        total: trip.price,
        methodLabel: pm ? (ar ? pm.ar : pm.en) : null,
      });
    }
    setDownloaded(true); setTimeout(()=>setDownloaded(false),1600);
  };
  const rows = [
    [ar ? 'رقم الفاتورة' : 'Invoice no.', invNo, true],
    [ar ? 'الرحلة' : 'Trip', ar ? trip.titleAr : trip.title, false],
    [ar ? 'الوجهة' : 'Place', ar ? trip.placeAr : trip.place, false],
    [ar ? 'التاريخ' : 'Date', ar ? trip.dateAr : trip.date, false],
    [ar ? 'طريقة الدفع' : 'Method', pm ? (ar ? pm.ar : pm.en) : '-', false],
  ];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 9999 }}>
      <div onClick={ev => ev.stopPropagation()} style={{ background: 'var(--surface-card)', width: '100%', borderRadius: '28px 28px 0 0', padding: '10px 22px 28px', animation: 'sheet .3s var(--ease-out)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>{ar ? 'فاتورة الرحلة' : 'Trip invoice'}</span>
          <Badge tone="success" dot>{ar ? 'مدفوعة' : 'Paid'}</Badge>
        </div>
        {rows.map(([label, val, mono], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', fontFamily: mono ? 'var(--font-mono)' : ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{val}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 15px', margin: '14px 0 18px', borderRadius: 'var(--radius-md)', background: 'var(--teal-50)' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--teal-800)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'الإجمالي المدفوع' : 'Total paid'}</span>
          <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--teal-800)', fontFamily: 'var(--font-mono)' }}>{trip.price} EGP</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14, fontWeight: 700, color: 'var(--text-body)', cursor: 'pointer' }}>{ar ? 'إغلاق' : 'Close'}</button>
          <button onClick={download} style={{ flex: 2, padding: '12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--primary)', color: 'white', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <Icon name={downloaded ? 'check' : 'download'} size={17} color="white" />{downloaded ? (ar ? 'تم التحميل' : 'Downloaded') : (ar ? 'تحميل الفاتورة' : 'Download invoice')}
          </button>
        </div>
      </div>
    </div>
  );
}

function EventsScreen({ lang }) {
  const ar = lang === 'ar';
  const [view, setView] = useStateA('exams');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '6px 18px 0', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <Tabs value={view} onChange={setView} items={[
          { value: 'exams', label: ar ? 'الامتحانات' : 'Exams', count: EVENTS_DATA.exams.length },
          { value: 'celebrations', label: ar ? 'الحفلات' : 'Celebrations', count: EVENTS_DATA.celebrations.length },
          { value: 'trips', label: ar ? 'الرحلات' : 'Trips', count: EVENTS_DATA.trips.length },
        ]} />
      </div>
      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 18px 24px' }}>
        {view === 'exams' && <ExamsTab lang={lang} />}
        {view === 'celebrations' && <CelebrationsTab lang={lang} />}
        {view === 'trips' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 14 }}>
            {EVENTS_DATA.trips.map((e, i) => <TripCard key={i} e={e} lang={lang} />)}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SubjectsScreen, SubjectDetail, EventsScreen });
