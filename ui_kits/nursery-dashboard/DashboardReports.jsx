const { useState: useStateRep } = React;

/* ====================================================================
   Masar — Dashboard · AI Reports (real flow)
   New report → pick class/students + topic → AI drafts from data →
   read & edit → schedule a send date → send / export / download.
   Overrides window.ReportsView.
   ==================================================================== */
const REP_MGR = 'var(--role-manager)';

/* ---- AI helper (graceful fallback) ---- */
async function repAI(prompt) {
  try { if (window.claude && window.claude.complete) { const t = await window.claude.complete(prompt); return (t || '').trim(); } } catch (e) {}
  return null;
}

const REPORT_TYPES = [
  { v: 'monthly', icon: 'calendar-days', label: 'Monthly progress', sub: 'Understanding, participation & growth' },
  { v: 'subject', icon: 'book-open', label: 'Subject report', sub: 'One subject in depth' },
  { v: 'behavior', icon: 'smile', label: 'Behavior & social', sub: 'Mood, conduct & friendships' },
  { v: 'attendance', icon: 'calendar-check', label: 'Attendance summary', sub: 'Days present & punctuality' },
];

function repStudents() {
  const kids = window.MASAR_CHILDREN || [];
  if (kids.length) return kids.map(c => ({ id: c.id, name: c.name, cls: c.cls, parent: (c.father && c.father.name) || '—' }));
  return [{ id: 'c1', name: 'Yousef Adel', cls: 'KG2 · Sunflower', parent: 'Mohamed Adel' }];
}

/* deterministic sample metrics per child */
function repMetrics(name) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0; h = Math.abs(h);
  const u = 72 + (h % 26), p = 70 + ((h >> 2) % 28), hw = 80 + ((h >> 4) % 20), at = 88 + ((h >> 3) % 12);
  return { understanding: u, participation: p, homework: hw, attendance: at };
}

function fallbackReport(name, type, topic, m) {
  const fn = name.split(' ')[0];
  const subj = topic || (type === 'subject' ? 'English' : 'class activities');
  if (type === 'attendance') return `${fn} attended ${m.attendance}% of sessions this month with good punctuality. ${m.attendance >= 95 ? 'Excellent consistency — keep it up!' : 'A little more regularity in the mornings will help settle into routines.'}`;
  if (type === 'behavior') return `${fn} has been ${m.participation >= 85 ? 'cheerful and very social' : 'settling in well and growing in confidence'} this month. ${fn} cooperates kindly with friends and follows classroom routines. Next focus: ${m.participation < 85 ? 'speaking up more during group time.' : 'taking on small leadership moments in play.'}`;
  if (type === 'subject') return `In ${subj}, ${fn} reached an understanding level of ${m.understanding}% this month. A clear strength is steady focus during guided tasks. Next step: reinforcing new vocabulary with gentle practice at home.`;
  return `${fn} has made good progress this month, with understanding at ${m.understanding}% and participation at ${m.participation}%. ${fn} completes ${m.homework}% of home activities and attends ${m.attendance}% of sessions. A clear strength is ${m.participation >= 85 ? 'active participation in group work' : 'consistency with home tasks'}. Next focus: ${m.understanding < 85 ? 'reinforcing comprehension through play-based practice.' : 'building confidence to lead group activities.'}`;
}

/* ====================================================================
   COMPOSE — pick scope + topic, then AI generates
   ==================================================================== */
function ReportComposer({ onClose, onGenerated }) {
  const F = window.DForms;
  const studs = repStudents();
  const byClass = {};
  studs.forEach(s => { (byClass[s.cls] = byClass[s.cls] || []).push(s); });
  const classNames = Object.keys(byClass);

  const [step, setStep] = useStateRep('scope');     // scope | generating | review
  const [type, setType] = useStateRep('monthly');
  const [topic, setTopic] = useStateRep('');
  const [mode, setMode] = useStateRep('class');      // class | students
  const [selClasses, setSelClasses] = useStateRep([classNames[0]].filter(Boolean));
  const [selStudents, setSelStudents] = useStateRep([]);
  const [drafts, setDrafts] = useStateRep([]);       // {id,name,cls,parent,text,metrics}
  const [progress, setProgress] = useStateRep(0);

  const targets = mode === 'class'
    ? studs.filter(s => selClasses.includes(s.cls))
    : studs.filter(s => selStudents.includes(s.id));

  const toggleClass = (c) => setSelClasses(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  const toggleStudent = (id) => setSelStudents(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const typeMeta = REPORT_TYPES.find(t => t.v === type);

  const generate = async () => {
    setStep('generating'); setProgress(0);
    const out = [];
    for (let i = 0; i < targets.length; i++) {
      const s = targets[i]; const m = repMetrics(s.name);
      const prompt = `You are a kindergarten teacher writing a brief ${typeMeta.label} report for a parent about their child.
Child: ${s.name}. Class: ${s.cls}. ${topic ? 'Topic/subject: ' + topic + '.' : ''}
Data — understanding ${m.understanding}%, participation ${m.participation}%, homework ${m.homework}%, attendance ${m.attendance}%.
Write 3 warm, specific sentences: overall progress, a clear strength, and one gentle next step. No greeting, no sign-off, no quotes.`;
      let text = await repAI(prompt);
      if (!text) text = fallbackReport(s.name, type, topic, m);
      out.push({ id: s.id, name: s.name, cls: s.cls, parent: s.parent, text, metrics: m });
      setProgress(Math.round(((i + 1) / targets.length) * 100));
    }
    setDrafts(out); setStep('review');
  };

  const fieldLbl = { fontSize: 12, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 90, padding: 28 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', width: 760, maxWidth: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--border-subtle)', flex: 'none' }}>
          <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'rgba(239,159,39,.16)', color: 'var(--amber-600)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="sparkles" size={21} /></span>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-strong)' }}>New AI report</h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{step === 'review' ? `${drafts.length} reports drafted — review before sending` : 'Pick who it’s for and a topic — AI drafts from your data'}</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--surface-raised)', display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }}><Icon name="x" size={18} color="var(--text-body)" /></button>
        </div>

        {/* body */}
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
          {step === 'scope' && (
            <React.Fragment>
              {/* report type */}
              <div style={fieldLbl}>Report type</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
                {REPORT_TYPES.map(t => { const on = type === t.v; return (
                  <button key={t.v} onClick={() => setType(t.v)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? REP_MGR : 'var(--border-subtle)'}`, background: on ? 'var(--teal-50)' : 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
                    <span style={{ width: 38, height: 38, borderRadius: 'var(--radius-sm)', background: on ? 'var(--surface-card)' : 'var(--surface-raised)', color: REP_MGR, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={t.icon} size={19} /></span>
                    <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)' }}>{t.label}</span><span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)' }}>{t.sub}</span></span>
                  </button>
                ); })}
              </div>

              {/* topic */}
              <div style={fieldLbl}>Topic / focus <span style={{ textTransform: 'none', fontWeight: 600, color: 'var(--text-subtle)' }}>(optional)</span></div>
              <input value={topic} onChange={e => setTopic(e.target.value)} placeholder={type === 'subject' ? 'e.g. English — Letter Sounds' : 'e.g. June progress, social skills…'} style={{ width: '100%', padding: '11px 14px', border: '1.5px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--text-strong)', background: 'var(--surface-card)', boxSizing: 'border-box', outline: 'none', marginBottom: 22 }} />

              {/* scope mode */}
              <div style={fieldLbl}>Who is it for?</div>
              <div style={{ display: 'flex', gap: 8, background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', padding: 4, marginBottom: 14 }}>
                {[['class', 'By classroom'], ['students', 'Specific children']].map(([v, l]) => { const on = mode === v; return <button key={v} onClick={() => setMode(v)} style={{ flex: 1, height: 38, borderRadius: 'var(--radius-sm)', border: 'none', background: on ? 'var(--surface-card)' : 'transparent', boxShadow: on ? 'var(--shadow-sm)' : 'none', color: on ? REP_MGR : 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>; })}
              </div>

              {mode === 'class' ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {classNames.map(c => { const on = selClasses.includes(c); return (
                    <button key={c} onClick={() => toggleClass(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: `1.5px solid ${on ? REP_MGR : 'var(--border-subtle)'}`, background: on ? 'var(--teal-50)' : 'var(--surface-card)', color: on ? 'var(--teal-700)' : 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {on && <Icon name="check" size={15} color="var(--teal-700)" />}{c} <span style={{ opacity: 0.7 }}>· {byClass[c].length}</span>
                    </button>
                  ); })}
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
                  {classNames.map((c, gi) => (
                    <div key={gi}>
                      <div style={{ padding: '8px 14px', background: 'var(--bg-app)', fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-subtle)', borderTop: gi ? '1px solid var(--border-subtle)' : 'none' }}>{c}</div>
                      {byClass[c].map(s => { const on = selStudents.includes(s.id); return (
                        <button key={s.id} onClick={() => toggleStudent(s.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '8px 14px', border: 'none', borderTop: '1px solid var(--border-subtle)', background: on ? 'var(--teal-50)' : 'transparent', cursor: 'pointer', textAlign: 'start' }}>
                          <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? REP_MGR : 'var(--border-strong)'}`, background: on ? REP_MGR : 'transparent', display: 'grid', placeItems: 'center', flex: 'none' }}>{on && <Icon name="check" size={12} color="#fff" />}</span>
                          <Avatar name={s.name} size={28} />
                          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>{s.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.parent}</div></div>
                        </button>
                      ); })}
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          )}

          {step === 'generating' && (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <span style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,159,39,.14)', color: 'var(--amber-600)', display: 'grid', placeItems: 'center', margin: '0 auto 20px', animation: 'repSpin 1.4s linear infinite' }}><Icon name="loader" size={32} /></span>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-strong)' }}>Drafting reports…</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>AI is reading evaluations, attendance & mood for {targets.length} children</div>
              <div style={{ maxWidth: 320, margin: '20px auto 0', height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--bg-sunken)', overflow: 'hidden' }}><div style={{ width: progress + '%', height: '100%', background: 'var(--amber-500)', borderRadius: 'var(--radius-pill)', transition: 'width .2s' }} /></div>
              <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{progress}%</div>
            </div>
          )}

          {step === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--radius-md)', background: 'var(--teal-50)', border: '1px solid var(--teal-100)' }}>
                <Icon name="info" size={17} color="var(--teal-700)" />
                <span style={{ fontSize: 12.5, color: 'var(--teal-800)', lineHeight: 1.5 }}>Read and edit each report below. You can tweak the wording before scheduling the send.</span>
              </div>
              {drafts.map((d, i) => (
                <div key={d.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', background: 'var(--bg-app)' }}>
                    <Avatar name={d.name} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)' }}>{d.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{d.cls} · to {d.parent}</div></div>
                    <span style={{ display: 'inline-flex', gap: 10 }}>
                      {[['U', d.metrics.understanding], ['P', d.metrics.participation], ['A', d.metrics.attendance]].map(([k, v], j) => <span key={j} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)' }}>{k} <b style={{ color: 'var(--text-strong)' }}>{v}%</b></span>)}
                    </span>
                  </div>
                  <textarea value={d.text} onChange={e => setDrafts(prev => prev.map(x => x.id === d.id ? { ...x, text: e.target.value } : x))} style={{ width: '100%', minHeight: 92, border: 'none', borderTop: '1px solid var(--border-subtle)', padding: '12px 14px', fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box', background: 'var(--surface-card)' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '14px 22px', borderTop: '1px solid var(--border-subtle)', flex: 'none' }}>
          {step === 'scope' && (
            <React.Fragment>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}><b style={{ color: 'var(--text-strong)' }}>{targets.length}</b> report{targets.length === 1 ? '' : 's'} to generate</span>
              <Button variant="secondary" style={{ marginInlineStart: 'auto' }} onClick={onClose}>Cancel</Button>
              <Button variant="primary" disabled={!targets.length} iconLeft={<Icon name="sparkles" size={16} />} onClick={generate}>Generate with AI</Button>
            </React.Fragment>
          )}
          {step === 'review' && (
            <React.Fragment>
              <Button variant="secondary" iconLeft={<Icon name="arrow-left" size={15} />} onClick={() => setStep('scope')}>Back</Button>
              <Button variant="primary" fullWidth iconLeft={<Icon name="send" size={16} />} onClick={() => onGenerated(drafts, { type: typeMeta.label, topic })}>Continue to send</Button>
            </React.Fragment>
          )}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
   SEND — schedule date + channels / export
   ==================================================================== */
function ReportSend({ batch, onClose, onSent }) {
  const F = window.DForms;
  const [when, setWhen] = useStateRep('now');
  const [date, setDate] = useStateRep('2026-06-30');
  const [channels, setChannels] = useStateRep({ app: true, whatsapp: true, email: false });
  const tog = (k) => setChannels(p => ({ ...p, [k]: !p[k] }));

  return (
    <F.PModal icon="send" title="Send reports" subtitle={`${batch.drafts.length} ${batch.meta.type} reports`} width={520} onClose={onClose}
      footer={<React.Fragment>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" fullWidth iconLeft={<Icon name={when === 'now' ? 'send' : 'clock'} size={16} />} onClick={() => onSent(when, date)}>{when === 'now' ? 'Send now' : 'Schedule send'}</Button>
      </React.Fragment>}>
      {/* when */}
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>When to send</div>
      <div style={{ display: 'flex', gap: 8, background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', padding: 4, marginBottom: 14 }}>
        {[['now', 'Send now'], ['schedule', 'Schedule']].map(([v, l]) => { const on = when === v; return <button key={v} onClick={() => setWhen(v)} style={{ flex: 1, height: 38, borderRadius: 'var(--radius-sm)', border: 'none', background: on ? 'var(--surface-card)' : 'transparent', boxShadow: on ? 'var(--shadow-sm)' : 'none', color: on ? REP_MGR : 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>; })}
      </div>
      {when === 'schedule' && (
        <div style={{ marginBottom: 18 }}>
          <F.PField label="Send on"><F.PInput type="date" value={date} onChange={setDate} /></F.PField>
        </div>
      )}

      {/* channels */}
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '6px 0 10px' }}>Deliver via</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {[['app', 'message-circle', 'Parent app notification', 'Masar in-app + push'], ['whatsapp', 'phone', 'WhatsApp', 'Sent to each parent’s number'], ['email', 'mail', 'Email', 'PDF attached']].map(([k, icon, label, sub]) => { const on = channels[k]; return (
          <button key={k} onClick={() => tog(k)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 'var(--radius-md)', border: `1.5px solid ${on ? REP_MGR : 'var(--border-subtle)'}`, background: on ? 'var(--teal-50)' : 'var(--surface-card)', cursor: 'pointer', textAlign: 'start' }}>
            <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)', color: REP_MGR, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={18} /></span>
            <span style={{ flex: 1 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>{label}</span><span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)' }}>{sub}</span></span>
            <span style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? REP_MGR : 'var(--border-strong)'}`, background: on ? REP_MGR : 'transparent', display: 'grid', placeItems: 'center', flex: 'none' }}>{on && <Icon name="check" size={13} color="#fff" />}</span>
          </button>
        ); })}
      </div>

      {/* export row */}
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Or export</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="secondary" fullWidth iconLeft={<Icon name="download" size={16} />}>Download PDF</Button>
        <Button variant="secondary" fullWidth iconLeft={<Icon name="share-2" size={16} />}>Share link</Button>
      </div>
    </F.PModal>
  );
}

/* ====================================================================
   VIEW
   ==================================================================== */
const SEED_SENT = [
  { id: 's1', type: 'Monthly progress', scope: 'KG2 · Sunflower', count: 18, date: 'Jun 1', status: 'sent' },
  { id: 's2', type: 'Subject report', scope: 'KG1 · Tulip · English', count: 16, date: 'May 28', status: 'sent' },
];

function ReportsView() {
  const F = window.DForms;
  const [compose, setCompose] = useStateRep(false);
  const [pendingBatch, setPendingBatch] = useStateRep(null); // {drafts, meta}
  const [sendOpen, setSendOpen] = useStateRep(false);
  const [history, setHistory] = useStateRep(SEED_SENT);
  const [reading, setReading] = useStateRep(null);
  const [confirmDel, setConfirmDel] = useStateRep(null);
  const [toast, setToast] = useStateRep(null);

  const onGenerated = (drafts, meta) => { setPendingBatch({ drafts, meta }); setCompose(false); setSendOpen(true); };
  const onSent = (when, date) => {
    const b = pendingBatch;
    const scope = Array.from(new Set(b.drafts.map(d => d.cls))).join(', ');
    setHistory(prev => [{ id: 'h' + Date.now(), type: b.meta.type, scope: scope + (b.meta.topic ? ' · ' + b.meta.topic : ''), count: b.drafts.length, date: when === 'now' ? 'Today' : new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), status: when === 'now' ? 'sent' : 'scheduled', drafts: b.drafts }, ...prev]);
    setSendOpen(false); setPendingBatch(null);
    setToast({ msg: when === 'now' ? `${b.drafts.length} reports sent to parents` : `${b.drafts.length} reports scheduled for ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, icon: when === 'now' ? 'send' : 'clock' });
  };

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* hero */}
      <Card padding="lg" style={{ background: 'var(--surface-dark)', border: 'none', display: 'flex', alignItems: 'center', gap: 20 }}>
        <span style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)', background: 'rgba(239,159,39,.18)', color: 'var(--amber-400)', display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name="sparkles" size={26} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--neutral-100)' }}>AI writes parent reports from your data</div>
          <div style={{ fontSize: 13, color: 'var(--teal-100)', marginTop: 3 }}>Pick a class or specific children and a topic — AI drafts each report from teacher evaluations, attendance and mood. You review, then schedule the send.</div>
        </div>
        <Button variant="amber" iconLeft={<Icon name="wand-2" size={17} />} onClick={() => setCompose(true)}>New AI report</Button>
      </Card>

      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        <StatCard label="Sent this term" value={history.filter(h => h.status === 'sent').reduce((n, h) => n + h.count, 0)} accent="var(--success-500)" icon={<Icon name="send" size={16} />} />
        <StatCard label="Scheduled" value={history.filter(h => h.status === 'scheduled').reduce((n, h) => n + h.count, 0)} accent="var(--amber-600)" icon={<Icon name="clock" size={16} />} />
        <StatCard label="Children covered" value={(window.MASAR_CHILDREN || []).length || 6} accent={REP_MGR} icon={<Icon name="users" size={16} />} />
      </div>

      {/* history */}
      <Card padding="none" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>Report history</h3>
          <Button variant="primary" size="sm" iconLeft={<Icon name="plus" size={16} />} style={{ marginInlineStart: 'auto' }} onClick={() => setCompose(true)}>New report</Button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
          <thead><tr style={{ background: 'var(--bg-app)' }}>{['Report', 'Scope', 'Reports', 'Date', 'Status', ''].map((h, i) => <th key={i} style={{ textAlign: 'start', padding: '11px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>{h}</th>)}</tr></thead>
          <tbody>{history.map(h => (
            <tr key={h.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '13px 20px', fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>{h.type}</td>
              <td style={{ padding: '13px 20px', fontSize: 13, color: 'var(--text-body)' }}>{h.scope}</td>
              <td style={{ padding: '13px 20px', fontSize: 13.5, color: 'var(--text-body)' }}>{h.count}</td>
              <td style={{ padding: '13px 20px', fontSize: 13, color: 'var(--text-muted)' }}>{h.date}</td>
              <td style={{ padding: '13px 20px' }}>{h.status === 'sent' ? <Badge tone="success" dot>Sent</Badge> : <Badge tone="amber" dot>Scheduled</Badge>}</td>
              <td style={{ padding: '10px 20px', textAlign: 'end' }}><F.Menu items={[
                { icon: 'eye', label: 'Read reports', onClick: () => h.drafts ? setReading(h) : null },
                { icon: 'pen', label: 'Edit & resend', onClick: () => h.drafts ? setReading(h) : null },
                { icon: 'download', label: 'Download PDF', onClick: () => setToast({ msg: 'Report PDF downloaded', icon: 'download' }) },
                { icon: 'share-2', label: 'Share link', onClick: () => setToast({ msg: 'Shareable link copied', icon: 'link' }) },
                { divider: true },
                h.status === 'scheduled'
                  ? { icon: 'send', label: 'Send now', color: 'var(--success-600)', onClick: () => { setHistory(prev => prev.map(x => x.id === h.id ? { ...x, status: 'sent', date: 'Today' } : x)); setToast({ msg: `${h.count} reports sent now`, icon: 'send' }); } }
                  : { icon: 'rotate-ccw', label: 'Resend to parents', onClick: () => setToast({ msg: `${h.count} reports resent`, icon: 'send' }) },
                { icon: 'trash-2', label: 'Delete report', danger: true, onClick: () => setConfirmDel(h) },
              ]} /></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>

      {compose && <ReportComposer onClose={() => setCompose(false)} onGenerated={onGenerated} />}
      {sendOpen && pendingBatch && <ReportSend batch={pendingBatch} onClose={() => { setSendOpen(false); }} onSent={onSent} />}
      {reading && (
        <div onClick={() => setReading(null)} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 90, padding: 28 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', width: 600, maxWidth: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 22px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ flex: 1 }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>{reading.type}</h3><div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{reading.scope} · {reading.count} reports</div></div>
              <button onClick={() => setReading(null)} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'var(--surface-raised)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="x" size={18} color="var(--text-body)" /></button>
            </div>
            <div style={{ padding: 22, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(reading.drafts || []).map(d => (
                <div key={d.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><Avatar name={d.name} size={30} /><div><div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)' }}>{d.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{d.cls}</div></div></div>
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.6 }}>{d.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {toast && <F.Toast message={toast.msg} icon={toast.icon} tone={toast.tone} onDone={() => setToast(null)} />}
      {confirmDel && <F.ConfirmDialog icon="trash-2" tone="danger" title="Delete this report?" message={`This removes the ${confirmDel.type} batch (${confirmDel.count} reports) from history. This cannot be undone.`} confirmLabel="Delete" onConfirm={() => { setHistory(prev => prev.filter(x => x.id !== confirmDel.id)); setToast({ msg: 'Report deleted', icon: 'trash-2', tone: 'amber' }); }} onClose={() => setConfirmDel(null)} />}
    </div>
  );
}

if (!document.getElementById('rep-anim')) { const s = document.createElement('style'); s.id = 'rep-anim'; s.textContent = '@keyframes repSpin{to{transform:rotate(360deg)}}'; document.head.appendChild(s); }
window.ReportsView = ReportsView;
