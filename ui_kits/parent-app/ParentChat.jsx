const { useState: useStatePC, useRef: useRefPC, useEffect: useEffectPC } = React;

/* ====================================================================
   Masar — Parent App · Chat with subject teacher + escalate to school
   Loaded after masar-ui.jsx, before ParentApp.jsx.
   ==================================================================== */

const PARENT_CHATS_SEED = [
  {
    id: 'subj-english', subjectId: 'english', teacher: 'Ms. Sara Mahmoud', teacherAr: 'أ. سارة محمود',
    subject: 'English', subjectAr: 'اللغة الإنجليزية', tone: 'teal', unread: 1, escalated: false,
    msgs: [
      { from: 'me', text: 'Good morning Ms. Sara — I saw on the camera Yousef looked upset before Math. Is everything ok?', textAr: 'صباح الخير أ. سارة — شفت في الكاميرا إن يوسف كان زعلان قبل الرياضيات. كل شيء تمام؟', t: '9:32' },
      { from: 'teacher', text: 'Good morning! He missed his water bottle but he is fine now and enjoyed counting games 😊', textAr: 'صباح النور! كان زعلان لأنه نسي زجاجة المياه، بس دلوقتي تمام واستمتع بألعاب العد 😊', t: '9:40' },
    ],
  },
  {
    id: 'subj-arabic', subjectId: 'arabic', teacher: 'Ms. Hala Nabil', teacherAr: 'أ. هالة نبيل',
    subject: 'Arabic', subjectAr: 'اللغة العربية', tone: 'violet', unread: 0, escalated: false,
    msgs: [
      { from: 'teacher', text: "Yousef's handwriting is improving nicely this week 👏", textAr: 'خط يوسف بيتحسّن بشكل جميل الأسبوع ده 👏', t: 'Yesterday' },
      { from: 'me', text: 'That is wonderful to hear, thank you!', textAr: 'خبر رائع، شكرًا جزيلًا!', t: 'Yesterday' },
    ],
  },
];

const PC_TONE = { teal: 'var(--teal-600)', violet: 'var(--role-teacher)' };

/* ---------------- Chat list ---------------- */
function ParentChatList({ lang, chats, onOpen }) {
  const ar = lang === 'ar';
  return (
    <div style={{ padding: '0 18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '20px 0 14px', padding: '12px 14px', borderRadius: 'var(--radius-lg)', background: 'var(--teal-50)', border: '1px solid var(--teal-100)' }}>
        <Icon name="message-circle" size={20} color="var(--teal-600)" />
        <span style={{ fontSize: 12.5, color: 'var(--teal-800)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تواصل مباشرة مع معلّم كل مادة. لو لم يُحَل الأمر، يمكنك تصعيده للإدارة.' : "Message each subject's teacher directly. If it isn't resolved, you can escalate to administration."}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {chats.map(ch => {
          const last = ch.msgs[ch.msgs.length - 1];
          const c = PC_TONE[ch.tone];
          return (
            <Card key={ch.id} padding="sm" interactive onClick={() => onOpen(ch.id)} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Avatar name={ch.teacher} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? ch.teacherAr : ch.teacher}</span>
                  {ch.escalated && <Badge tone="danger" style={{ height: 18, fontSize: 9.5 }}>{ar ? 'مُصعّد' : 'Escalated'}</Badge>}
                </div>
                <div style={{ fontSize: 11.5, color: c, fontWeight: 700, marginBottom: 2, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? ch.subjectAr : ch.subject}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{last.from === 'me' ? (ar ? 'أنت: ' : 'You: ') : ''}{ar ? last.textAr : last.text}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flex: 'none' }}>
                <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>{last.t}</span>
                {ch.unread > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: '50%', background: 'var(--teal-600)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 5px' }}>{ch.unread}</span>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Escalate confirm ---------------- */
function EscalateSheet({ lang, chat, onClose, onConfirm }) {
  const ar = lang === 'ar';
  const [reason, setReason] = useStatePC('');
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 80 }}>
      <div onClick={e => e.stopPropagation()} dir={ar ? 'rtl' : 'ltr'} style={{ background: 'var(--surface-card)', width: '100%', borderRadius: '28px 28px 0 0', padding: '10px 22px 28px', animation: 'sheet .3s var(--ease-out)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--danger-50)', color: 'var(--danger-600)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="triangle-alert" size={22} /></span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تصعيد للإدارة' : 'Report to administration'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'إذا لم يُحَل الأمر مع المعلّم' : "If it wasn't resolved with the teacher"}</div>
          </div>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.55, color: 'var(--text-body)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'سيتم إرسال هذه المحادثة إلى إدارة الحضانة للمراجعة والمتابعة معك مباشرة.' : 'This conversation will be sent to the nursery administration to review and follow up with you directly.'}</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={ar ? 'سبب التصعيد (اختياري)…' : 'Reason for escalating (optional)…'} style={{ width: '100%', minHeight: 76, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '11px 14px', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14, color: 'var(--text-strong)', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" fullWidth onClick={onClose}>{ar ? 'إلغاء' : 'Cancel'}</Button>
          <Button variant="danger" fullWidth iconLeft={<Icon name="send" size={17} />} onClick={onConfirm}>{ar ? 'تصعيد الآن' : 'Escalate now'}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Chat thread ---------------- */
function ParentChatThread({ lang, chat, onClose, onSend, onEscalate }) {
  const ar = lang === 'ar';
  const [draft, setDraft] = useStatePC('');
  const [showEsc, setShowEsc] = useStatePC(false);
  const scrollRef = useRefPC(null);
  const c = PC_TONE[chat.tone];
  useEffectPC(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [chat.msgs.length]);
  const send = () => { if (draft.trim()) { onSend(chat.id, draft.trim()); setDraft(''); } };

  return (
    <div dir={ar ? 'rtl' : 'ltr'} style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)', zIndex: 55, display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div style={{ padding: '46px 14px 12px', background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 11 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}>
          <Icon name={ar ? 'arrow-right' : 'arrow-left'} size={20} color="var(--text-body)" />
        </button>
        <Avatar name={chat.teacher} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? chat.teacherAr : chat.teacher}</div>
          <div style={{ fontSize: 12, color: c, fontWeight: 700, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `معلّمة ${chat.subjectAr}` : `${chat.subject} teacher`}</div>
        </div>
        {!chat.escalated && (
          <button onClick={() => setShowEsc(true)} title={ar ? 'تصعيد للإدارة' : 'Report to school'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--danger-200)', background: 'var(--danger-50)', color: 'var(--danger-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>
            <Icon name="flag" size={14} />{ar ? 'تصعيد' : 'Escalate'}
          </button>
        )}
      </div>

      {/* escalated banner */}
      {chat.escalated && (
        <div style={{ padding: '9px 16px', background: 'var(--danger-50)', borderBottom: '1px solid var(--danger-100)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="shield-alert" size={16} color="var(--danger-600)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تم تصعيد هذه المحادثة إلى الإدارة' : 'This conversation was escalated to administration'}</span>
        </div>
      )}

      {/* messages */}
      <div ref={scrollRef} className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {chat.msgs.map((m, i) => {
          if (m.from === 'system') return (
            <div key={i} style={{ alignSelf: 'center', maxWidth: '85%', textAlign: 'center', padding: '7px 14px', borderRadius: 'var(--radius-pill)', background: 'var(--danger-50)', color: 'var(--danger-700)', fontSize: 12, fontWeight: 600, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? m.textAr : m.text}</div>
          );
          const me = m.from === 'me';
          return (
            <div key={i} style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
              <div style={{ padding: '10px 14px', borderRadius: me ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: me ? c : 'var(--surface-card)', color: me ? '#fff' : 'var(--text-strong)', border: me ? 'none' : '1px solid var(--border-subtle)', fontSize: 13.5, lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? m.textAr : m.text}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', marginTop: 3, textAlign: me ? 'end' : 'start', fontFamily: 'var(--font-mono)' }}>{m.t}</div>
            </div>
          );
        })}
      </div>

      {/* input */}
      <div style={{ padding: '10px 14px 26px', background: 'var(--surface-card)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-end', gap: 9 }}>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder={ar ? 'اكتب رسالة…' : 'Type a message…'} style={{ flex: 1, resize: 'none', maxHeight: 90, border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '10px 16px', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14, color: 'var(--text-strong)', outline: 'none', lineHeight: 1.4, boxSizing: 'border-box' }} />
        <button onClick={send} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: c, display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}><Icon name="send" size={19} color="#fff" /></button>
      </div>

      {showEsc && <EscalateSheet lang={lang} chat={chat} onClose={() => setShowEsc(false)} onConfirm={() => { onEscalate(chat.id); setShowEsc(false); }} />}
    </div>
  );
}

Object.assign(window, { ParentChatList, ParentChatThread, PARENT_CHATS_SEED });
