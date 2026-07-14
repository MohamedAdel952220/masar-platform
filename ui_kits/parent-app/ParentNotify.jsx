const { useState: useStatePN } = React;

/* ====================================================================
   Masar — Parent App · Notification center
   Loaded after masar-ui.jsx, before ParentApp.jsx.
   ==================================================================== */

function ParentNotifPanel({ lang, groups, onPick, onClose }) {
  const ar = lang === 'ar';
  const accent = 'var(--primary)';
  const tone = c => c === 'success' ? ['var(--success-50)', 'var(--success-600)'] : c === 'amber' ? ['var(--amber-50)', 'var(--amber-600)'] : c === 'danger' ? ['var(--danger-50)', 'var(--danger-600)'] : c === 'violet' ? ['#EDE8F8', 'var(--role-teacher)'] : c === 'info' ? ['var(--info-50)', 'var(--info-600)'] : ['var(--teal-50)', 'var(--teal-600)'];
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', zIndex: 65, display: 'flex', flexDirection: 'column' }}>
      <div onClick={e => e.stopPropagation()} dir={ar ? 'rtl' : 'ltr'} style={{ background: 'var(--bg-app)', borderRadius: '0 0 24px 24px', maxHeight: '84%', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '44px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Icon name="bell" size={20} color={accent} />
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'الإشعارات' : 'Notifications'}</span>
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
                      {n.unread && <span style={{ position: 'absolute', top: 14, insetInlineEnd: 12, width: 8, height: 8, borderRadius: '50%', background: accent }} />}
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

/* Parent notification feed — routes to tabs / chat / subject */
function parentNotifs() {
  return [
    {
      label: 'Today', labelAr: 'اليوم', items: [
        { icon: 'flag', tone: 'danger', unread: true, t: '11:05', title: 'A concern was raised', titleAr: 'تم رفع ملاحظة', msg: 'Ms. Sara flagged a behavior note about Yousef.', msgAr: 'رفعت أ. سارة ملاحظة سلوكية بخصوص يوسف.', go: { chat: 'subj-english' } },
        { icon: 'message-circle', tone: 'teal', unread: true, t: '9:40', title: 'Reply from Ms. Sara', titleAr: 'رد من أ. سارة', msg: 'About Yousef before Math class.', msgAr: 'بخصوص يوسف قبل حصة الرياضيات.', go: { chat: 'subj-english' } },
        { icon: 'book-open', tone: 'teal', unread: true, t: '9:15', title: "Today's English report ready", titleAr: 'تقرير الإنجليزي جاهز', msg: 'Letter Sounds — M · understanding 5/5.', msgAr: 'أصوات الحروف — حرف M · الفهم ٥/٥.', go: { subject: 'english' } },
      ],
    },
    {
      label: 'Transport & events', labelAr: 'النقل والفعاليات', items: [
        { icon: 'circle-check-big', tone: 'success', t: '7:42', title: 'Arrived at nursery', titleAr: 'وصل إلى الحضانة', msg: 'Yousef arrived safely and checked in.', msgAr: 'وصل يوسف بأمان وتم تسجيل دخوله.', go: { tab: 'bus' } },
        { icon: 'calendar-days', tone: 'amber', t: 'Yesterday', title: 'Exam in 5 days', titleAr: 'امتحان بعد ٥ أيام', msg: 'English weekly quiz — Sun, Jun 29.', msgAr: 'اختبار الإنجليزي الأسبوعي — الأحد ٢٩ يونيو.', go: { tab: 'events' } },
        { icon: 'music', tone: 'violet', t: 'Yesterday', title: 'End-of-Year Concert', titleAr: 'حفل نهاية العام', msg: 'Sat, Jul 5 — please confirm attendance.', msgAr: 'السبت ٥ يوليو — يُرجى تأكيد الحضور.', go: { tab: 'events' } },
        { icon: 'fish', tone: 'info', t: 'Mon', title: 'Aquarium trip open', titleAr: 'رحلة الأكواريوم متاحة', msg: 'Register Yousef — 8 spots left.', msgAr: 'سجّل يوسف — ٨ مقاعد متبقية.', go: { tab: 'events' } },
      ],
    },
  ];
}

Object.assign(window, { ParentNotifPanel, parentNotifs });
