const { useState: useStateR, useRef: useRefR, useEffect: useEffectR } = React;
const VIOLET_R = 'var(--role-teacher)';

/* ====================================================================
   Masar — Teacher App · Requests (event/trip/exam) + Parent chat
   Loaded after masar-ui.jsx, before TeacherApp.jsx.
   ==================================================================== */

/* ---------------- Request types ---------------- */
const REQ_TYPES = [
  { v: 'event', icon: 'party-popper', en: 'Event', ar: 'فعالية', tone: 'amber' },
  { v: 'trip', icon: 'bus', en: 'Trip', ar: 'رحلة', tone: 'info' },
  { v: 'exam', icon: 'clipboard-check', en: 'Exam', ar: 'امتحان', tone: 'violet' },
];
const reqType = v => REQ_TYPES.find(t => t.v === v) || REQ_TYPES[0];

const SEED_REQUESTS = [
  { id: 'r1', type: 'exam', examKind: 'weekly', title: 'English — Weekly Quiz', titleAr: 'إنجليزي — اختبار أسبوعي', date: 'Sun · Jun 29', dateAr: 'الأحد · ٢٩ يونيو', time: '9:00 AM', timeAr: '٩:٠٠ ص', status: 'approved', hasPaper: true },
  { id: 'r2', type: 'trip', title: 'Aquarium Visit', titleAr: 'زيارة الأكواريوم', place: 'Grand Aquarium', placeAr: 'الأكواريوم الكبير', price: 250, date: 'Mon · Jun 30', dateAr: 'الإثنين · ٣٠ يونيو', time: '9:30 AM', timeAr: '٩:٣٠ ص', status: 'pending', hasPaper: false },
  { id: 'r3', type: 'event', title: 'English Reading Corner', titleAr: 'ركن القراءة الإنجليزية', date: 'Wed · Jul 2', dateAr: 'الأربعاء · ٢ يوليو', time: '11:00 AM', timeAr: '١١:٠٠ ص', status: 'rejected', reason: 'Clashes with graduation rehearsal', reasonAr: 'يتعارض مع بروفة التخرّج', hasPaper: false },
];

const REQ_STATUS = {
  pending: { en: 'Pending approval', ar: 'بانتظار الموافقة', tone: 'amber', icon: 'clock' },
  approved: { en: 'Approved', ar: 'تمت الموافقة', tone: 'success', icon: 'circle-check-big' },
  rejected: { en: 'Not approved', ar: 'لم تتم الموافقة', tone: 'danger', icon: 'circle-x' },
};

/* ====================================================================
   REQUESTS SCREEN
   ==================================================================== */
function RequestsScreen({ lang, requests, onNew }) {
  const ar = lang === 'ar';
  return (
    <div style={{ padding: '0 18px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 18 }}>
        <StatCard label={ar ? 'قيد المراجعة' : 'Pending'} value={requests.filter(r => r.status === 'pending').length} accent="var(--amber-600)" icon={<Icon name="clock" size={15} />} />
        <StatCard label={ar ? 'مقبولة' : 'Approved'} value={requests.filter(r => r.status === 'approved').length} accent="var(--success-600)" icon={<Icon name="check" size={15} />} />
        <StatCard label={ar ? 'مرفوضة' : 'Rejected'} value={requests.filter(r => r.status === 'rejected').length} accent="var(--danger-600)" icon={<Icon name="x" size={15} />} />
      </div>

      <Button variant="primary" fullWidth style={{ background: VIOLET_R, marginTop: 16 }} iconLeft={<Icon name="plus" size={18} />} onClick={onNew}>{ar ? 'طلب جديد' : 'New request'}</Button>

      {/* Note: school-managed exams */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, margin: '14px 0 4px', padding: '12px 14px', borderRadius: 'var(--radius-lg)', background: 'var(--info-50)', border: '1px solid color-mix(in srgb, var(--info-500) 22%, transparent)' }}>
        <Icon name="info" size={18} color="var(--info-700)" style={{ marginTop: 1 }} />
        <span style={{ fontSize: 12.5, color: 'var(--info-800)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'يمكنك طلب الامتحانات الأسبوعية والشهرية فقط. امتحانات نصف ونهاية العام تُحدّد من إدارة المدرسة.' : 'You can request weekly & monthly exams only. Mid-term and end-of-year exams are scheduled by school administration.'}</span>
      </div>

      <h3 style={{ margin: '20px 0 12px', fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'طلباتي' : 'My requests'}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {requests.map(r => {
          const t = reqType(r.type); const st = REQ_STATUS[r.status]; const c = t.tone === 'violet' ? VIOLET_R : `var(--${t.tone}-600)`;
          const stc = st.tone === 'danger' ? 'var(--danger-600)' : st.tone === 'success' ? 'var(--success-600)' : 'var(--amber-600)';
          return (
            <Card key={r.id} padding="md">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={t.icon} size={21} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? r.titleAr : r.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}><Icon name="calendar" size={13} color="var(--text-subtle)" />{ar ? r.dateAr : r.date}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="clock" size={13} color="var(--text-subtle)" />{ar ? r.timeAr : r.time}</span>
                    {r.price != null && r.price > 0 && <span style={{ fontWeight: 700, color: 'var(--text-body)' }}>{r.price} EGP</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <Icon name={st.icon} size={16} color={stc} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: stc, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? st.ar : st.en}</span>
                {r.hasPaper && <span style={{ marginInlineStart: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}><Icon name="paperclip" size={13} />{ar ? 'ورقة مرفقة' : 'Paper attached'}</span>}
              </div>
              {r.status === 'rejected' && r.reason && (
                <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-50)', fontSize: 12.5, color: 'var(--danger-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `السبب: ${r.reasonAr}` : `Reason: ${r.reason}`}</div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ====================================================================
   NEW REQUEST SHEET
   ==================================================================== */
function NewRequestSheet({ lang, onClose, onSubmit }) {
  const ar = lang === 'ar';
  const [type, setType] = useStateR('exam');
  const [examKind, setExamKind] = useStateR('weekly');
  const [title, setTitle] = useStateR('');
  const [date, setDate] = useStateR('');
  const [time, setTime] = useStateR('');
  const [place, setPlace] = useStateR('');
  const [price, setPrice] = useStateR('');
  const [paper, setPaper] = useStateR(null);
  const fileRef = useRefR(null);

  const onFile = e => { const f = e.target.files && e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => setPaper(ev.target.result); r.readAsDataURL(f); } };
  const valid = title.trim() && date.trim() && time.trim() && (type !== 'trip' || place.trim()) && (type !== 'exam' || paper);

  const field = { width: '100%', padding: '11px 14px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', marginBottom: 4, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'طلب جديد' : 'New request'}</div>
      <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'يُرسل الطلب لإدارة المدرسة للموافقة' : 'Sent to school administration for approval'}</p>

      {/* type */}
      <Field label={ar ? 'النوع' : 'Type'}>
        <div style={{ display: 'flex', gap: 8 }}>
          {REQ_TYPES.map(t => {
            const on = type === t.v; const c = t.tone === 'violet' ? VIOLET_R : `var(--${t.tone}-600)`;
            return (
              <button key={t.v} onClick={() => setType(t.v)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 6px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? c : 'var(--border-subtle)'}`, background: on ? `color-mix(in srgb, ${c} 10%, transparent)` : 'var(--surface-card)', cursor: 'pointer' }}>
                <Icon name={t.icon} size={22} color={on ? c : 'var(--text-subtle)'} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: on ? c : 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? t.ar : t.en}</span>
              </button>
            );
          })}
        </div>
      </Field>

      {/* exam kind */}
      {type === 'exam' && (
        <Field label={ar ? 'نوع الامتحان' : 'Exam frequency'}>
          <Segment options={[['weekly', ar ? 'أسبوعي' : 'Weekly'], ['monthly', ar ? 'شهري' : 'Monthly']]} value={examKind} onChange={setExamKind} />
        </Field>
      )}

      {/* title */}
      <Field label={ar ? 'العنوان' : 'Title'}>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={type === 'exam' ? (ar ? 'مثال: إنجليزي — اختبار أسبوعي' : 'e.g. English — Weekly Quiz') : (ar ? 'اسم الفعالية/الرحلة' : 'Event / trip name')} style={field} />
      </Field>

      {/* date + time */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><Field label={ar ? 'التاريخ' : 'Date'}><input type="text" value={date} onChange={e => setDate(e.target.value)} placeholder={ar ? '٢٩ يونيو' : 'Jun 29'} style={field} /></Field></div>
        <div style={{ flex: 1 }}><Field label={ar ? 'الوقت' : 'Time'}><input type="text" value={time} onChange={e => setTime(e.target.value)} placeholder={ar ? '٩:٠٠ ص' : '9:00 AM'} style={field} /></Field></div>
      </div>

      {/* trip extras */}
      {type === 'trip' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1.4 }}><Field label={ar ? 'الوجهة' : 'Destination'}><input type="text" value={place} onChange={e => setPlace(e.target.value)} placeholder={ar ? 'المكان' : 'Place'} style={field} /></Field></div>
          <div style={{ flex: 1 }}><Field label={ar ? 'السعر (ج.م)' : 'Price (EGP)'}><input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder={ar ? '٠ = مجاني' : '0 = free'} style={field} /></Field></div>
        </div>
      )}

      {/* exam paper upload */}
      {type === 'exam' && (
        <Field label={ar ? 'ورقة الامتحان' : 'Exam paper'}>
          <div onClick={() => fileRef.current && fileRef.current.click()} style={{ border: '1.5px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', padding: paper ? 12 : '22px 16px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-raised)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {paper ? (
              <>
                <img src={paper} alt="exam" style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 'var(--radius-sm)', display: 'block' }} />
                <span style={{ fontSize: 12.5, color: VIOLET_R, fontWeight: 700 }}>{ar ? 'تغيير الورقة' : 'Change paper'}</span>
              </>
            ) : (
              <>
                <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#EDE8F8', color: VIOLET_R, display: 'grid', placeItems: 'center' }}><Icon name="camera" size={22} /></span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'صوّر أو ارفع ورقة الامتحان' : 'Photograph or upload the exam'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 2 }}>PNG / JPG / PDF</div>
                </div>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={onFile} style={{ display: 'none' }} />
        </Field>
      )}

      <Button variant="primary" fullWidth size="lg" style={{ background: VIOLET_R, marginTop: 6 }} disabled={!valid} iconLeft={<Icon name="send" size={18} />} onClick={() => onSubmit({ type, examKind, title: title.trim(), date, time, place: place.trim(), price: Number(price) || 0, hasPaper: !!paper })}>{ar ? 'إرسال الطلب' : 'Submit request'}</Button>
    </Sheet>
  );
}

/* ====================================================================
   CHAT — conversation list + thread (teacher ↔ parent)
   ==================================================================== */
const SEED_CHATS = [
  {
    id: 'c1', parent: 'Mr. Adel Hassan', parentAr: 'أ. عادل حسن', child: 'Yousef Adel', childAr: 'يوسف عادل', unread: 1, escalated: false,
    msgs: [
      { from: 'parent', text: 'Good morning Ms. Sara — I saw on the camera Yousef looked upset before Math. Is everything ok?', textAr: 'صباح الخير أ. سارة — شفت في الكاميرا إن يوسف كان زعلان قبل الرياضيات. كل شيء تمام؟', t: '9:32' },
      { from: 'me', text: 'Good morning! He missed his water bottle but he is fine now and enjoyed counting games 😊', textAr: 'صباح النور! كان زعلان لأنه نسي زجاجة المياه، بس دلوقتي تمام واستمتع بألعاب العد 😊', t: '9:40' },
      { from: 'parent', text: 'Thank you so much for checking 🙏', textAr: 'شكرًا جزيلًا على المتابعة 🙏', t: '9:41' },
    ],
  },
  {
    id: 'c2', parent: 'Mrs. Hoda Tarek', parentAr: 'أ. هدى طارق', child: 'Malak Tarek', childAr: 'ملك طارق', unread: 0, escalated: true,
    msgs: [
      { from: 'parent', text: 'Malak said another child took her crayons. Could you look into it?', textAr: 'ملك قالت إن طفل تاني خد الألوان بتاعتها. ممكن تشوفي الموضوع؟', t: 'Yesterday' },
      { from: 'system', text: 'This conversation was escalated to administration.', textAr: 'تم تصعيد هذه المحادثة إلى الإدارة.', t: 'Yesterday' },
    ],
  },
];

function ChatListScreen({ lang, chats, onOpen }) {
  const ar = lang === 'ar';
  return (
    <div style={{ padding: '0 18px 20px' }}>
      <h3 style={{ margin: '20px 0 12px', fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'المحادثات مع الأهل' : 'Parent conversations'}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {chats.map(ch => {
          const last = ch.msgs[ch.msgs.length - 1];
          return (
            <Card key={ch.id} padding="sm" interactive onClick={() => onOpen(ch.id)} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Avatar name={ar ? ch.parentAr : ch.parent} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? ch.parentAr : ch.parent}</span>
                  {ch.escalated && <Badge tone="danger" style={{ height: 18, fontSize: 9.5 }}>{ar ? 'مُصعّد' : 'Escalated'}</Badge>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', marginBottom: 2, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `ولي أمر ${ch.childAr}` : `${ch.child}'s parent`}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{last.from === 'me' ? (ar ? 'أنت: ' : 'You: ') : ''}{ar ? last.textAr : last.text}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flex: 'none' }}>
                <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>{last.t}</span>
                {ch.unread > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: '50%', background: VIOLET_R, color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 5px' }}>{ch.unread}</span>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ChatThread({ lang, chat, onClose, onSend }) {
  const ar = lang === 'ar';
  const [draft, setDraft] = useStateR('');
  const scrollRef = useRefR(null);
  useEffectR(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [chat.msgs.length]);

  const send = () => { if (draft.trim()) { onSend(chat.id, draft.trim()); setDraft(''); } };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div style={{ padding: '46px 14px 12px', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 11 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}>
          <Icon name={ar ? 'arrow-right' : 'arrow-left'} size={20} color="var(--text-body)" />
        </button>
        <Avatar name={ar ? chat.parentAr : chat.parent} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? chat.parentAr : chat.parent}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `ولي أمر ${chat.childAr} · إنجليزي` : `${chat.child}'s parent · English`}</div>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {chat.msgs.map((m, i) => {
          if (m.from === 'system') return (
            <div key={i} style={{ alignSelf: 'center', maxWidth: '85%', textAlign: 'center', padding: '7px 14px', borderRadius: 'var(--radius-pill)', background: 'var(--danger-50)', color: 'var(--danger-700)', fontSize: 12, fontWeight: 600, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? m.textAr : m.text}</div>
          );
          const me = m.from === 'me';
          return (
            <div key={i} style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
              <div style={{ padding: '10px 14px', borderRadius: me ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: me ? VIOLET_R : 'var(--surface-card)', color: me ? '#fff' : 'var(--text-strong)', border: me ? 'none' : '1px solid var(--border-subtle)', fontSize: 13.5, lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? m.textAr : m.text}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', marginTop: 3, textAlign: me ? 'end' : 'start', fontFamily: 'var(--font-mono)' }}>{m.t}</div>
            </div>
          );
        })}
      </div>

      {/* input */}
      <div style={{ padding: '10px 14px 26px', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-end', gap: 9 }}>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder={ar ? 'اكتب رسالة…' : 'Type a message…'} style={{ flex: 1, resize: 'none', maxHeight: 90, border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '10px 16px', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14, color: 'var(--text-strong)', outline: 'none', lineHeight: 1.4, boxSizing: 'border-box' }} />
        <button onClick={send} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: VIOLET_R, display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}><Icon name="send" size={19} color="#fff" /></button>
      </div>
    </div>
  );
}

Object.assign(window, { RequestsScreen, NewRequestSheet, ChatListScreen, ChatThread, SEED_REQUESTS, SEED_CHATS });
