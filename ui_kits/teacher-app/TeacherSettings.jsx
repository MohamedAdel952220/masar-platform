const { useState: useStateTSet, useRef: useRefTSet } = React;
const VIO_S = 'var(--role-teacher)';
const VIO_S_SOFT = '#EDE8F8';

/* ====================================================================
   Masar — Teacher App · Settings + About Us
   Exposes window.TeacherSettingsScreen + window.TeacherAboutScreen
   ==================================================================== */

function TToggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width: 46, height: 28, borderRadius: 'var(--radius-pill)', border: 'none', background: on ? VIO_S : 'var(--neutral-300)', position: 'relative', cursor: 'pointer', flex: 'none', transition: 'background .2s', padding: 0 }}>
      <span style={{ position: 'absolute', top: 3, insetInlineStart: on ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'inset-inline-start .2s' }} />
    </button>
  );
}

function TGroup({ title, children }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, paddingInlineStart: 4 }}>{title}</div>
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function TRow({ icon, iconBg, iconColor, label, sub, right, onClick, danger, ar, last }) {
  return (
    <button onClick={onClick} disabled={!onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', background: 'transparent', border: 'none', borderBottom: last ? 'none' : '1px solid var(--border-subtle)', cursor: onClick ? 'pointer' : 'default', textAlign: 'start' }}>
      {icon && <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: iconBg || 'var(--surface-raised)', color: danger ? 'var(--danger-600)' : (iconColor || 'var(--text-body)'), display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={19} /></span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: danger ? 'var(--danger-600)' : 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 1, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{sub}</span>}
      </span>
      {right}
    </button>
  );
}

/* ---------------- Edit profile sheet ---------------- */
function TEditProfileSheet({ lang, profile, onClose, onSave }) {
  const ar = lang === 'ar';
  const [name, setName] = useStateTSet(profile.name);
  const [nameAr, setNameAr] = useStateTSet(profile.nameAr || profile.name);
  const [photo, setPhoto] = useStateTSet(profile.photo);
  const fileRef = useRefTSet(null);
  const onFile = (e) => { const f = e.target.files && e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => setPhoto(ev.target.result); r.readAsDataURL(f); } };
  const field = { width: '100%', padding: '12px 14px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none' };
  const lbl = { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-body)', marginBottom: 7, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' };
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', width: '100%', borderRadius: '28px 28px 0 0', padding: '10px 22px 28px', maxHeight: '92%', overflowY: 'auto', animation: 'sheet .3s var(--ease-out)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 16px' }} />
        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تعديل الملف الشخصي' : 'Edit profile'}</h3>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <div onClick={() => fileRef.current && fileRef.current.click()} style={{ position: 'relative', cursor: 'pointer' }}>
            <Avatar name={name} src={photo} size={92} />
            <span style={{ position: 'absolute', bottom: 0, insetInlineEnd: 0, width: 30, height: 30, borderRadius: '50%', background: VIO_S, border: '2px solid var(--surface-card)', display: 'grid', placeItems: 'center' }}><Icon name="camera" size={15} color="#fff" /></span>
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
        <Button variant="primary" fullWidth size="lg" style={{ background: VIO_S }} iconLeft={<Icon name="check" size={18} />} onClick={() => onSave({ ...profile, name, nameAr, photo })}>{ar ? 'حفظ التغييرات' : 'Save changes'}</Button>
      </div>
    </div>
  );
}

/* ---------------- Settings screen ---------------- */
function TeacherSettingsScreen({ lang, setLang, profile, setProfile, onAbout, onLogout }) {
  const ar = lang === 'ar';
  const [edit, setEdit] = useStateTSet(false);
  const [notif, setNotif] = useStateTSet({ messages: true, students: true, requests: true, reminders: true, announcements: true });
  const setN = (k, v) => setNotif(prev => ({ ...prev, [k]: v }));
  const notifItems = [
    { k: 'messages', icon: 'message-circle', en: 'Parent messages', ar: 'رسائل الأهل', dEn: 'New chat replies from parents', dA: 'ردود الأهل في المحادثات' },
    { k: 'students', icon: 'users', en: 'Student updates', ar: 'تحديثات الطلاب', dEn: 'Absences & roster changes', dA: 'الغياب وتغييرات القائمة' },
    { k: 'requests', icon: 'calendar-check', en: 'Request approvals', ar: 'موافقات الطلبات', dEn: 'Event, trip & exam decisions', dA: 'قرارات الفعاليات والرحلات والامتحانات' },
    { k: 'reminders', icon: 'clipboard-list', en: 'Evaluation reminders', ar: 'تذكير التقييم', dEn: 'Pending daily evaluations', dA: 'التقييمات اليومية المعلّقة' },
    { k: 'announcements', icon: 'megaphone', en: 'School announcements', ar: 'إعلانات المدرسة', dEn: 'Notices from administration', dA: 'تعميمات الإدارة' },
  ];
  return (
    <div style={{ padding: '0 18px 28px' }}>
      {/* profile header */}
      <div style={{ marginTop: 18, padding: '20px', borderRadius: 'var(--radius-lg)', background: `linear-gradient(135deg, ${VIO_S_SOFT}, color-mix(in srgb, var(--amber-50) 55%, transparent))`, border: '1px solid color-mix(in srgb, var(--role-teacher) 18%, transparent)', display: 'flex', alignItems: 'center', gap: 15 }}>
        <Avatar name={profile.name} src={profile.photo} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? (profile.nameAr || profile.name) : profile.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `معلّمة ${profile.subjectAr || ''} · ٣ فصول` : `${profile.subject || ''} teacher · 3 classes`}</div>
          <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>{profile.phone}</div>
        </div>
        <button onClick={() => setEdit(true)} style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}><Icon name="pencil" size={17} color={VIO_S} /></button>
      </div>

      <TGroup title={ar ? 'الحساب' : 'Account'}>
        <TRow ar={ar} icon="user-round" iconBg={VIO_S_SOFT} iconColor={VIO_S} label={ar ? 'تعديل الاسم والصورة' : 'Edit name & photo'} onClick={() => setEdit(true)} right={<Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />} />
        <TRow ar={ar} icon="lock-keyhole" iconBg="var(--surface-raised)" label={ar ? 'تغيير كلمة المرور' : 'Change password'} onClick={() => {}} right={<Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />} last />
      </TGroup>

      <TGroup title={ar ? 'اللغة' : 'Language'}>
        <div style={{ padding: '12px 15px' }}>
          <div style={{ display: 'flex', gap: 8, background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', padding: 4 }}>
            {[['en', 'English'], ['ar', 'العربية']].map(([v, label]) => {
              const on = lang === v;
              return (
                <button key={v} onClick={() => setLang(v)} style={{ flex: 1, height: 42, borderRadius: 'var(--radius-sm)', border: 'none', background: on ? 'var(--surface-card)' : 'transparent', boxShadow: on ? 'var(--shadow-sm)' : 'none', color: on ? VIO_S : 'var(--text-muted)', fontFamily: v === 'ar' ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>{label}</button>
              );
            })}
          </div>
        </div>
      </TGroup>

      <TGroup title={ar ? 'الإشعارات' : 'Notifications'}>
        {notifItems.map((it, i) => (
          <TRow key={it.k} ar={ar} icon={it.icon} iconBg="var(--surface-raised)" label={ar ? it.ar : it.en} sub={ar ? it.dA : it.dEn} right={<TToggle on={notif[it.k]} onChange={v => setN(it.k, v)} />} last={i === notifItems.length - 1} />
        ))}
      </TGroup>

      <TGroup title={ar ? 'عن التطبيق' : 'About'}>
        <TRow ar={ar} icon="info" iconBg={VIO_S_SOFT} iconColor={VIO_S} label={ar ? 'عن مسار' : 'About Masar'} sub={ar ? 'الشركة المطوّرة للتطبيق' : 'The company behind the app'} onClick={onAbout} right={<Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />} />
        <TRow ar={ar} icon="life-buoy" iconBg="var(--surface-raised)" label={ar ? 'المساعدة والدعم' : 'Help & support'} onClick={() => {}} right={<Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />} />
        <TRow ar={ar} icon="file-text" iconBg="var(--surface-raised)" label={ar ? 'الشروط والخصوصية' : 'Terms & privacy'} onClick={() => {}} right={<Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />} last />
      </TGroup>

      <div style={{ marginTop: 18 }}>
        <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          <TRow ar={ar} icon="log-out" iconBg="var(--danger-50)" label={ar ? 'تسجيل الخروج' : 'Log out'} danger onClick={onLogout} last />
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>Masar Teacher · v2.4.0</div>

      {edit && <TEditProfileSheet lang={lang} profile={profile} onClose={() => setEdit(false)} onSave={(p) => { setProfile(p); setEdit(false); }} />}
    </div>
  );
}

/* ---------------- About Us ---------------- */
function TeacherAboutScreen({ lang, onBack }) {
  const ar = lang === 'ar';
  const stats = [
    { v: '120+', en: 'Nurseries', ar: 'حضانة' },
    { v: '2K+', en: 'Teachers', ar: 'معلّم' },
    { v: '6', en: 'Cities', ar: 'مدن' },
  ];
  const values = [
    { icon: 'clock', en: 'Built to save time', ar: 'يوفّر وقتك', dEn: 'Smart tools that cut the paperwork so you focus on teaching.', dA: 'أدوات ذكية تقلّل الأعمال الورقية لتركّز على التعليم.' },
    { icon: 'heart-handshake', en: 'Closer to families', ar: 'أقرب للعائلات', dEn: 'Clear, warm communication between you and every parent.', dA: 'تواصل واضح ودافئ بينك وبين كل ولي أمر.' },
    { icon: 'shield-check', en: 'Safe & private', ar: 'آمن وخاص', dEn: 'Student data is protected and shared only with the right people.', dA: 'بيانات الطلاب محميّة وتُشارك مع الأشخاص المخوّلين فقط.' },
  ];
  const contacts = [
    { icon: 'globe', label: 'masar.app', sub: ar ? 'الموقع الإلكتروني' : 'Website' },
    { icon: 'mail', label: 'teachers@masar.app', sub: ar ? 'دعم المعلمين' : 'Teacher support' },
    { icon: 'phone', label: '+20 100 000 1234', sub: ar ? 'الدعم' : 'Support' },
    { icon: 'map-pin', label: ar ? 'القاهرة الجديدة، مصر' : 'New Cairo, Egypt', sub: ar ? 'المقر' : 'Headquarters' },
  ];
  const socials = [
    { icon: 'instagram', c: '#E1306C' }, { icon: 'facebook', c: '#1877F2' }, { icon: 'linkedin', c: '#0A66C2' }, { icon: 'twitter', c: '#1C1C1A' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-app)', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '46px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}>
        <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name={ar ? 'arrow-right' : 'arrow-left'} size={20} color="var(--text-body)" /></button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'عن مسار' : 'About Masar'}</h2>
      </div>
      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 18px 28px' }}>
        <div style={{ textAlign: 'center', padding: '30px 16px 24px' }}>
          <div style={{ width: 88, height: 88, borderRadius: 26, background: 'linear-gradient(160deg, #4B3B8F, #3C2E78)', display: 'grid', placeItems: 'center', margin: '0 auto 18px', boxShadow: '0 16px 40px -12px rgba(75,59,143,.5)' }}>
            <MasarMark size={48} light />
          </div>
          <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-.02em', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مسار' : 'Masar'}</h1>
          <p style={{ margin: '8px auto 0', fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-muted)', maxWidth: 300, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'منصّة تربط المعلمين بالأهل والإدارة — تقييم، تقارير، وتواصل في تطبيق واحد.' : 'A platform connecting teachers with parents & administration — evaluations, reports, and communication in one app.'}</p>
        </div>
        <div style={{ display: 'flex', background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ flex: 1, padding: '16px 8px', textAlign: 'center', borderInlineStart: i ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: VIO_S, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? s.ar : s.en}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22, padding: '18px 18px', borderRadius: 'var(--radius-lg)', background: VIO_S_SOFT, border: '1px solid color-mix(in srgb, var(--role-teacher) 18%, transparent)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: VIO_S, marginBottom: 7, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مهمّتنا' : 'Our mission'}</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'أن نمكّن كل معلّم من رعاية طلابه والتواصل مع عائلاتهم بسهولة — عبر تقنية بسيطة وآمنة وإنسانية.' : 'To empower every teacher to care for their students and connect with families effortlessly — through technology that is simple, secure and human.'}</p>
        </div>
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {values.map((v, i) => (
            <div key={i} style={{ display: 'flex', gap: 13, padding: '15px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: VIO_S_SOFT, color: VIO_S, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={v.icon} size={21} /></span>
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
              <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', color: VIO_S, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={c.icon} size={18} /></span>
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

Object.assign(window, { TeacherSettingsScreen, TeacherAboutScreen });
