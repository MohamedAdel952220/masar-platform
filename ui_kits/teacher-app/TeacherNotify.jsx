const { useState: useStateN } = React;
const VIOLET_N = 'var(--role-teacher)';

/* ====================================================================
   Masar — Teacher App · Lesson edit flow + Notification center
   Loaded after masar-ui.jsx + TeacherRequests.jsx, before TeacherApp.jsx.
   ==================================================================== */

/* --------------------------------------------------------------------
   LESSON EDIT SHEET
   Flow: the SUBJECT TEACHER of the class currently in session edits
   today's lesson. What they save becomes the lesson line in every
   present student's daily report — which is what parents see.
   -------------------------------------------------------------------- */
function LessonEditSheet({ lang, lesson, klass, onClose, onSave }) {
  const ar = lang === 'ar';
  const [titleEn, setTitleEn] = useStateN(lesson.en);
  const [titleAr, setTitleAr] = useStateN(lesson.ar);
  const [covered, setCovered] = useStateN(lesson.covered || '');
  const [coveredAr, setCoveredAr] = useStateN(lesson.coveredAr || '');
  const [objective, setObjective] = useStateN(lesson.objective || '');
  const [objectiveAr, setObjectiveAr] = useStateN(lesson.objectiveAr || '');

  const field = { width: '100%', padding: '11px 14px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };
  const area = { ...field, minHeight: 70, resize: 'none', lineHeight: 1.5 };

  const save = () => onSave({ en: titleEn.trim() || lesson.en, ar: titleAr.trim() || lesson.ar, covered: covered.trim(), coveredAr: coveredAr.trim(), objective: objective.trim(), objectiveAr: objectiveAr.trim() });

  /* who-edits + flow stepper */
  const Step = ({ n, icon, label, on, last }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 'none' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 'var(--radius-pill)', background: on ? '#EDE8F8' : 'var(--surface-raised)', border: `1px solid ${on ? 'color-mix(in srgb, var(--role-teacher) 30%, transparent)' : 'var(--border-subtle)'}` }}>
        <Icon name={icon} size={13} color={on ? VIOLET_N : 'var(--text-subtle)'} />
        <span style={{ fontSize: 11, fontWeight: 700, color: on ? VIOLET_N : 'var(--text-subtle)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{label}</span>
      </span>
      {!last && <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={13} color="var(--text-subtle)" />}
    </div>
  );

  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: '#EDE8F8', color: VIOLET_N, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="book-open" size={22} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تعديل درس اليوم' : "Edit today's lesson"}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{klass ? (ar ? klass.nameAr : klass.name) : (ar ? 'روضة ٢ · دوّار الشمس' : 'KG2 · Sunflower')}</div>
        </div>
      </div>

      {/* who edits */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', marginBottom: 12 }}>
        <Avatar name="Ms. Sara Mahmoud" size={30} />
        <span style={{ fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.45, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'أنتِ معلّمة المادة لهذه الحصة — التعديل يخصّ هذا الفصل فقط.' : 'You are the subject teacher for this session — edits apply to this class only.'}</span>
      </div>

      {/* flow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', padding: '2px 0 14px', marginBottom: 4 }}>
        <Step n={1} icon="pencil" label={ar ? 'تكتبه أنتِ' : 'You set it'} on />
        <Step n={2} icon="clipboard-pen" label={ar ? 'يُربط بالتقييم' : 'Into evals'} on />
        <Step n={3} icon="send" label={ar ? 'يصل للأهل' : 'To parents'} on last />
      </div>

      {/* title */}
      <Field label={ar ? 'عنوان الدرس (إنجليزي)' : 'Lesson title (English)'}>
        <input type="text" value={titleEn} onChange={e => setTitleEn(e.target.value)} placeholder="e.g. Letter Sounds — M" style={field} />
      </Field>
      <Field label={ar ? 'عنوان الدرس (عربي)' : 'Lesson title (Arabic)'}>
        <input type="text" value={titleAr} onChange={e => setTitleAr(e.target.value)} placeholder="مثال: أصوات الحروف — حرف M" style={{ ...field, fontFamily: 'var(--font-arabic)' }} dir="rtl" />
      </Field>

      {/* what was covered */}
      <Field label={ar ? 'ماذا تم في الحصة' : 'What was covered'}>
        <textarea value={ar ? coveredAr : covered} onChange={e => ar ? setCoveredAr(e.target.value) : setCovered(e.target.value)} placeholder={ar ? 'وصف موجز يظهر للأهل في تقرير اليوم…' : "A short description parents see in today's report…"} style={area} />
      </Field>

      {/* objective */}
      <Field label={ar ? 'هدف التعلّم (اختياري)' : 'Learning objective (optional)'}>
        <input type="text" value={ar ? objectiveAr : objective} onChange={e => ar ? setObjectiveAr(e.target.value) : setObjective(e.target.value)} placeholder={ar ? 'مثال: تمييز صوت الحرف' : 'e.g. Recognise the letter sound'} style={field} />
      </Field>

      {/* live preview of the parent-facing line */}
      <div style={{ marginTop: 4, marginBottom: 16, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-strong)', background: 'var(--bg-sunken)' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: 7 }}>{ar ? 'كما سيظهر للأهل' : 'How parents will see it'}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: 'color-mix(in srgb, var(--teal-600) 12%, transparent)', color: 'var(--teal-600)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="book-open" size={16} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{(ar ? titleAr : titleEn) || (ar ? lesson.ar : lesson.en)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.45, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{(ar ? coveredAr : covered) || (ar ? 'وصف الحصة سيظهر هنا' : 'Lesson description will appear here')}</div>
          </div>
        </div>
      </div>

      <Button variant="primary" fullWidth size="lg" style={{ background: VIOLET_N }} iconLeft={<Icon name="check" size={18} />} onClick={save}>{ar ? 'حفظ الدرس' : 'Save lesson'}</Button>
    </Sheet>
  );
}

/* --------------------------------------------------------------------
   NOTIFICATION CENTER (generic — used by teacher & parent apps)
   -------------------------------------------------------------------- */
function NotifPanel({ lang, title, groups, onPick, onClose, accent }) {
  const ar = lang === 'ar';
  const tone = c => c === 'success' ? ['var(--success-50)', 'var(--success-600)'] : c === 'amber' ? ['var(--amber-50)', 'var(--amber-600)'] : c === 'danger' ? ['var(--danger-50)', 'var(--danger-600)'] : c === 'teal' ? ['var(--teal-50)', 'var(--teal-600)'] : c === 'violet' ? ['#EDE8F8', 'var(--role-teacher)'] : ['var(--info-50)', 'var(--info-600)'];
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', zIndex: 65, display: 'flex', flexDirection: 'column' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-app)', borderRadius: '0 0 24px 24px', maxHeight: '82%', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '44px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Icon name="bell" size={20} color={accent || VIOLET_N} />
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{title}</span>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="x" size={18} color="var(--text-body)" /></button>
        </div>
        <div className="scroll" style={{ overflowY: 'auto', padding: '8px 16px 22px' }}>
          {groups.map((g, gi) => (
            <div key={gi}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-subtle)', margin: '14px 4px 8px', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? g.labelAr : g.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.items.map((n, i) => {
                  const [bg, fg] = tone(n.tone);
                  return (
                    <button key={i} onClick={() => onPick(n)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', padding: '12px 13px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', background: n.unread ? 'var(--surface-card)' : 'var(--surface-raised)', cursor: 'pointer', textAlign: 'start', position: 'relative' }}>
                      <span style={{ width: 38, height: 38, borderRadius: '50%', background: bg, color: fg, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={n.icon} size={19} /></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? n.titleAr : n.title}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', flex: 'none' }}>{n.t}</span>
                        </span>
                        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? n.msgAr : n.msg}</span>
                      </span>
                      {n.unread && <span style={{ position: 'absolute', top: 14, insetInlineEnd: 12, width: 8, height: 8, borderRadius: '50%', background: accent || VIOLET_N }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Teacher notification feed (routes to tabs/sheets) */
function teacherNotifs() {
  return [
    {
      label: 'Today', labelAr: 'اليوم', items: [
        { icon: 'circle-check-big', tone: 'success', unread: true, t: '8:05', title: 'Weekly Quiz approved', titleAr: 'تمت الموافقة على الاختبار الأسبوعي', msg: 'Admin approved “English — Weekly Quiz” for Sun, Jun 29.', msgAr: 'وافقت الإدارة على «إنجليزي — اختبار أسبوعي» الأحد ٢٩ يونيو.', go: { tab: 'requests' } },
        { icon: 'message-circle', tone: 'teal', unread: true, t: '9:32', title: 'New message · Mr. Adel', titleAr: 'رسالة جديدة · أ. عادل', msg: 'About Yousef before Math class.', msgAr: 'بخصوص يوسف قبل حصة الرياضيات.', go: { chat: 'c1' } },
        { icon: 'clipboard-list', tone: 'amber', unread: true, t: '10:10', title: '4 students to evaluate', titleAr: '٤ طلاب بانتظار التقييم', msg: 'Sunflower class — finish today’s evaluations.', msgAr: 'فصل دوّار الشمس — أكملي تقييمات اليوم.', go: { tab: 'roster' } },
      ],
    },
    {
      label: 'Earlier', labelAr: 'سابقًا', items: [
        { icon: 'shield-alert', tone: 'danger', t: 'Yesterday', title: 'Chat escalated to admin', titleAr: 'تم تصعيد محادثة للإدارة', msg: "Mrs. Hoda's conversation about Malak was escalated.", msgAr: 'تم تصعيد محادثة أ. هدى بخصوص ملك.', go: { chat: 'c2' } },
        { icon: 'circle-x', tone: 'danger', t: 'Mon', title: 'Reading Corner not approved', titleAr: 'لم تتم الموافقة على ركن القراءة', msg: 'Clashes with graduation rehearsal.', msgAr: 'يتعارض مع بروفة التخرّج.', go: { tab: 'requests' } },
        { icon: 'calendar-clock', tone: 'info', t: 'Sun', title: 'Mid-term dates published', titleAr: 'نُشرت مواعيد نصف العام', msg: 'School set mid-term exams for Jul 13–17.', msgAr: 'حدّدت المدرسة امتحانات نصف العام ١٣–١٧ يوليو.', go: null },
      ],
    },
  ];
}

Object.assign(window, { LessonEditSheet, NotifPanel, teacherNotifs });
