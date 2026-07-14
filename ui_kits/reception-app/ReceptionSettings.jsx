const { useState: useStateRSet, useRef: useRefRSet, useEffect: useEffectRSet } = React;
const TER_S = 'var(--role-supervisor)';
const TER_S_SOFT = '#F6E7DC';

/* ====================================================================
   Masar — Reception App · Settings + About
   ==================================================================== */

function RToggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width: 46, height: 28, borderRadius: 'var(--radius-pill)', border: 'none', background: on ? TER_S : 'var(--neutral-300)', position: 'relative', cursor: 'pointer', flex: 'none', transition: 'background .2s', padding: 0 }}>
      <span style={{ position: 'absolute', top: 3, insetInlineStart: on ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'inset-inline-start .2s' }} />
    </button>
  );
}

function RGroup({ title, children }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, paddingInlineStart: 4 }}>{title}</div>
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function RRow({ icon, iconBg, iconColor, label, sub, right, onClick, danger, ar, last }) {
  return (
    <div onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', background: 'transparent', borderBottom: last ? 'none' : '1px solid var(--border-subtle)', cursor: onClick ? 'pointer' : 'default', textAlign: 'start' }}>
      {icon && <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: iconBg || 'var(--surface-raised)', color: danger ? 'var(--danger-600)' : (iconColor || 'var(--text-body)'), display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={19} /></span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: danger ? 'var(--danger-600)' : 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 1, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{sub}</span>}
      </span>
      {right}
    </div>
  );
}

function RToast({ message, ar, onDone }) {
  useEffectRSet(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: 'absolute', bottom: 26, insetInlineStart: '50%', transform: 'translateX(-50%)', zIndex: 80, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 'var(--radius-pill)', background: '#14201E', boxShadow: 'var(--shadow-xl)', maxWidth: '88%' }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--success-500)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="check" size={14} color="#fff" /></span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#F5F3EE', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{message}</span>
    </div>
  );
}

function RSheet({ title, ar, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', width: '100%', borderRadius: '28px 28px 0 0', padding: '10px 22px 28px', maxHeight: '92%', overflowY: 'auto', animation: 'rsheet .3s var(--ease-out)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 16px' }} />
        <h3 style={{ margin: '0 0 18px', fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function RChangePasswordSheet({ lang, onClose, onSaved }) {
  const ar = lang === 'ar';
  const [cur, setCur] = useStateRSet('');
  const [nw, setNw] = useStateRSet('');
  const [cf, setCf] = useStateRSet('');
  const [show, setShow] = useStateRSet(false);
  const strong = nw.length >= 8; const match = nw && nw === cf; const valid = cur && strong && match;
  const field = { width: '100%', padding: '12px 14px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };
  const lbl = { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)', marginBottom: 7, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' };
  return (
    <RSheet title={ar ? 'تغيير كلمة المرور' : 'Change password'} ar={ar} onClose={onClose}>
      <div style={{ marginBottom: 16 }}><label style={lbl}>{ar ? 'كلمة المرور الحالية' : 'Current password'}</label><input type={show ? 'text' : 'password'} value={cur} onChange={e => setCur(e.target.value)} placeholder="••••••••" style={field} /></div>
      <div style={{ marginBottom: 16 }}><label style={lbl}>{ar ? 'كلمة المرور الجديدة' : 'New password'}</label><input type={show ? 'text' : 'password'} value={nw} onChange={e => setNw(e.target.value)} placeholder={ar ? '٨ أحرف على الأقل' : 'At least 8 characters'} style={field} />{nw && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: strong ? 'var(--success-500)' : 'var(--amber-600)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}><Icon name={strong ? 'check' : 'info'} size={13} color={strong ? 'var(--success-500)' : 'var(--amber-600)'} />{strong ? (ar ? 'قوية بما يكفي' : 'Strong enough') : (ar ? 'استخدم ٨ أحرف أو أكثر' : 'Use 8+ characters')}</div>}</div>
      <div style={{ marginBottom: 14 }}><label style={lbl}>{ar ? 'تأكيد كلمة المرور' : 'Confirm password'}</label><input type={show ? 'text' : 'password'} value={cf} onChange={e => setCf(e.target.value)} placeholder={ar ? 'كرّر كلمة المرور' : 'Repeat new password'} style={{ ...field, borderColor: cf && !match ? 'var(--danger-500)' : 'var(--border-subtle)' }} />{cf && !match && <div style={{ fontSize: 12, color: 'var(--danger-500)', marginTop: 6, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'كلمتا المرور غير متطابقتين' : 'Passwords don’t match'}</div>}</div>
      <button onClick={() => setShow(s => !s)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 20, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}><Icon name={show ? 'eye-off' : 'eye'} size={15} color="var(--text-muted)" />{show ? (ar ? 'إخفاء' : 'Hide') : (ar ? 'إظهار' : 'Show')}</button>
      <Button variant="primary" fullWidth size="lg" style={{ background: TER_S }} disabled={!valid} iconLeft={<Icon name="check" size={18} />} onClick={onSaved}>{ar ? 'تحديث كلمة المرور' : 'Update password'}</Button>
    </RSheet>
  );
}

function RHelpSheet({ lang, onClose, onToast }) {
  const ar = lang === 'ar';
  const [open, setOpen] = useStateRSet(-1);
  const [subject, setSubject] = useStateRSet('');
  const [msg, setMsg] = useStateRSet('');
  const faqs = ar ? [
    ['كيف أمسح كود الاستلام؟', 'من الشاشة الرئيسية اضغط «مسح QR»؛ تظهر بيانات الشخص المخوّل والطفل قبل التأكيد.'],
    ['متى يُرسَل إشعار الوصول؟', 'لا يُرسَل إلا بعد تأكيدك عدد الأطفال الكامل عند الوصول.'],
    ['الكود غير صالح؟', 'إذا ظهر تحذير، اطلب إثبات هوية وتواصل مع ولي الأمر قبل التسليم.'],
  ] : [
    ['How do I scan a pickup code?', 'From the home screen tap “Scan QR”; the authorized person’s and child’s details appear before you confirm.'],
    ['When is the arrival alert sent?', 'Only after you confirm the full child count on arrival.'],
    ['Code is invalid?', 'If a warning shows, ask for ID and contact the parent before any handover.'],
  ];
  const field = { width: '100%', padding: '12px 14px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };
  return (
    <RSheet title={ar ? 'المساعدة والدعم' : 'Help & support'} ar={ar} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[['message-circle', ar ? 'دردشة مباشرة' : 'Live chat', '#25D366', ar ? 'الأحد–الخميس ٩–٦' : 'Sun–Thu, 9–6'], ['phone', ar ? 'اتصل بنا' : 'Call us', TER_S, '+20 100 000 1234']].map(([ic, label, c, sub], i) => (
          <button key={i} onClick={() => onToast(ar ? 'يتم فتح القناة…' : 'Opening channel…')} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
            <span style={{ width: 38, height: 38, borderRadius: '50%', background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={ic} size={19} /></span>
            <div style={{ minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{label}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div></div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'أسئلة شائعة' : 'Common questions'}</div>
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 20 }}>
        {faqs.map(([q, a], i) => (
          <div key={i} style={{ borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
            <div onClick={() => setOpen(open === i ? -1 : i)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{q}</span>
              <Icon name={open === i ? 'chevron-up' : 'chevron-down'} size={17} color="var(--text-subtle)" />
            </div>
            {open === i && <div style={{ padding: '0 14px 13px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{a}</div>}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'أو راسلنا' : 'Or message us'}</div>
      <input value={subject} onChange={e => setSubject(e.target.value)} placeholder={ar ? 'الموضوع' : 'Subject'} style={{ ...field, marginBottom: 12 }} />
      <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder={ar ? 'صف سؤالك أو مشكلتك…' : 'Describe your question or issue…'} style={{ ...field, minHeight: 90, resize: 'none', lineHeight: 1.5, marginBottom: 16 }} />
      <Button variant="primary" fullWidth size="lg" style={{ background: TER_S }} disabled={!subject.trim() || !msg.trim()} iconLeft={<Icon name="send" size={17} />} onClick={() => { onToast(ar ? 'تم إرسال طلب الدعم' : 'Support request sent'); onClose(); }}>{ar ? 'إرسال' : 'Send request'}</Button>
    </RSheet>
  );
}

function REditProfileSheet({ lang, profile, onClose, onSave }) {
  const ar = lang === 'ar';
  const [name, setName] = useStateRSet(profile.name);
  const [nameAr, setNameAr] = useStateRSet(profile.nameAr || profile.name);
  const [photo, setPhoto] = useStateRSet(profile.photo);
  const fileRef = useRefRSet(null);
  const onFile = (e) => { const f = e.target.files && e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => setPhoto(ev.target.result); r.readAsDataURL(f); } };
  const field = { width: '100%', padding: '12px 14px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };
  const lbl = { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)', marginBottom: 7, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' };
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', width: '100%', borderRadius: '28px 28px 0 0', padding: '10px 22px 28px', maxHeight: '92%', overflowY: 'auto', animation: 'rsheet .3s var(--ease-out)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 16px' }} />
        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تعديل الملف الشخصي' : 'Edit profile'}</h3>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <div onClick={() => fileRef.current && fileRef.current.click()} style={{ position: 'relative', cursor: 'pointer' }}>
            <Avatar name={name} src={photo} size={92} />
            <span style={{ position: 'absolute', bottom: 0, insetInlineEnd: 0, width: 30, height: 30, borderRadius: '50%', background: TER_S, border: '2px solid var(--surface-card)', display: 'grid', placeItems: 'center' }}><Icon name="camera" size={15} color="#fff" /></span>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>{ar ? 'الاسم (إنجليزي)' : 'Name (English)'}</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} style={field} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={lbl}>{ar ? 'الاسم (عربي)' : 'Name (Arabic)'}</label>
          <input type="text" value={nameAr} onChange={e => setNameAr(e.target.value)} style={{ ...field, fontFamily: 'var(--font-arabic)' }} dir="rtl" />
        </div>
        <Button variant="primary" fullWidth size="lg" style={{ background: TER_S }} iconLeft={<Icon name="check" size={18} />} onClick={() => onSave({ ...profile, name, nameAr, photo })}>{ar ? 'حفظ التغييرات' : 'Save changes'}</Button>
      </div>
    </div>
  );
}

function ReceptionSettingsScreen({ lang, setLang, profile, setProfile, onAbout, onLogout }) {
  const ar = lang === 'ar';
  const [edit, setEdit] = useStateRSet(false);
  const [pwSheet, setPwSheet] = useStateRSet(false);
  const [helpSheet, setHelpSheet] = useStateRSet(false);
  const [toast, setToast] = useStateRSet(null);
  const [notif, setNotif] = useStateRSet({ pickups: true, bus: true, visitors: true, announcements: true });
  const setN = (k, v) => setNotif(prev => ({ ...prev, [k]: v }));
  const notifItems = [
    { k: 'pickups', icon: 'badge-check', en: 'Pickup scans', ar: 'مسح الاستلام', dEn: 'Each verified handover', dA: 'كل عملية تسليم موثّقة' },
    { k: 'bus', icon: 'bus', en: 'Bus arrivals', ar: 'وصول الباصات', dEn: 'When a bus reaches the gate', dA: 'عند وصول الباص للبوابة' },
    { k: 'visitors', icon: 'user-round', en: 'Visitor alerts', ar: 'تنبيهات الزوار', dEn: 'New visitor at reception', dA: 'زائر جديد في الاستقبال' },
    { k: 'announcements', icon: 'megaphone', en: 'Announcements', ar: 'إعلانات', dEn: 'Notices from administration', dA: 'تعميمات الإدارة' },
  ];
  return (
    <div style={{ padding: '0 18px 28px' }}>
      <div style={{ marginTop: 18, padding: '20px', borderRadius: 'var(--radius-lg)', background: `linear-gradient(135deg, ${TER_S_SOFT}, color-mix(in srgb, var(--amber-50) 55%, transparent))`, border: '1px solid color-mix(in srgb, var(--role-supervisor) 18%, transparent)', display: 'flex', alignItems: 'center', gap: 15 }}>
        <Avatar name={profile.name} src={profile.photo} size={64} status="present" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? (profile.nameAr || profile.name) : profile.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'موظفة استقبال · حضانة الشروق' : 'Receptionist · Sunrise Nursery'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>{profile.phone}</div>
        </div>
        <button onClick={() => setEdit(true)} style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}><Icon name="pencil" size={17} color={TER_S} /></button>
      </div>

      <RGroup title={ar ? 'الحساب' : 'Account'}>
        <RRow ar={ar} icon="user-round" iconBg={TER_S_SOFT} iconColor={TER_S} label={ar ? 'تعديل الاسم والصورة' : 'Edit name & photo'} onClick={() => setEdit(true)} right={<Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />} />
        <RRow ar={ar} icon="lock-keyhole" iconBg="var(--surface-raised)" label={ar ? 'تغيير كلمة المرور' : 'Change password'} onClick={() => setPwSheet(true)} right={<Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />} last />
      </RGroup>

      <RGroup title={ar ? 'اللغة' : 'Language'}>
        <div style={{ padding: '12px 15px' }}>
          <div style={{ display: 'flex', gap: 8, background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', padding: 4 }}>
            {[['en', 'English'], ['ar', 'العربية']].map(([v, label]) => {
              const on = lang === v;
              return (
                <button key={v} onClick={() => setLang(v)} style={{ flex: 1, height: 42, borderRadius: 'var(--radius-sm)', border: 'none', background: on ? 'var(--surface-card)' : 'transparent', boxShadow: on ? 'var(--shadow-sm)' : 'none', color: on ? TER_S : 'var(--text-muted)', fontFamily: v === 'ar' ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>{label}</button>
              );
            })}
          </div>
        </div>
      </RGroup>

      <RGroup title={ar ? 'الإشعارات' : 'Notifications'}>
        {notifItems.map((it, i) => (
          <RRow key={it.k} ar={ar} icon={it.icon} iconBg="var(--surface-raised)" label={ar ? it.ar : it.en} sub={ar ? it.dA : it.dEn} right={<RToggle on={notif[it.k]} onChange={v => setN(it.k, v)} />} last={i === notifItems.length - 1} />
        ))}
      </RGroup>

      <RGroup title={ar ? 'عن التطبيق' : 'About'}>
        <RRow ar={ar} icon="info" iconBg={TER_S_SOFT} iconColor={TER_S} label={ar ? 'عن مسار' : 'About Masar'} sub={ar ? 'الشركة المطوّرة للتطبيق' : 'The company behind the app'} onClick={onAbout} right={<Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />} />
        <RRow ar={ar} icon="life-buoy" iconBg="var(--surface-raised)" label={ar ? 'المساعدة والدعم' : 'Help & support'} onClick={() => setHelpSheet(true)} right={<Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />} last />
      </RGroup>

      <div style={{ marginTop: 18 }}>
        <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          <RRow ar={ar} icon="log-out" iconBg="var(--danger-50)" label={ar ? 'تسجيل الخروج' : 'Log out'} danger onClick={onLogout} last />
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>Masar Reception · v2.4.0</div>

      {edit && <REditProfileSheet lang={lang} profile={profile} onClose={() => setEdit(false)} onSave={(p) => { setProfile(p); setEdit(false); }} />}
      {pwSheet && <RChangePasswordSheet lang={lang} onClose={() => setPwSheet(false)} onSaved={() => { setPwSheet(false); setToast(ar ? 'تم تحديث كلمة المرور' : 'Password updated'); }} />}
      {helpSheet && <RHelpSheet lang={lang} onClose={() => setHelpSheet(false)} onToast={(m) => setToast(m)} />}
      {toast && <RToast message={toast} ar={ar} onDone={() => setToast(null)} />}
    </div>
  );
}

function ReceptionAboutScreen({ lang, onBack }) {
  const ar = lang === 'ar';
  const stats = [{ v: '120+', en: 'Nurseries', ar: 'حضانة' }, { v: '800+', en: 'Staff', ar: 'موظف' }, { v: '6', en: 'Cities', ar: 'مدن' }];
  const values = [
    { icon: 'shield-check', en: 'Verified handovers', ar: 'تسليم موثّق', dEn: 'Every child leaves only with an authorized, scanned person.', dA: 'كل طفل يغادر فقط مع شخص مخوّل تم مسح كوده.' },
    { icon: 'bell-ring', en: 'Trusted notifications', ar: 'إشعارات موثوقة', dEn: 'Parents are notified only after you confirm.', dA: 'لا يُشعَر الأهل إلا بعد تأكيدك.' },
    { icon: 'heart-handshake', en: 'One connected nursery', ar: 'حضانة متّصلة', dEn: 'Reception, teachers, drivers and parents — in sync.', dA: 'الاستقبال والمعلمون والسائقون والأهل — متزامنون.' },
  ];
  const contacts = [
    { icon: 'globe', label: 'masar.app', sub: ar ? 'الموقع الإلكتروني' : 'Website' },
    { icon: 'mail', label: 'support@masar.app', sub: ar ? 'الدعم' : 'Support' },
    { icon: 'phone', label: '+20 100 000 1234', sub: ar ? 'الدعم' : 'Support' },
    { icon: 'map-pin', label: ar ? 'القاهرة الجديدة، مصر' : 'New Cairo, Egypt', sub: ar ? 'المقر' : 'Headquarters' },
  ];
  const socials = [{ icon: 'instagram', c: '#E1306C' }, { icon: 'facebook', c: '#1877F2' }, { icon: 'linkedin', c: '#0A66C2' }, { icon: 'twitter', c: '#1C1C1A' }];
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '46px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name={ar ? 'arrow-right' : 'arrow-left'} size={20} color="var(--text-body)" /></button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'عن مسار' : 'About Masar'}</h2>
      </div>
      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 18px 28px' }}>
        <div style={{ textAlign: 'center', padding: '30px 16px 24px' }}>
          <div style={{ width: 88, height: 88, borderRadius: 26, background: 'linear-gradient(160deg, #C2622E, #8C4419)', display: 'grid', placeItems: 'center', margin: '0 auto 18px', boxShadow: '0 16px 40px -12px rgba(194,98,46,.5)' }}>
            <MasarMark size={48} light />
          </div>
          <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-.02em', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مسار' : 'Masar'}</h1>
          <p style={{ margin: '8px auto 0', fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-muted)', maxWidth: 300, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'منصّة تربط الاستقبال بالأهل والسائقين — تحقّق آمن من الاستلام وتأكيد الباص.' : 'A platform connecting reception with parents & drivers — secure pickup verification and bus confirmation.'}</p>
        </div>
        <div style={{ display: 'flex', background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ flex: 1, padding: '16px 8px', textAlign: 'center', borderInlineStart: i ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: TER_S, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? s.ar : s.en}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22, padding: '18px 18px', borderRadius: 'var(--radius-lg)', background: TER_S_SOFT, border: '1px solid color-mix(in srgb, var(--role-supervisor) 18%, transparent)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: TER_S, marginBottom: 7, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مهمّتنا' : 'Our mission'}</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'أن نجعل كل تسليم واستلام آمنًا وموثّقًا — حتى يطمئن كل أهل على أطفالهم.' : 'To make every handover safe and verified — so every family has peace of mind.'}</p>
        </div>
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {values.map((v, i) => (
            <div key={i} style={{ display: 'flex', gap: 13, padding: '15px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: TER_S_SOFT, color: TER_S, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={v.icon} size={21} /></span>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? v.ar : v.en}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? v.dA : v.dEn}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '24px 0 10px', paddingInlineStart: 4 }}>{ar ? 'تواصل معنا' : 'Get in touch'}</div>
        <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          {contacts.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', borderBottom: i < contacts.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', color: TER_S, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={c.icon} size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: c.icon === 'map-pin' ? (ar ? 'var(--font-arabic)' : 'var(--font-sans)') : 'var(--font-sans)' }}>{c.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{c.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 22 }}>
          {socials.map((s, i) => (
            <button key={i} style={{ width: 46, height: 46, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name={s.icon} size={20} color={s.c} /></button>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 22, fontSize: 12, color: 'var(--text-subtle)', lineHeight: 1.6, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
          <div style={{ fontFamily: 'var(--font-mono)' }}>v2.4.0 · © 2026 Masar</div>
          <div style={{ marginTop: 2 }}>{ar ? 'صُنع بحب في مصر 🇪🇬' : 'Made with care in Egypt 🇪🇬'}</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ReceptionSettingsScreen, ReceptionAboutScreen });
