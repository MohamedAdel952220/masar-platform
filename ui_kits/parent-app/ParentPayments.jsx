const { useState: useStateP } = React;

/* ====================================================================
   Masar — Parent App · Payments
   Itemised billing (nursery = monthly, school = per-term) + 4 pay flows:
   bank transfer · InstaPay · wallet · Fawry.
   Loaded after masar-ui.jsx, before ParentApp.jsx. Exposes window.PaymentsScreen.
   ==================================================================== */

/* ---------------- Shared invoice renderer ----------------
   Opens a styled, printable invoice in a new window (Save as PDF / Print).
   Far more reliable than a blob download inside a sandboxed iframe, and
   produces a real invoice the parent can keep. */
function openPrintableInvoice({ ar, title, invNo, meta, lines, total, methodLabel, methodRef }) {
  const dir = ar ? 'rtl' : 'ltr';
  const f = ar ? "'Cairo','Segoe UI',sans-serif" : "'Segoe UI',system-ui,sans-serif";
  const metaRows = meta.map(([k, v]) => `<tr><td style="color:#6B6B66;padding:6px 0;">${k}</td><td style="text-align:${ar ? 'left' : 'right'};font-weight:700;color:#1C1C1A;">${v}</td></tr>`).join('');
  const itemRows = lines.map(l => `<tr><td style="padding:11px 0;border-bottom:1px solid #ECE9E2;">${l.label}</td><td style="padding:11px 0;border-bottom:1px solid #ECE9E2;text-align:${ar ? 'left' : 'right'};font-weight:700;font-variant-numeric:tabular-nums;">${l.amount.toLocaleString('en-US')} EGP</td></tr>`).join('');
  const html = `<!DOCTYPE html><html dir="${dir}" lang="${ar ? 'ar' : 'en'}"><head><meta charset="utf-8"><title>${invNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:${f};background:#F5F3EE;color:#1C1C1A;padding:32px 18px;}
  .card{max-width:520px;margin:0 auto;background:#fff;border-radius:18px;padding:30px 28px;box-shadow:0 8px 30px rgba(0,0,0,.08);}
  .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;}
  .brand{display:flex;align-items:center;gap:9px;font-size:20px;font-weight:800;color:#0F6E56;}
  .dot{width:26px;height:26px;border-radius:7px;background:#0F6E56;display:inline-block;}
  .paid{font-size:12px;font-weight:800;color:#1F8A5B;background:#E6F4EC;padding:5px 12px;border-radius:999px;}
  h1{font-size:17px;margin-bottom:16px;}
  table{width:100%;border-collapse:collapse;font-size:14px;}
  .meta{background:#FAF9F6;border-radius:12px;padding:12px 16px;margin-bottom:18px;}
  .total{display:flex;justify-content:space-between;align-items:center;background:#E9F5F1;border-radius:12px;padding:14px 16px;margin-top:16px;font-weight:800;}
  .total .amt{font-size:19px;color:#0C5946;}
  .method{display:flex;align-items:center;gap:10px;border:1px solid #ECE9E2;border-radius:12px;padding:12px 14px;margin-top:14px;font-size:13px;}
  .foot{text-align:center;color:#9A9A93;font-size:11px;margin-top:22px;}
  .btns{max-width:520px;margin:18px auto 0;display:flex;gap:10px;}
  .btns button{flex:1;padding:13px;border:none;border-radius:12px;font-family:${f};font-size:14px;font-weight:800;cursor:pointer;}
  .print{background:#0F6E56;color:#fff;} .close{background:#fff;border:1px solid #ECE9E2 !important;color:#1C1C1A;}
  @media print{.btns{display:none}body{background:#fff;padding:0}.card{box-shadow:none}}
</style></head><body>
  <div class="card">
    <div class="top"><div class="brand"><span class="dot"></span>Masar</div><span class="paid">${ar ? 'مدفوعة' : 'PAID'}</span></div>
    <h1>${title}</h1>
    <div class="meta"><table><tr><td style="color:#6B6B66;padding:6px 0;">${ar ? 'رقم الفاتورة' : 'Invoice no.'}</td><td style="text-align:${ar ? 'left' : 'right'};font-weight:700;font-family:monospace;">${invNo}</td></tr>${metaRows}</table></div>
    <table>${itemRows}</table>
    <div class="total"><span>${ar ? 'الإجمالي المدفوع' : 'Total paid'}</span><span class="amt">${total.toLocaleString('en-US')} EGP</span></div>
    ${methodLabel ? `<div class="method">💳 <div><b>${methodLabel}</b>${methodRef ? `<div style="color:#9A9A93;font-family:monospace;font-size:11px;">${methodRef}</div>` : ''}</div></div>` : ''}
    <div class="foot">Masar Nursery LLC · ${ar ? 'شكرًا لكم' : 'Thank you'}</div>
  </div>
  <div class="btns"><button class="print" onclick="window.print()">${ar ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</button><button class="close" onclick="window.close()">${ar ? 'إغلاق' : 'Close'}</button></div>
</body></html>`;
  const w = window.open('', '_blank');
  if (w && w.document) { w.document.write(html); w.document.close(); return true; }
  return false;
}

/* ---------------- Billing data per child ----------------
   mode 'monthly' (nursery) → items billed each month
   mode 'term'    (school)  → items billed per term       */
const BILLING = {
  yousef: {
    mode: 'monthly',
    planEn: 'Full Day · Premium', planAr: 'يوم كامل · بريميوم',
    cycleEn: 'July 2026', cycleAr: 'يوليو ٢٠٢٦',
    due: [
      { id: 'tuition', cat: 'tuition', icon: 'graduation-cap', tone: 'teal', en: 'Nursery fee', ar: 'اشتراك الحضانة', subEn: 'July 2026', subAr: 'يوليو ٢٠٢٦', amount: 2400, dueEn: 'Due Jul 1', dueAr: 'تستحق ١ يوليو' },
      { id: 'books', cat: 'books', icon: 'book-open', tone: 'violet', en: 'Books & materials', ar: 'الكتب والمستلزمات', subEn: 'Term 3', subAr: 'الفصل الثالث', amount: 650, dueEn: 'Due Jul 1', dueAr: 'تستحق ١ يوليو' },
      { id: 'bus', cat: 'bus', icon: 'bus', tone: 'amber', en: 'Bus · transport', ar: 'الباص · المواصلات', subEn: 'July 2026', subAr: 'يوليو ٢٠٢٦', amount: 600, dueEn: 'Due Jul 1', dueAr: 'تستحق ١ يوليو' },
    ],
    history: [
      { id: 'h1', en: 'Nursery fee · June', ar: 'اشتراك الحضانة · يونيو', amount: 2400, invoice: 'MSR-2406-0188', dateEn: '1 Jun 2026', dateAr: '١ يونيو ٢٠٢٦', method: 'instapay', ref: 'IPN 88421007', lines: [ { en: 'Nursery fee · Full Day', ar: 'اشتراك الحضانة · يوم كامل', amount: 2400 } ] },
      { id: 'h2', en: 'Bus · June', ar: 'الباص · يونيو', amount: 600, invoice: 'MSR-2406-0189', dateEn: '1 Jun 2026', dateAr: '١ يونيو ٢٠٢٦', method: 'instapay', ref: 'IPN 88421140', lines: [ { en: 'Bus · transport', ar: 'الباص · المواصلات', amount: 600 } ] },
      { id: 'h3', en: 'Nursery fee · May', ar: 'اشتراك الحضانة · مايو', amount: 3000, invoice: 'MSR-2405-0143', dateEn: '2 May 2026', dateAr: '٢ مايو ٢٠٢٦', method: 'fawry', ref: 'FWY 4821 9930 17', lines: [ { en: 'Nursery fee · Full Day', ar: 'اشتراك الحضانة · يوم كامل', amount: 2400 }, { en: 'Bus · transport', ar: 'الباص · المواصلات', amount: 600 } ] },
    ],
  },
  lina: {
    mode: 'term',
    planEn: 'KG1 · School year', planAr: 'روضة ١ · العام الدراسي',
    cycleEn: 'Term 2 of 2', cycleAr: 'الترم الثاني من ٢',
    due: [
      { id: 'tuition', cat: 'tuition', icon: 'graduation-cap', tone: 'teal', en: 'Tuition', ar: 'المصروفات الدراسية', subEn: 'Term 2 of 2', subAr: 'الترم الثاني من ٢', amount: 9500, dueEn: 'Due Jul 15', dueAr: 'تستحق ١٥ يوليو' },
      { id: 'bus', cat: 'bus', icon: 'bus', tone: 'amber', en: 'Bus · transport', ar: 'الباص · المواصلات', subEn: 'Term 2', subAr: 'الترم الثاني', amount: 1800, dueEn: 'Due Jul 15', dueAr: 'تستحق ١٥ يوليو' },
    ],
    history: [
      { id: 'h1', en: 'Tuition · Term 1', ar: 'المصروفات · الترم الأول', amount: 9500, invoice: 'MSR-2509-0042', dateEn: '12 Sep 2025', dateAr: '١٢ سبتمبر ٢٠٢٥', method: 'bank', ref: 'IBAN · CIB 8890', lines: [ { en: 'Tuition · Term 1 of 2', ar: 'المصروفات · الترم ١ من ٢', amount: 9500 } ] },
      { id: 'h2', en: 'Books & materials', ar: 'الكتب والمستلزمات', amount: 1200, invoice: 'MSR-2509-0051', dateEn: '12 Sep 2025', dateAr: '١٢ سبتمبر ٢٠٢٥', method: 'wallet', ref: 'VF Cash · 010·6', lines: [ { en: 'Books set · KG1', ar: 'مجموعة الكتب · روضة ١', amount: 800 }, { en: 'Stationery & materials', ar: 'أدوات ومستلزمات', amount: 400 } ] },
      { id: 'h3', en: 'Bus · Term 1', ar: 'الباص · الترم الأول', amount: 1800, invoice: 'MSR-2509-0067', dateEn: '12 Sep 2025', dateAr: '١٢ سبتمبر ٢٠٢٥', method: 'bank', ref: 'IBAN · CIB 8890', lines: [ { en: 'Bus · transport · Term 1', ar: 'الباص · الترم الأول', amount: 1800 } ] },
    ],
  },
};

const PAY_METHODS = [
  { id: 'bank', icon: 'landmark', en: 'Bank transfer', ar: 'تحويل بنكي', descEn: 'To Masar bank account', descAr: 'إلى حساب مسار البنكي', c: 'var(--info-600)' },
  { id: 'instapay', icon: 'arrow-right-left', en: 'InstaPay', ar: 'انستاباي', descEn: 'Instant bank-to-bank', descAr: 'تحويل فوري بين البنوك', c: 'var(--role-teacher)' },
  { id: 'wallet', icon: 'wallet', en: 'Mobile wallet', ar: 'محفظة إلكترونية', descEn: 'Vodafone Cash, etc.', descAr: 'فودافون كاش وغيرها', c: 'var(--danger-600)' },
  { id: 'fawry', icon: 'store', en: 'Fawry', ar: 'فوري', descEn: 'Pay at any outlet', descAr: 'ادفع في أي منفذ', c: 'var(--amber-600)' },
];

const TONE_PAY = { teal: 'var(--teal-600)', violet: 'var(--role-teacher)', amber: 'var(--amber-600)', info: 'var(--info-600)' };
const egp = (n) => n.toLocaleString('en-US');

function SectionTitle({ children }) {
  return <h3 style={{ margin: '22px 0 12px', fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: 'var(--tracking-snug)' }}>{children}</h3>;
}

/* ---------------- Sheet shell ---------------- */
function PaySheet({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-end', zIndex: 9999 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', width: '100%', borderRadius: '28px 28px 0 0', padding: '10px 22px 28px', maxHeight: '94%', overflowY: 'auto', animation: 'sheet .3s var(--ease-out)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 16px' }} />
        {children}
      </div>
    </div>
  );
}

function CopyRow({ label, value, ar }) {
  const [done, setDone] = useStateP(false);
  const copy = () => { try { navigator.clipboard && navigator.clipboard.writeText(value); } catch (e) {} setDone(true); setTimeout(() => setDone(false), 1400); };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      </div>
      <button onClick={copy} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 11px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)', background: done ? 'var(--success-50)' : 'var(--surface-card)', color: done ? 'var(--success-700)' : 'var(--primary)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', fontSize: 12, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>
        <Icon name={done ? 'check' : 'copy'} size={13} />{done ? (ar ? 'تم' : 'Copied') : (ar ? 'نسخ' : 'Copy')}
      </button>
    </div>
  );
}

function AmountBar({ amount, ar }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', marginBottom: 18 }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'المبلغ المطلوب' : 'Amount due'}</span>
      <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>{egp(amount)} <span style={{ fontSize: 13 }}>EGP</span></span>
    </div>
  );
}

/* ---------------- Method-specific flows ---------------- */
function BankFlow({ ar, item, onDone }) {
  const [receipt, setReceipt] = useStateP(false);
  return (
    <div>
      <AmountBar amount={item.amount} ar={ar} />
      <div style={{ marginBottom: 16 }}>
        <CopyRow label={ar ? 'اسم البنك' : 'Bank'} value="CIB — Commercial International Bank" ar={ar} />
        <CopyRow label={ar ? 'اسم المستفيد' : 'Beneficiary'} value="Masar Nursery LLC" ar={ar} />
        <CopyRow label={ar ? 'رقم الحساب' : 'Account number'} value="100 0234 5567 8890" ar={ar} />
        <CopyRow label="IBAN" value="EG38 0019 0005 0000 0234 5567 889" ar={ar} />
      </div>
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--info-50)', marginBottom: 16 }}>
        <Icon name="info" size={17} color="var(--info-600)" style={{ flex: 'none', marginTop: 1 }} />
        <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--info-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'حوّل المبلغ ثم ارفع صورة الإيصال لتأكيد الدفع.' : 'Transfer the amount, then upload the receipt to confirm.'}</span>
      </div>
      <button onClick={() => setReceipt(true)} style={{ width: '100%', padding: receipt ? '12px' : '20px', border: '1.5px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 16 }}>
        <Icon name={receipt ? 'circle-check-big' : 'upload'} size={19} color={receipt ? 'var(--success-600)' : 'var(--primary)'} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: receipt ? 'var(--success-700)' : 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{receipt ? (ar ? 'تم إرفاق الإيصال' : 'Receipt attached') : (ar ? 'رفع إيصال التحويل' : 'Upload transfer receipt')}</span>
      </button>
      <Button variant="primary" fullWidth size="lg" disabled={!receipt} iconLeft={<Icon name="check" size={18} />} onClick={onDone}>{ar ? 'تأكيد الدفع' : 'Confirm payment'}</Button>
    </div>
  );
}

function InstaPayFlow({ ar, item, onDone }) {
  const [opened, setOpened] = useStateP(false);
  return (
    <div>
      <AmountBar amount={item.amount} ar={ar} />
      <div style={{ textAlign: 'center', padding: '8px 0 18px' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'عنوان الدفع على إنستاباي' : 'InstaPay payment address'}</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 'var(--radius-pill)', background: '#EDE8F8' }}>
          <Icon name="at-sign" size={17} color="var(--role-teacher)" />
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--role-teacher)', fontFamily: 'var(--font-mono)' }}>masar@instapay</span>
        </div>
      </div>
      <Button variant="secondary" fullWidth size="lg" iconLeft={<Icon name="external-link" size={18} />} onClick={() => setOpened(true)} style={{ marginBottom: 10 }}>{ar ? 'فتح تطبيق إنستاباي' : 'Open InstaPay app'}</Button>
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', marginBottom: 16 }}>
        <Icon name="info" size={17} color="var(--text-subtle)" style={{ flex: 'none', marginTop: 1 }} />
        <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'أرسل المبلغ للعنوان أعلاه من تطبيق بنكك، ثم اضغط أكملت التحويل.' : 'Send the amount to the address above from your bank app, then tap completed.'}</span>
      </div>
      <Button variant="primary" fullWidth size="lg" disabled={!opened} iconLeft={<Icon name="check" size={18} />} onClick={onDone}>{ar ? 'أكملت التحويل' : "I've completed the transfer"}</Button>
    </div>
  );
}

function WalletFlow({ ar, item, onDone }) {
  const [step, setStep] = useStateP('number');
  const [num, setNum] = useStateP('');
  const [pin, setPin] = useStateP('');
  const field = { width: '100%', padding: '13px 15px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 16, fontFamily: 'var(--font-mono)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none', textAlign: 'center', letterSpacing: '.05em' };
  if (step === 'number') {
    return (
      <div>
        <AmountBar amount={item.amount} ar={ar} />
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-body)', marginBottom: 8, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'رقم المحفظة' : 'Wallet number'}</div>
        <input type="tel" value={num} onChange={e => setNum(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))} placeholder="01XX XXX XXXX" style={field} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 18px', justifyContent: 'center' }}>
          {['Vodafone Cash', 'Orange', 'Etisalat', 'WE Pay'].map(w => <span key={w} style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-subtle)', padding: '4px 9px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-raised)' }}>{w}</span>)}
        </div>
        <Button variant="primary" fullWidth size="lg" disabled={num.length < 11} iconLeft={<Icon name="send" size={17} />} onClick={() => setStep('pin')}>{ar ? 'إرسال رمز التأكيد' : 'Send confirmation code'}</Button>
      </div>
    );
  }
  return (
    <div>
      <AmountBar amount={item.amount} ar={ar} />
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <span style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--danger-50)', color: 'var(--danger-600)', display: 'inline-grid', placeItems: 'center', marginBottom: 10 }}><Icon name="smartphone" size={22} /></span>
        <div style={{ fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.5, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? `أدخل الرقم السري المُرسل إلى ${num}` : `Enter the PIN sent to ${num}`}</div>
      </div>
      <input type="tel" value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="······" style={{ ...field, fontSize: 24, letterSpacing: '.4em', fontWeight: 800 }} />
      <button onClick={() => setStep('number')} style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'تغيير الرقم' : 'Change number'}</button>
      <Button variant="primary" fullWidth size="lg" disabled={pin.length < 6} iconLeft={<Icon name="check" size={18} />} onClick={onDone} style={{ marginTop: 16 }}>{ar ? 'تأكيد الدفع' : 'Confirm payment'}</Button>
    </div>
  );
}

function FawryFlow({ ar, item, onDone }) {
  const [code] = useStateP(() => {
    const r = () => Math.floor(1000 + Math.random() * 9000);
    return `${r()} ${r()} ${String(Math.floor(10 + Math.random() * 89))}`;
  });
  return (
    <div>
      <AmountBar amount={item.amount} ar={ar} />
      <div style={{ textAlign: 'center', padding: '6px 0 4px' }}>
        <span style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--amber-50)', color: 'var(--amber-600)', display: 'inline-grid', placeItems: 'center', marginBottom: 12 }}><Icon name="store" size={26} /></span>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'كود فوري المرجعي' : 'Fawry reference code'}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)', letterSpacing: '.06em', marginBottom: 10 }}>{code}</div>
        <Badge tone="amber" dot>{ar ? 'صالح ٤٨ ساعة' : 'Valid 48 hours'}</Badge>
      </div>
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', margin: '18px 0 16px' }}>
        <Icon name="info" size={17} color="var(--amber-600)" style={{ flex: 'none', marginTop: 1 }} />
        <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-body)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'اذهب لأي ماكينة فوري أو بقالة، اختر «مدارس وحضانات»، وأدخل هذا الكود لإتمام الدفع.' : 'Go to any Fawry machine or grocery, choose "Schools & Nurseries", and enter this code to pay.'}</span>
      </div>
      <Button variant="primary" fullWidth size="lg" iconLeft={<Icon name="check" size={18} />} onClick={onDone}>{ar ? 'تم — في انتظار الدفع' : 'Done — awaiting payment'}</Button>
    </div>
  );
}

/* ---------------- Pay flow container ---------------- */
function PayFlow({ lang, item, onClose, onPaid }) {
  const ar = lang === 'ar';
  const [method, setMethod] = useStateP(null);
  const [success, setSuccess] = useStateP(false);
  const m = PAY_METHODS.find(x => x.id === method);

  if (success) {
    return (
      <PaySheet onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '14px 0 6px' }}>
          <span style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--success-50)', color: 'var(--success-600)', display: 'inline-grid', placeItems: 'center', marginBottom: 16 }}><Icon name="circle-check-big" size={40} /></span>
          <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{m && m.id === 'fawry' ? (ar ? 'تم إنشاء الكود' : 'Code created') : (ar ? 'تم الدفع بنجاح' : 'Payment successful')}</h3>
          <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{(ar ? item.ar : item.en)} · {egp(item.amount)} EGP · {ar ? m.ar : m.en}</p>
        </div>
        <Button variant="primary" fullWidth size="lg" onClick={() => { onPaid(item.id); onClose(); }}>{ar ? 'تم' : 'Done'}</Button>
      </PaySheet>
    );
  }

  return (
    <PaySheet onClose={onClose}>
      {/* header with item */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        {method && <button onClick={() => setMethod(null)} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}><Icon name={ar ? 'arrow-right' : 'arrow-left'} size={18} color="var(--text-body)" /></button>}
        <span style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${TONE_PAY[item.tone]} 12%, transparent)`, color: TONE_PAY[item.tone], display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={item.icon} size={21} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? item.ar : item.en}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{method ? (ar ? m.ar : m.en) : (ar ? item.subAr : item.subEn)}</div>
        </div>
      </div>

      {!method && (
        <div>
          <AmountBar amount={item.amount} ar={ar} />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'اختر طريقة الدفع' : 'Choose payment method'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {PAY_METHODS.map(pm => (
              <button key={pm.id} onClick={() => setMethod(pm.id)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
                <span style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${pm.c} 12%, transparent)`, color: pm.c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={pm.icon} size={21} /></span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? pm.ar : pm.en}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? pm.descAr : pm.descEn}</span>
                </span>
                <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={18} color="var(--text-subtle)" />
              </button>
            ))}
          </div>
        </div>
      )}

      {method === 'bank' && <BankFlow ar={ar} item={item} onDone={() => setSuccess(true)} />}
      {method === 'instapay' && <InstaPayFlow ar={ar} item={item} onDone={() => setSuccess(true)} />}
      {method === 'wallet' && <WalletFlow ar={ar} item={item} onDone={() => setSuccess(true)} />}
      {method === 'fawry' && <FawryFlow ar={ar} item={item} onDone={() => setSuccess(true)} />}
    </PaySheet>
  );
}

/* ---------------- Invoice detail sheet ---------------- */
function InvoiceSheet({ lang, child, bill, inv, onClose }) {
  const ar = lang === 'ar';
  const [downloaded, setDownloaded] = useStateP(false);
  const pm = PAY_METHODS.find(x => x.id === inv.method);
  const lines = (inv.lines && inv.lines.length) ? inv.lines : [{ en: inv.en, ar: inv.ar, amount: inv.amount }];
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const vat = 0;

  const download = () => {
    openPrintableInvoice({
      ar,
      title: ar ? `${child.nameAr} — فاتورة` : `${child.name} — Invoice`,
      invNo: inv.invoice,
      meta: [
        [ar ? 'التاريخ' : 'Date', ar ? inv.dateAr : inv.dateEn],
        [ar ? 'الطالب' : 'Student', ar ? child.nameAr : child.name],
      ],
      lines: lines.map(l => ({ label: ar ? l.ar : l.en, amount: l.amount })),
      total: inv.amount,
      methodLabel: pm ? (ar ? pm.ar : pm.en) : null,
      methodRef: inv.ref,
    });
    setDownloaded(true); setTimeout(() => setDownloaded(false), 1600);
  };

  return (
    <PaySheet onClose={onClose}>
      {/* invoice header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MasarMark size={22} />
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>{ar ? 'فاتورة' : 'Invoice'}</span>
        </div>
        <Badge tone="success" dot>{ar ? 'مدفوعة' : 'Paid'}</Badge>
      </div>

      {/* meta */}
      <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'رقم الفاتورة' : 'Invoice no.'}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>{inv.invoice}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'التاريخ' : 'Date'}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? inv.dateAr : inv.dateEn}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'الطالب' : 'Student'}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? child.nameAr : child.name}</span>
        </div>
      </div>

      {/* line items */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'البنود' : 'Items'}</div>
      <div style={{ marginBottom: 8 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 13.5, color: 'var(--text-body)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? l.ar : l.en}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)', flex: 'none' }}>{egp(l.amount)}</span>
          </div>
        ))}
      </div>

      {/* totals */}
      <div style={{ padding: '6px 0 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'الإجمالي الفرعي' : 'Subtotal'}</span>
          <span style={{ fontSize: 13, color: 'var(--text-body)', fontFamily: 'var(--font-mono)' }}>{egp(subtotal)} EGP</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', marginTop: 8, borderRadius: 'var(--radius-md)', background: 'var(--teal-50)' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--teal-800)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'الإجمالي المدفوع' : 'Total paid'}</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--teal-800)', fontFamily: 'var(--font-mono)' }}>{egp(inv.amount)} EGP</span>
        </div>
      </div>

      {/* method */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', marginTop: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
        <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: pm ? `color-mix(in srgb, ${pm.c} 12%, transparent)` : 'var(--surface-raised)', color: pm ? pm.c : 'var(--text-subtle)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={pm ? pm.icon : 'credit-card'} size={19} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{pm ? (ar ? pm.ar : pm.en) : (ar ? 'دفع' : 'Payment')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{inv.ref}</div>
        </div>
        <Icon name="circle-check-big" size={20} color="var(--success-600)" />
      </div>

      {/* actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <Button variant="secondary" iconLeft={<Icon name="share-2" size={17} />} onClick={() => { try { navigator.share && navigator.share({ title: inv.invoice, text: `${ar ? 'فاتورة' : 'Invoice'} ${inv.invoice} · ${egp(inv.amount)} EGP` }); } catch (e) {} }}>{ar ? 'مشاركة' : 'Share'}</Button>
        <Button variant="primary" fullWidth iconLeft={<Icon name={downloaded ? 'check' : 'download'} size={17} />} onClick={download}>{downloaded ? (ar ? 'تم التحميل' : 'Downloaded') : (ar ? 'تحميل الفاتورة' : 'Download invoice')}</Button>
      </div>
    </PaySheet>
  );
}

/* ---------------- Payments screen ---------------- */
function PaymentsScreen({ lang, child }) {
  const ar = lang === 'ar';
  const bill = BILLING[child.id] || BILLING.yousef;
  const [paid, setPaid] = useStateP([]);
  const [payItem, setPayItem] = useStateP(null);
  const [invoice, setInvoice] = useStateP(null);

  const dueItems = bill.due.filter(i => !paid.includes(i.id));
  const paidItems = bill.due.filter(i => paid.includes(i.id));
  const totalDue = dueItems.reduce((s, i) => s + i.amount, 0);

  return (
    <div style={{ padding: '0 18px 20px' }}>
      {/* plan summary */}
      <SectionTitle>{ar ? 'الباقة الحالية' : 'Current plan'}</SectionTitle>
      <Card padding="md" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? bill.planAr : bill.planEn}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
            <Icon name={bill.mode === 'monthly' ? 'calendar-days' : 'calendar-range'} size={13} color="var(--text-subtle)" />
            {bill.mode === 'monthly' ? (ar ? `فوترة شهرية · ${bill.cycleAr}` : `Monthly billing · ${bill.cycleEn}`) : (ar ? `فوترة بالترم · ${bill.cycleAr}` : `Per-term billing · ${bill.cycleEn}`)}
          </div>
        </div>
        <Badge tone="teal" solid style={{ flex: 'none' }}>{ar ? 'نشطة' : 'Active'}</Badge>
      </Card>

      {/* total due banner */}
      {totalDue > 0 && (
        <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 'var(--radius-lg)', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="circle-alert" size={22} color="var(--amber-700)" style={{ flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'إجمالي المستحق' : 'Total due'}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>{egp(totalDue)} <span style={{ fontSize: 13 }}>EGP</span></div>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--amber-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)', textAlign: 'center', flex: 'none' }}>{dueItems.length} {ar ? 'بنود' : 'items'}</span>
        </div>
      )}

      {/* due items — itemised, each pays separately */}
      <SectionTitle>{ar ? 'بنود مستحقة' : 'Items due'}</SectionTitle>
      {dueItems.length === 0 ? (
        <Card padding="lg" style={{ textAlign: 'center' }}>
          <Icon name="party-popper" size={28} color="var(--success-500)" />
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 8, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'لا توجد مدفوعات مستحقة 🎉' : 'No payments due 🎉'}</div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dueItems.map(it => {
            const c = TONE_PAY[it.tone];
            return (
              <Card key={it.id} padding="md">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={it.icon} size={22} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? it.ar : it.en}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? it.subAr : it.subEn}</div>
                  </div>
                  <div style={{ textAlign: ar ? 'left' : 'right', flex: 'none' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>{egp(it.amount)}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--amber-700)', fontWeight: 700, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? it.dueAr : it.dueEn}</div>
                  </div>
                </div>
                <Button variant="amber" fullWidth size="sm" style={{ marginTop: 12 }} iconLeft={<Icon name="credit-card" size={16} />} onClick={() => setPayItem(it)}>{ar ? 'ادفع هذا البند' : 'Pay this item'}</Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* pay all */}
      {dueItems.length > 1 && (
        <Button variant="primary" fullWidth size="lg" style={{ marginTop: 12 }} iconLeft={<Icon name="layers" size={18} />} onClick={() => setPayItem({ id: 'all', en: 'All due items', ar: 'كل البنود المستحقة', subEn: `${dueItems.length} items`, subAr: `${dueItems.length} بنود`, amount: totalDue, icon: 'wallet', tone: 'teal' })}>{ar ? `ادفع الكل · ${egp(totalDue)} ج.م` : `Pay all · ${egp(totalDue)} EGP`}</Button>
      )}

      {/* paid this cycle */}
      {paidItems.length > 0 && (
        <React.Fragment>
          <SectionTitle>{ar ? 'مدفوع هذه الدورة' : 'Paid this cycle'}</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paidItems.map(it => (
              <Card key={it.id} padding="sm" style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.78 }}>
                <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--success-50)', color: 'var(--success-700)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="check" size={18} /></span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? it.ar : it.en}</div><div style={{ fontSize: 11.5, color: 'var(--success-700)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? 'مدفوع الآن' : 'Paid just now'}</div></div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>{egp(it.amount)}</span>
              </Card>
            ))}
          </div>
        </React.Fragment>
      )}

      {/* history */}
      <SectionTitle>{ar ? 'سجل المدفوعات' : 'Payment history'}</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bill.history.map(h => {
          const pm = PAY_METHODS.find(x => x.id === h.method);
          return (
            <Card key={h.id} padding="sm" interactive onClick={() => setInvoice(h)} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--success-50)', color: 'var(--success-700)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="receipt" size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>{ar ? h.ar : h.en}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, fontFamily: ar ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
                  <span>{ar ? h.dateAr : h.dateEn}</span>
                  {pm && <React.Fragment><span style={{ opacity: 0.5 }}>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name={pm.icon} size={12} color="var(--text-subtle)" />{ar ? pm.ar : pm.en}</span></React.Fragment>}
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', fontFamily: 'var(--font-mono)', flex: 'none' }}>{egp(h.amount)}</span>
              <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={17} color="var(--text-subtle)" style={{ flex: 'none' }} />
            </Card>
          );
        })}
      </div>

      {payItem && <PayFlow lang={lang} item={payItem} onClose={() => setPayItem(null)} onPaid={(id) => { if (id === 'all') setPaid(bill.due.map(i => i.id)); else setPaid(p => [...p, id]); }} />}
      {invoice && <InvoiceSheet lang={lang} child={child} bill={bill} inv={invoice} onClose={() => setInvoice(null)} />}
    </div>
  );
}

window.PaymentsScreen = PaymentsScreen;
window.PayFlow = PayFlow;
window.PAY_METHODS = PAY_METHODS;
window.InvoiceSheet = InvoiceSheet;
window.openPrintableInvoice = openPrintableInvoice;
