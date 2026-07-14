/* Masar UI — inline primitives shared by the UI kits.
   Cosmetic mirrors of the bundled components (components/**), styled entirely
   with the design tokens in styles.css so kits render standalone. */
const { useState, useEffect, useRef, Fragment } = React;

/* Render Lucide icons inline through React (no createIcons / DOM mutation,
   which would conflict with React reconciliation on re-render). */
function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 2, style = {} }) {
  const pascal = String(name).split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  const node = (window.lucide && window.lucide.icons && window.lucide.icons[pascal]) || [];
  return React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color,
    strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { display: 'inline-block', flex: 'none', verticalAlign: 'middle', ...style },
  }, node.map((c, i) => React.createElement(c[0], { key: i, ...c[1] })));
}

function Button({ children, variant = 'primary', size = 'md', iconLeft, iconRight, fullWidth, disabled, onClick, style = {} }) {
  const sizes = { sm:{height:34,padding:'0 14px',fs:'var(--text-sm)',r:'var(--radius-sm)',g:7}, md:{height:42,padding:'0 18px',fs:'var(--text-base)',r:'var(--radius-md)',g:8}, lg:{height:52,padding:'0 24px',fs:'var(--text-md)',r:'var(--radius-md)',g:10} };
  const variants = {
    primary:{background:'var(--primary)',color:'var(--text-on-brand)',border:'1px solid transparent',boxShadow:'var(--shadow-sm)'},
    secondary:{background:'var(--surface-card)',color:'var(--text-strong)',border:'1px solid var(--border-strong)'},
    ghost:{background:'transparent',color:'var(--primary)',border:'1px solid transparent'},
    danger:{background:'var(--danger-500)',color:'#fff',border:'1px solid transparent'},
    amber:{background:'var(--amber-500)',color:'#1C1C1A',border:'1px solid transparent',boxShadow:'var(--shadow-sm)'},
  };
  const s = sizes[size], v = variants[variant];
  return React.createElement('button', {
    onClick, disabled,
    style:{ display:'inline-flex',alignItems:'center',justifyContent:'center',gap:s.g,height:s.height,padding:s.padding,width:fullWidth?'100%':'auto',fontFamily:'var(--font-sans)',fontSize:s.fs,fontWeight:'var(--weight-bold)',letterSpacing:'var(--tracking-snug)',borderRadius:s.r,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,whiteSpace:'nowrap',transition:'filter .12s, transform .12s',...v,...style },
    onMouseEnter:e=>{if(!disabled)e.currentTarget.style.filter='brightness(.94)';},
    onMouseLeave:e=>{e.currentTarget.style.filter='none';},
    onMouseDown:e=>{if(!disabled)e.currentTarget.style.transform='scale(.98)';},
    onMouseUp:e=>{e.currentTarget.style.transform='scale(1)';},
  }, iconLeft, children, iconRight);
}

function Badge({ children, tone = 'neutral', solid, dot, style = {} }) {
  const tones = {
    neutral:{soft:['var(--neutral-200)','var(--neutral-700)'],solid:['var(--neutral-700)','#fff'],d:'var(--neutral-500)'},
    teal:{soft:['var(--teal-50)','var(--teal-700)'],solid:['var(--teal-600)','#fff'],d:'var(--teal-500)'},
    amber:{soft:['var(--amber-50)','var(--amber-700)'],solid:['var(--amber-500)','#1C1C1A'],d:'var(--amber-500)'},
    success:{soft:['var(--success-50)','var(--success-700)'],solid:['var(--success-500)','#fff'],d:'var(--success-500)'},
    danger:{soft:['var(--danger-50)','var(--danger-700)'],solid:['var(--danger-500)','#fff'],d:'var(--danger-500)'},
    info:{soft:['var(--info-50)','var(--info-700)'],solid:['var(--info-500)','#fff'],d:'var(--info-500)'},
    violet:{soft:['#EDE8F8','var(--role-teacher)'],solid:['var(--role-teacher)','#fff'],d:'var(--role-teacher)'},
  };
  const t = tones[tone] || tones.neutral; const [bg,fg] = solid?t.solid:t.soft;
  return React.createElement('span', { style:{ display:'inline-flex',alignItems:'center',gap:6,height:24,padding:dot?'0 10px 0 8px':'0 10px',background:bg,color:fg,borderRadius:'var(--radius-pill)',fontFamily:'var(--font-sans)',fontSize:'var(--text-xs)',fontWeight:'var(--weight-bold)',whiteSpace:'nowrap',...style } },
    dot && React.createElement('span',{style:{width:6,height:6,borderRadius:'50%',background:solid?'currentColor':t.d}}), children);
}

function Avatar({ name = '', src, size = 40, status, style = {} }) {
  const initials = name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase() || '–';
  const palette = ['var(--teal-600)','var(--role-teacher)','var(--role-driver)','var(--role-supervisor)','var(--role-accountant)','var(--role-support)'];
  let h=0; for (let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))>>>0;
  const bg = palette[h%palette.length];
  const sc = { present:'var(--success-500)',live:'var(--amber-500)',absent:'var(--danger-500)',offline:'var(--neutral-400)' };
  const ring = Math.max(8,size*0.28);
  return React.createElement('span',{style:{position:'relative',display:'inline-flex',flex:'none',...style}},
    src ? React.createElement('img',{src,alt:name,width:size,height:size,style:{width:size,height:size,borderRadius:'50%',objectFit:'cover',display:'block',boxShadow:'inset 0 0 0 1px rgba(0,0,0,.06)'}})
        : React.createElement('span',{style:{width:size,height:size,borderRadius:'50%',background:bg,color:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-sans)',fontWeight:'var(--weight-bold)',fontSize:size*0.4}},initials),
    status && React.createElement('span',{style:{position:'absolute',right:0,bottom:0,width:ring,height:ring,borderRadius:'50%',background:sc[status],boxShadow:'0 0 0 2px var(--surface-card)'}}));
}

function Card({ children, padding = 'md', interactive, accent, onClick, style = {} }) {
  const pads = { none:0, sm:'var(--space-4)', md:'var(--space-6)', lg:'var(--space-7)' };
  const [hover,setHover] = useState(false);
  return React.createElement('div',{ onClick, onMouseEnter:()=>setHover(true), onMouseLeave:()=>setHover(false),
    style:{ background:'var(--surface-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',padding:pads[padding],boxShadow:interactive&&hover?'var(--shadow-md)':'var(--shadow-sm)',borderLeft:accent?`3px solid ${accent}`:'1px solid var(--border-subtle)',transform:interactive&&hover?'translateY(-2px)':'none',transition:'box-shadow .2s, transform .2s',cursor:onClick?'pointer':'default',...style } }, children);
}

const STATUS = {
  'at-home':{label:'At Home',ar:'في المنزل',tone:'neutral'}, 'in-bus':{label:'In Bus',ar:'في الباص',tone:'amber'},
  'arrived':{label:'Arrived',ar:'وصل',tone:'teal'}, 'classroom':{label:'In Classroom',ar:'في الفصل',tone:'teal'},
  'playing':{label:'Playing',ar:'يلعب',tone:'teal'}, 'nap':{label:'Nap Time',ar:'وقت القيلولة',tone:'info'},
  'left':{label:'Left Nursery',ar:'غادر الحضانة',tone:'amber'}, 'delivered':{label:'Delivered',ar:'تم التسليم',tone:'success'},
};
function StatusPill({ status = 'classroom', lang = 'en', size = 'md', style = {} }) {
  const s = STATUS[status]; const tones = { neutral:['var(--neutral-200)','var(--neutral-700)','var(--neutral-500)'],teal:['var(--teal-50)','var(--teal-700)','var(--teal-500)'],amber:['var(--amber-50)','var(--amber-700)','var(--amber-500)'],info:['var(--info-50)','var(--info-700)','var(--info-500)'],success:['var(--success-50)','var(--success-700)','var(--success-500)'] };
  const [bg,fg,dot] = tones[s.tone]; const live = s.tone==='amber';
  const d = size==='sm'?{h:24,fs:'var(--text-xs)',pad:'0 10px'}:{h:30,fs:'var(--text-sm)',pad:'0 13px'};
  return React.createElement('span',{style:{display:'inline-flex',alignItems:'center',gap:7,height:d.h,padding:d.pad,background:bg,color:fg,borderRadius:'var(--radius-pill)',fontFamily:lang==='ar'?'var(--font-arabic)':'var(--font-sans)',fontSize:d.fs,fontWeight:'var(--weight-bold)',whiteSpace:'nowrap',...style}},
    React.createElement('span',{style:{width:8,height:8,borderRadius:'50%',background:dot,flex:'none',boxShadow:live?'0 0 0 3px rgba(239,159,39,.22)':'none'}}),
    lang==='ar'?s.ar:s.label);
}

function DayPath({ steps = [], orientation = 'horizontal', showLabels = true, showTime = true, style = {} }) {
  const vertical = orientation === 'vertical';
  return React.createElement('div',{style:{display:'flex',flexDirection:vertical?'column':'row',alignItems:vertical?'flex-start':'center',fontFamily:'var(--font-sans)',flexWrap:vertical?'nowrap':'wrap',...style}},
    steps.map((s,i)=>{
      const state = s.state||'pending';
      const color = state==='done'?'var(--status-done)':state==='live'?'var(--status-live)':'var(--status-pending)';
      const last = i===steps.length-1;
      return React.createElement(Fragment,{key:i},
        React.createElement('div',{style:{display:'flex',alignItems:'center',gap:9,flexDirection:vertical?'row':'column',minWidth:vertical?0:56}},
          React.createElement('span',{style:{width:state==='live'?17:13,height:state==='live'?17:13,borderRadius:'50%',background:state==='pending'?'transparent':color,border:`2px solid ${color}`,boxShadow:state==='live'?'var(--shadow-amber)':'none',flex:'none',transition:'all .2s'}}),
          showLabels && React.createElement('span',{style:{display:'flex',flexDirection:'column',gap:1,textAlign:vertical?'start':'center'}},
            React.createElement('span',{style:{fontSize:'var(--text-xs)',fontWeight:state==='live'?'var(--weight-bold)':'var(--weight-semibold)',color:state==='pending'?'var(--text-subtle)':'var(--text-strong)',whiteSpace:'nowrap'}},s.label),
            showTime && s.time && React.createElement('span',{style:{fontSize:'var(--text-2xs)',color:'var(--text-subtle)',fontFamily:'var(--font-mono)'}},s.time))),
        !last && React.createElement('span',{style:{background:state==='done'?'var(--status-done)':'var(--border-subtle)',opacity:state==='done'?0.4:1,...(vertical?{width:2,height:22,marginInlineStart:7}:{height:2,flex:1,minWidth:18,marginTop:showLabels?-18:0})}}));
    }));
}

function StatCard({ label, value, unit = '', delta, deltaDir = 'up', icon, accent = 'var(--primary)', style = {} }) {
  const pos = deltaDir==='up';
  return React.createElement('div',{style:{background:'var(--surface-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',padding:'var(--space-5)',boxShadow:'var(--shadow-sm)',display:'flex',flexDirection:'column',gap:10,fontFamily:'var(--font-sans)',minWidth:0,...style}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}},
      React.createElement('span',{style:{fontSize:'var(--text-xs)',fontWeight:'var(--weight-bold)',letterSpacing:'var(--tracking-caps)',textTransform:'uppercase',color:'var(--text-muted)'}},label),
      icon && React.createElement('span',{style:{width:30,height:30,borderRadius:'var(--radius-sm)',background:`color-mix(in srgb, ${accent} 12%, transparent)`,color:accent,display:'inline-flex',alignItems:'center',justifyContent:'center'}},icon)),
    React.createElement('div',{style:{display:'flex',alignItems:'baseline',gap:6}},
      React.createElement('span',{style:{fontSize:'var(--text-3xl)',fontWeight:'var(--weight-extra)',letterSpacing:'var(--tracking-tight)',color:'var(--text-strong)',fontVariantNumeric:'tabular-nums'}},value),
      unit && React.createElement('span',{style:{fontSize:'var(--text-base)',fontWeight:'var(--weight-semibold)',color:'var(--text-muted)'}},unit)),
    delta!=null && React.createElement('span',{style:{display:'inline-flex',alignItems:'center',gap:4,fontSize:'var(--text-xs)',fontWeight:'var(--weight-bold)',color:pos?'var(--success-700)':'var(--danger-700)'}},
      React.createElement('span',null,pos?'▲':'▼'),delta));
}

function Tabs({ items = [], value, onChange, style = {} }) {
  return React.createElement('div',{style:{display:'flex',gap:4,borderBottom:'1px solid var(--border-subtle)',fontFamily:'var(--font-sans)',...style}},
    items.map(it=>{
      const active = it.value===value;
      return React.createElement('button',{key:it.value,onClick:()=>onChange&&onChange(it.value),
        style:{position:'relative',display:'inline-flex',alignItems:'center',gap:7,padding:'10px 14px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:'var(--text-base)',fontWeight:active?'var(--weight-bold)':'var(--weight-semibold)',color:active?'var(--text-strong)':'var(--text-muted)'}},
        it.label,
        typeof it.count==='number' && React.createElement('span',{style:{fontSize:'var(--text-2xs)',fontWeight:'var(--weight-bold)',color:active?'var(--primary)':'var(--text-subtle)',background:active?'var(--teal-50)':'var(--neutral-200)',borderRadius:'var(--radius-pill)',padding:'1px 7px'}},it.count),
        React.createElement('span',{style:{position:'absolute',insetInline:8,bottom:-1,height:2.5,borderRadius:2,background:active?'var(--primary)':'transparent'}}));
    }));
}

/* Confirm dialog — shared across every portal so destructive/high-stakes
   actions (suspend a tenant, confirm a handover, notify a bus-load of
   parents) all get the same weight of friction instead of each screen
   reinventing its own (or skipping confirmation entirely). */
function ConfirmDialog({ icon = 'alert-triangle', tone = 'danger', title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onClose }) {
  const c = tone === 'danger' ? 'var(--danger-500)' : tone === 'amber' ? 'var(--amber-500)' : 'var(--primary)';
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay-scrim)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 95, padding: 28 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', width: 420, maxWidth: '100%', padding: 26, textAlign: 'center' }}>
        <span style={{ width: 60, height: 60, borderRadius: '50%', background: `color-mix(in srgb, ${c} 12%, transparent)`, color: c, display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}><Icon name={icon} size={30} /></span>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-strong)' }}>{title}</h3>
        <p style={{ margin: '10px auto 22px', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: 340 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" fullWidth onClick={onClose}>{cancelLabel}</Button>
          <button onClick={() => { onConfirm && onConfirm(); onClose(); }} style={{ flex: 1, height: 44, borderRadius: 'var(--radius-md)', border: 'none', background: c, color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* Toast — shared success/undo notification strip, bottom-centered.
   `actionLabel`/`onAction` renders an inline undo/retry button; `duration`
   controls the auto-dismiss timer (longer default when an undo action is
   offered, so there's real time to tap it). */
function Toast({ icon = 'check', tone = 'success', message, actionLabel, onAction, duration, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, duration || (actionLabel ? 4200 : 2600)); return () => clearTimeout(t); }, []);
  const c = tone === 'success' ? 'var(--success-500)' : tone === 'amber' ? 'var(--amber-500)' : tone === 'danger' ? 'var(--danger-500)' : 'var(--primary)';
  return (
    <div style={{ position: 'fixed', bottom: 28, insetInlineStart: '50%', transform: 'translateX(-50%)', zIndex: 99, display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px 13px 20px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-dark, #14201E)', boxShadow: 'var(--shadow-xl)', animation: 'masarToast .3s var(--ease-out)' }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: c, display: 'grid', placeItems: 'center', flex: 'none' }}><Icon name={icon} size={15} color="#fff" /></span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F5F3EE', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>{message}</span>
      {actionLabel && <button onClick={() => { onAction && onAction(); onDone(); }} style={{ background: 'none', border: 'none', color: 'var(--amber-400)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 800, cursor: 'pointer', padding: '4px 6px', marginInlineStart: 2 }}>{actionLabel}</button>}
    </div>
  );
}
if (!document.getElementById('masar-ui-anim')) {
  const s = document.createElement('style'); s.id = 'masar-ui-anim';
  s.textContent = '@keyframes masarToast{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}';
  document.head.appendChild(s);
}

/* Logo mark (SVG) */
function MasarMark({ size = 28, light = false }) {
  const c = light ? '#F5F3EE' : '#0F6E56';
  return React.createElement('svg',{width:size*2.7,height:size,viewBox:'0 0 120 44',fill:'none'},
    React.createElement('line',{x1:22,y1:22,x2:98,y2:22,stroke:c,strokeWidth:2,strokeOpacity:.3}),
    React.createElement('circle',{cx:22,cy:22,r:9,fill:c}),
    React.createElement('circle',{cx:60,cy:22,r:9,fill:c}),
    React.createElement('circle',{cx:98,cy:22,r:11,fill:'#EF9F27'}));
}

Object.assign(window, { Icon, Button, Badge, Avatar, Card, StatusPill, DayPath, StatCard, Tabs, MasarMark, ConfirmDialog, Toast });
