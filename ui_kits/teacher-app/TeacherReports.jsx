const { useState: useStateT } = React;
const VIOLET_T = 'var(--role-teacher)';

/* ====================================================================
   Masar — Teacher App · Reports, AI assist & Concerns
   Loaded after masar-ui.jsx, before TeacherApp.jsx.
   ==================================================================== */

/* ---------------- AI helpers (graceful fallback) ---------------- */
async function aiComplete(prompt) {
  try {
    if (window.claude && window.claude.complete) {
      const t = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
      return (t || '').trim();
    }
  } catch (e) { /* fall through */ }
  return null;
}

async function aiPolishNote({ student, lesson, ratings, raw, lang }) {
  const ar = lang === 'ar';
  const prompt = `You are helping a kindergarten teacher write a short, warm, specific note for a parent about their child's day.
Child: ${student}. Lesson: ${lesson}.
Teacher ratings out of 5 — understanding ${ratings.u}, participation ${ratings.p}, behavior ${ratings.b}.
Teacher's rough note: "${raw || '(none)'}".
Write 2 short sentences, warm and concrete, ${ar ? 'in Arabic' : 'in English'}. No greeting, no sign-off, no quotes. Address the parent about the child by first name.`;
  const out = await aiComplete(prompt);
  if (out) return out;
  // fallback template
  const fn = student.split(' ')[0];
  if (ar) return `أظهر ${fn} تفاعلًا جيدًا في درس «${lesson}» اليوم. ${ratings.b >= 4 ? 'سلوكه كان رائعًا وتعاون مع زملائه.' : 'نعمل على تعزيز التركيز خلال النشاط.'}`;
  return `${fn} engaged well in today's "${lesson}" lesson. ${ratings.b >= 4 ? 'Behavior was lovely and ${fn} cooperated nicely with friends.'.replace('${fn}', fn) : 'We are gently working on focus during the activity.'}`;
}

async function aiDraftReport({ student, subject, m, lang }) {
  const ar = lang === 'ar';
  const prompt = `You are a kindergarten ${subject} teacher writing a brief monthly progress summary for a parent.
Child: ${student}. Month: June.
Averages out of 100 — understanding ${m.understanding}, participation ${m.participation}, homework ${m.homework}, attendance ${m.attendance}.
Write 3 sentences ${ar ? 'in Arabic' : 'in English'}: 1) overall progress, 2) a clear strength, 3) one gentle next-step focus. Warm, professional, no greeting/sign-off/quotes.`;
  const out = await aiComplete(prompt);
  if (out) return out;
  const fn = student.split(' ')[0];
  if (ar) return `حقّق ${fn} تقدمًا جيدًا في ${subject} هذا الشهر بمستوى فهم ${m.understanding}%. نقطة قوته الواضحة هي ${m.participation >= 85 ? 'المشاركة النشطة في الأنشطة الجماعية' : 'الالتزام بإنجاز الواجبات'}. التركيز القادم: ${m.understanding < 85 ? 'تعزيز الاستيعاب من خلال التكرار اللطيف في المنزل' : 'بناء الثقة في التعبير أمام المجموعة'}.`;
  return `${fn} has made good progress in ${subject} this month, with an understanding level of ${m.understanding}%. A clear strength is ${m.participation >= 85 ? 'active participation in group activities' : 'consistency with homework'}. Next focus: ${m.understanding < 85 ? 'reinforcing comprehension with gentle practice at home' : 'building confidence speaking in front of the group'}.`;
}

/* ---------------- Interactive rating ---------------- */
function RatingInput({ value, onChange, color = 'var(--amber-500)' }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => onChange(n)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: n <= value ? color : 'var(--neutral-200)', transition: 'background .12s' }} aria-label={'rate ' + n} />
      ))}
    </div>
  );
}

/* ---------------- Concern categories ---------------- */
const CONCERN_CATS = [
  { v: 'academic', en: 'Academic', ar: 'دراسي', icon: 'book-open' },
  { v: 'behavior', en: 'Behavior', ar: 'سلوكي', icon: 'message-circle-warning' },
  { v: 'social', en: 'Social', ar: 'اجتماعي', icon: 'users' },
  { v: 'health', en: 'Health', ar: 'صحي', icon: 'heart-pulse' },
];
const CONCERN_LEVELS = [
  { v: 'info', en: 'For your info', ar: 'للعلم', tone: 'info' },
  { v: 'attention', en: 'Needs attention', ar: 'يحتاج انتباه', tone: 'amber' },
  { v: 'urgent', en: 'Urgent', ar: 'عاجل', tone: 'danger' },
];

/* ====================================================================
   STUDENT EVALUATION SHEET (enriched — matches parent's daily log)
   ==================================================================== */
function StudentEvalSheet({ lang, student, lesson, onClose, onFlag }) {
  const ar = lang === 'ar';
  const [u, setU] = useStateT(student.eval === 'done' ? 5 : 4);
  const [p, setP] = useStateT(student.part === 'high' ? 5 : student.part === 'mid' ? 3 : student.part === 'low' ? 2 : 4);
  const [b, setB] = useStateT(5);
  const [hw, setHw] = useStateT('done');
  const [note, setNote] = useStateT('');
  const [busy, setBusy] = useStateT(false);

  const polish = async () => {
    setBusy(true);
    const out = await aiPolishNote({ student: student.name, lesson, ratings: { u, p, b }, raw: note, lang });
    setNote(out);
    setBusy(false);
  };

  const rowLabel = { fontSize: 13, fontWeight: 700, color: 'var(--text-body)' };
  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Avatar name={student.name} size={48} status="present" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{student.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تقييم فردي' : 'Individual evaluation'}</div>
        </div>
        <button onClick={() => onFlag(student)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--danger-200)', background: 'var(--danger-50)', color: 'var(--danger-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          <Icon name="flag" size={14} />{ar ? 'مشكلة' : 'Flag'}
        </button>
      </div>

      {/* lesson */}
      <Field label={ar ? 'درس اليوم' : "Today's lesson"}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)' }}>
          <Icon name="book-open" size={17} color={VIOLET_T} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{lesson}</span>
        </div>
      </Field>

      {/* three ratings — match parent's daily log */}
      <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={rowLabel}>{ar ? 'الفهم والاستيعاب' : 'Understanding'}</span><RatingInput value={u} onChange={setU} /></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={rowLabel}>{ar ? 'التجاوب والمشاركة' : 'Participation'}</span><RatingInput value={p} onChange={setP} /></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={rowLabel}>{ar ? 'السلوك' : 'Behavior'}</span><RatingInput value={b} onChange={setB} /></div>
      </div>

      {/* homework */}
      <Field label={ar ? 'الواجب' : 'Homework'}>
        <Segment options={[['done', ar ? 'تم' : 'Done'], ['partial', ar ? 'جزئي' : 'Partial'], ['none', ar ? 'لا يوجد' : 'None']]} value={hw} onChange={setHw} />
      </Field>

      {/* note + AI assist */}
      <Field label={ar ? 'ملاحظة للأهل' : 'Note to parent'}>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={ar ? 'اكتب ملاحظة سريعة، ثم نسّقها بالذكاء الاصطناعي…' : 'Jot a quick note, then polish it with AI…'} style={{ width: '100%', minHeight: 78, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '11px 14px', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14, color: 'var(--text-strong)', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }} />
        <button onClick={polish} disabled={busy} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: '1px solid ' + VIOLET_T, background: '#EDE8F8', color: VIOLET_T, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          <Icon name={busy ? 'loader' : 'sparkles'} size={15} />{busy ? (ar ? 'جاري الصياغة…' : 'Writing…') : (ar ? 'نسّق بالذكاء الاصطناعي' : 'Polish with AI')}
        </button>
      </Field>

      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <Button variant="secondary" iconLeft={<Icon name="image" size={17} />}>{ar ? 'وسائط' : 'Media'}</Button>
        <Button variant="primary" fullWidth style={{ background: VIOLET_T }} iconLeft={<Icon name="check" size={17} />} onClick={onClose}>{ar ? 'حفظ التقييم' : 'Save evaluation'}</Button>
      </div>
    </Sheet>
  );
}

/* ====================================================================
   FLAG A CONCERN SHEET
   ==================================================================== */
function ConcernSheet({ lang, student, onClose, onSend }) {
  const ar = lang === 'ar';
  const [cat, setCat] = useStateT('behavior');
  const [level, setLevel] = useStateT('attention');
  const [msg, setMsg] = useStateT('');

  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--danger-50)', color: 'var(--danger-600)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="flag" size={22} /></span>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'رفع ملاحظة للأهل' : 'Raise a concern'}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{student ? student.name : ''}</div>
        </div>
      </div>

      <Field label={ar ? 'النوع' : 'Category'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {CONCERN_CATS.map(c => {
            const on = cat === c.v;
            return (
              <button key={c.v} onClick={() => setCat(c.v)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? VIOLET_T : 'var(--border-subtle)'}`, background: on ? '#EDE8F8' : 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
                <Icon name={c.icon} size={18} color={on ? VIOLET_T : 'var(--text-subtle)'} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: on ? VIOLET_T : 'var(--text-body)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? c.ar : c.en}</span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label={ar ? 'مستوى الأهمية' : 'Priority'}>
        <div style={{ display: 'flex', gap: 8 }}>
          {CONCERN_LEVELS.map(l => {
            const on = level === l.v;
            const c = l.tone === 'danger' ? 'var(--danger-500)' : l.tone === 'amber' ? 'var(--amber-500)' : 'var(--info-500)';
            return (
              <button key={l.v} onClick={() => setLevel(l.v)} style={{ flex: 1, height: 42, borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? c : 'var(--border-subtle)'}`, background: on ? `color-mix(in srgb, ${c} 12%, transparent)` : 'var(--surface-card)', color: on ? c : 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '0 6px' }}>{ar ? l.ar : l.en}</button>
            );
          })}
        </div>
      </Field>

      <Field label={ar ? 'الرسالة' : 'Message'}>
        <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder={ar ? 'اشرح الملاحظة للأهل بوضوح ولطف…' : 'Describe the concern for the parent, clearly and kindly…'} style={{ width: '100%', minHeight: 88, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '11px 14px', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14, color: 'var(--text-strong)', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }} />
      </Field>

      <Button variant="primary" fullWidth style={{ background: VIOLET_T, marginTop: 4 }} iconLeft={<Icon name="send" size={17} />} onClick={() => onSend({ student, cat, level, msg })}>{ar ? 'إرسال للأهل' : 'Send to parent'}</Button>
    </Sheet>
  );
}

/* ====================================================================
   REPORTS SCREEN — monthly report drafting with AI
   ==================================================================== */
const REPORT_STUDENTS = [
  { id: 1, name: 'Yousef Adel', m: { understanding: 90, participation: 86, homework: 95, attendance: 98 }, status: 'ready' },
  { id: 2, name: 'Lina Hassan', m: { understanding: 88, participation: 92, homework: 90, attendance: 96 }, status: 'ready' },
  { id: 4, name: 'Malak Tarek', m: { understanding: 74, participation: 70, homework: 80, attendance: 92 }, status: 'draft' },
  { id: 6, name: 'Jana Mostafa', m: { understanding: 95, participation: 90, homework: 100, attendance: 99 }, status: 'ready' },
  { id: 7, name: 'Ali Hossam', m: { understanding: 68, participation: 64, homework: 72, attendance: 88 }, status: 'draft' },
];

function ReportDraftSheet({ lang, subject, student, onClose, onSend }) {
  const ar = lang === 'ar';
  const [text, setText] = useStateT('');
  const [busy, setBusy] = useStateT(false);
  const m = student.m;

  const draft = async () => {
    setBusy(true);
    const out = await aiDraftReport({ student: student.name, subject, m, lang });
    setText(out);
    setBusy(false);
  };

  const Meter = ({ label, v }) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}><span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{label}</span><span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{v}%</span></div>
      <div style={{ height: 7, borderRadius: 'var(--radius-pill)', background: 'var(--neutral-200)', overflow: 'hidden' }}><div style={{ width: v + '%', height: '100%', background: VIOLET_T, borderRadius: 'var(--radius-pill)' }} /></div>
    </div>
  );

  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Avatar name={student.name} size={48} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{student.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `تقرير ${subject} — يونيو` : `${subject} report — June`}</div>
        </div>
      </div>

      <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <Meter label={ar ? 'الفهم' : 'Understanding'} v={m.understanding} />
        <Meter label={ar ? 'المشاركة' : 'Participation'} v={m.participation} />
        <Meter label={ar ? 'الواجبات' : 'Homework'} v={m.homework} />
        <Meter label={ar ? 'الحضور' : 'Attendance'} v={m.attendance} />
      </div>

      <Field label={ar ? 'ملخّص التقرير' : 'Report summary'}>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder={ar ? 'اكتب الملخّص أو دع الذكاء الاصطناعي يصيغه من البيانات…' : 'Write the summary, or let AI draft it from the data…'} style={{ width: '100%', minHeight: 108, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '11px 14px', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14, color: 'var(--text-strong)', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.55 }} />
        <button onClick={draft} disabled={busy} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 16px', borderRadius: 'var(--radius-pill)', border: '1px solid ' + VIOLET_T, background: '#EDE8F8', color: VIOLET_T, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          <Icon name={busy ? 'loader' : 'sparkles'} size={16} />{busy ? (ar ? 'جاري الصياغة…' : 'Drafting…') : (ar ? 'صياغة بالذكاء الاصطناعي' : 'Draft with AI')}
        </button>
      </Field>

      <Button variant="primary" fullWidth style={{ background: VIOLET_T, marginTop: 4 }} disabled={!text.trim()} iconLeft={<Icon name="send" size={17} />} onClick={() => onSend(student)}>{ar ? 'إرسال التقرير للأهل' : 'Send report to parent'}</Button>
    </Sheet>
  );
}

function ReportsScreen({ lang, subject, sent, onOpen }) {
  const ar = lang === 'ar';
  const ready = REPORT_STUDENTS.filter(s => !sent.includes(s.id) && s.status === 'ready').length;
  return (
    <div style={{ padding: '0 18px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 18 }}>
        <StatCard label={ar ? 'مرسلة' : 'Sent'} value={sent.length} accent="var(--success-600)" icon={<Icon name="send" size={15} />} />
        <StatCard label={ar ? 'جاهزة' : 'Ready'} value={ready} accent={VIOLET_T} icon={<Icon name="file-check" size={15} />} />
        <StatCard label={ar ? 'مسودة' : 'Draft'} value={REPORT_STUDENTS.filter(s => s.status === 'draft' && !sent.includes(s.id)).length} accent="var(--amber-600)" icon={<Icon name="file-pen" size={15} />} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '16px 0 4px', padding: '12px 14px', borderRadius: 'var(--radius-lg)', background: '#EDE8F8', border: '1px solid color-mix(in srgb, var(--role-teacher) 22%, transparent)' }}>
        <Icon name="sparkles" size={20} color={VIOLET_T} />
        <span style={{ fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'افتح أي طالب ودع الذكاء الاصطناعي يصيغ التقرير الشهري من تقييماتك اليومية.' : "Open any student and let AI draft the monthly report from your daily evaluations."}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 12px' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تقارير يونيو' : 'June reports'}</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {REPORT_STUDENTS.map(s => {
          const done = sent.includes(s.id);
          const avg = Math.round((s.m.understanding + s.m.participation + s.m.homework + s.m.attendance) / 4);
          return (
            <Card key={s.id} padding="sm" interactive={!done} onClick={() => !done && onOpen(s)} style={{ display: 'flex', alignItems: 'center', gap: 11, opacity: done ? 0.72 : 1 }}>
              <Avatar name={s.name} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `المعدل ${avg}%` : `Average ${avg}%`}</div>
              </div>
              {done ? <Badge tone="success" dot>{ar ? 'مرسل' : 'Sent'}</Badge> : s.status === 'ready' ? <Badge tone="violet" dot>{ar ? 'جاهز' : 'Ready'}</Badge> : <Badge tone="amber" dot>{ar ? 'مسودة' : 'Draft'}</Badge>}
              {!done && <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { StudentEvalSheet, ConcernSheet, ReportDraftSheet, ReportsScreen, RatingInput });
