const { useState } = React;

/* ---------------- Data ---------------- */
const NAV = [
  { k:'overview', icon:'layout-dashboard', label:'Overview' },
  { k:'approvals', icon:'check-check', label:'Approvals' },
  { k:'children', icon:'baby', label:'Children' },
  { k:'teachers', icon:'graduation-cap', label:'Teachers' },
  { k:'classrooms', icon:'door-open', label:'Classrooms' },
  { k:'cameras', icon:'video', label:'Cameras' },
  { k:'attendance', icon:'calendar-check', label:'Attendance' },
  { k:'bus', icon:'bus', label:'Bus' },
  { k:'payments', icon:'credit-card', label:'Payments' },
  { k:'reports', icon:'sparkles', label:'AI Reports' },
];
const CHILDREN = [
  { name:'Yousef Adel', cls:'KG2 · Sunflower', parent:'Mohamed Adel', status:'classroom', att:96, pkg:'Full Day' },
  { name:'Lina Adel', cls:'KG1 · Tulip', parent:'Mohamed Adel', status:'playing', att:92, pkg:'Half Day' },
  { name:'Omar Khaled', cls:'KG2 · Sunflower', parent:'Khaled Sami', status:'at-home', att:78, pkg:'Full Day' },
  { name:'Malak Tarek', cls:'KG1 · Daisy', parent:'Tarek Nabil', status:'classroom', att:88, pkg:'Full Day' },
  { name:'Adam Sherif', cls:'KG2 · Tulip', parent:'Sherif Adel', status:'in-bus', att:81, pkg:'Half Day' },
  { name:'Jana Mostafa', cls:'KG1 · Daisy', parent:'Mostafa Ali', status:'nap', att:99, pkg:'Full Day' },
  { name:'Ali Hossam', cls:'KG2 · Sunflower', parent:'Hossam Adel', status:'delivered', att:73, pkg:'Half Day' },
  { name:'Maya Wael', cls:'KG1 · Tulip', parent:'Wael Fathy', status:'at-home', att:90, pkg:'Full Day' },
];
const LIVE = [
  { label:'In Classroom', status:'classroom', n:38 },
  { label:'Playing', status:'playing', n:14 },
  { label:'Nap Time', status:'nap', n:21 },
  { label:'In Bus', status:'in-bus', n:6 },
  { label:'At Home / Left', status:'at-home', n:15 },
];
const ACTIVITY = [
  { icon:'qr-code', tone:'teal', text:'QR pickup validated for Ali Hossam', who:'Gate', time:'2m' },
  { icon:'sparkles', tone:'amber', text:'AI daily reports generated for KG2', who:'AI Engine', time:'18m' },
  { icon:'user-plus', tone:'info', text:'New child enrolled — Hana Sami', who:'Reception', time:'1h' },
  { icon:'credit-card', tone:'success', text:'Payment received — 2,400 EGP', who:'Accountant', time:'2h' },
];

/* ---------------- Shell ---------------- */
function Sidebar({ view, setView, onLogout, profile }) {
  return (
    <aside style={{ width:264, flex:'none', background:'var(--surface-dark)', display:'flex', flexDirection:'column', height:'100vh', position:'sticky', top:0 }}>
      <div style={{ padding:'22px 22px 18px' }}><MasarMark size={22} light/></div>
      <div style={{ padding:'0 14px 6px', fontSize:11, fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(245,243,238,.4)', marginTop:6, paddingLeft:22 }}>Nursery</div>
      <nav style={{ display:'flex', flexDirection:'column', gap:2, padding:'4px 12px', flex:1, overflowY:'auto' }}>
        {NAV.map(n=>{ const on=view===n.k; return (
          <button key={n.k} onClick={()=>setView(n.k)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:'var(--radius-md)', border:'none', cursor:'pointer', background:on?'rgba(245,243,238,.10)':'transparent', color:on?'var(--neutral-100)':'rgba(245,243,238,.62)', fontFamily:'var(--font-sans)', fontSize:14, fontWeight:on?700:600, textAlign:'start', position:'relative' }}>
            {on && <span style={{ position:'absolute', left:-12, top:10, bottom:10, width:3, borderRadius:3, background:'var(--amber-500)' }}/>}
            <Icon name={n.icon} size={19} color={on?'var(--amber-400)':'rgba(245,243,238,.6)'}/>
            {n.label}
          </button>
        );})}
      </nav>
      <div onClick={()=>setView('settings')} style={{ padding:'14px', borderTop:'1px solid rgba(245,243,238,.1)', display:'flex', alignItems:'center', gap:11, cursor:'pointer', background: view==='settings'?'rgba(245,243,238,.06)':'transparent' }}>
        <Avatar name={profile.name} src={profile.photo} size={38}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:700, color:'var(--neutral-100)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{profile.name}</div>
          <div style={{ fontSize:11.5, color:'rgba(245,243,238,.5)' }}>{profile.role}</div>
        </div>
        <button onClick={(e)=>{ e.stopPropagation(); onLogout(); }} title="Log out" style={{ width:32, height:32, borderRadius:'var(--radius-sm)', border:'none', background:'rgba(245,243,238,.08)', display:'grid', placeItems:'center', cursor:'pointer' }}><Icon name="log-out" size={16} color="rgba(245,243,238,.6)"/></button>
      </div>
    </aside>
  );
}

function NotifPanel({ onClose }) {
  const items = [
    { icon:'check-check', tone:'amber', t:'3 teacher requests need approval', s:'Exam, trip & event · tap Approvals', time:'now' },
    { icon:'bus', tone:'success', t:'Bus 3 arrived — 8 children safe', s:'Reception confirmed', time:'12m' },
    { icon:'credit-card', tone:'teal', t:'Payment received — 2,400 EGP', s:'Yousef Adel · June', time:'1h' },
    { icon:'flag', tone:'danger', t:'Concern flagged by Ms. Hala', s:'Behavior · Malak Tarek', time:'2h' },
  ];
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:90 }}>
      <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', top:70, insetInlineEnd:32, width:360, background:'var(--surface-card)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border-subtle)', boxShadow:'var(--shadow-xl)', overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:15, fontWeight:800, color:'var(--text-strong)' }}>Notifications</span>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--primary)', cursor:'pointer' }}>Mark all read</span>
        </div>
        <div style={{ maxHeight:360, overflowY:'auto' }}>
          {items.map((a,i)=>(
            <div key={i} style={{ display:'flex', gap:12, padding:'12px 18px', borderBottom:i<items.length-1?'1px solid var(--border-subtle)':'none', cursor:'pointer' }}>
              <span style={{ width:34, height:34, borderRadius:'var(--radius-sm)', flex:'none', background:`color-mix(in srgb, ${toneColor(a.tone)} 12%, transparent)`, color:toneColor(a.tone), display:'grid', placeItems:'center' }}><Icon name={a.icon} size={17}/></span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13.5, fontWeight:700, color:'var(--text-strong)', lineHeight:1.35 }}>{a.t}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{a.s} · {a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Topbar({ title, subtitle, action, onBell }) {
  return (
    <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 32px', borderBottom:'1px solid var(--border-subtle)', background:'var(--surface-card)', position:'sticky', top:0, zIndex:10 }}>
      <div>
        <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--text-strong)', letterSpacing:'var(--tracking-snug)' }}>{title}</h1>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>{subtitle}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, height:40, padding:'0 14px', borderRadius:'var(--radius-md)', border:'1px solid var(--border-subtle)', background:'var(--bg-app)', width:240 }}>
          <Icon name="search" size={17} color="var(--text-subtle)"/>
          <input placeholder="Search children, staff…" style={{ border:'none', outline:'none', background:'transparent', fontFamily:'var(--font-sans)', fontSize:13.5, color:'var(--text-strong)', width:'100%' }}/>
        </div>
        <button onClick={onBell} style={{ position:'relative', width:40, height:40, borderRadius:'var(--radius-md)', border:'1px solid var(--border-subtle)', background:'var(--surface-card)', display:'grid', placeItems:'center', cursor:'pointer' }}>
          <Icon name="bell" size={18} color="var(--text-body)"/>
          <span style={{ position:'absolute', top:8, right:9, width:7, height:7, borderRadius:'50%', background:'var(--amber-500)' }}/>
        </button>
        {action}
      </div>
    </header>
  );
}

/* ---------------- Views ---------------- */
function Overview({ setView }) {
  const total = LIVE.reduce((a,b)=>a+b.n,0);
  const [allActivity, setAllActivity] = useState(false);
  return (
    <div style={{ padding:32, display:'flex', flexDirection:'column', gap:22 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:18 }}>
        <StatCard label="Children" value={94} icon={<Icon name="baby" size={16}/>}/>
        <StatCard label="Present today" value={86} unit="/ 94" delta="+4" deltaDir="up" accent="var(--success-500)" icon={<Icon name="calendar-check" size={16}/>}/>
        <StatCard label="Revenue (Jun)" value="284k" unit="EGP" delta="+12%" deltaDir="up" accent="var(--role-accountant)" icon={<Icon name="trending-up" size={16}/>}/>
        <StatCard label="Open tickets" value={3} delta="-2" deltaDir="down" accent="var(--role-support)" icon={<Icon name="message-circle" size={16}/>}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:18 }}>
        <Card padding="lg">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
            <div>
              <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'var(--text-strong)' }}>Live now</h3>
              <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:2 }}>Where every child is, right now</div>
            </div>
            <Badge tone="amber" dot>Updated 10:24</Badge>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {LIVE.map((l,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:130, flex:'none' }}><StatusPill status={l.status} size="sm"/></div>
                <div style={{ flex:1, height:10, borderRadius:'var(--radius-pill)', background:'var(--bg-sunken)', overflow:'hidden' }}>
                  <div style={{ width:`${(l.n/total*100).toFixed(0)}%`, height:'100%', borderRadius:'var(--radius-pill)', background: l.status==='in-bus'||l.status==='at-home' ? 'var(--amber-500)' : 'var(--teal-500)' }}/>
                </div>
                <div style={{ width:34, textAlign:'end', fontSize:15, fontWeight:800, color:'var(--text-strong)', fontVariantNumeric:'tabular-nums' }}>{l.n}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card padding="lg">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'var(--text-strong)' }}>Recent activity</h3>
            <span onClick={()=>setAllActivity(true)} style={{ fontSize:12.5, fontWeight:700, color:'var(--primary)', cursor:'pointer' }}>All</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {ACTIVITY.map((a,i)=>(
              <div key={i} style={{ display:'flex', gap:12, padding:'9px 0', borderBottom: i<ACTIVITY.length-1?'1px solid var(--border-subtle)':'none' }}>
                <span style={{ width:34, height:34, borderRadius:'var(--radius-sm)', flex:'none', background:`color-mix(in srgb, ${toneColor(a.tone)} 12%, transparent)`, color:toneColor(a.tone), display:'grid', placeItems:'center' }}><Icon name={a.icon} size={17}/></span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text-strong)', lineHeight:1.35 }}>{a.text}</div>
                  <div style={{ fontSize:11.5, color:'var(--text-subtle)', marginTop:2 }}>{a.who} · {a.time} ago</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card padding="lg" style={{ background:'var(--surface-dark)', border:'none', display:'flex', alignItems:'center', gap:20 }}>
        <span style={{ width:52, height:52, borderRadius:'var(--radius-md)', background:'rgba(239,159,39,.18)', color:'var(--amber-400)', display:'grid', placeItems:'center', flex:'none' }}><Icon name="sparkles" size={26}/></span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:800, color:'var(--neutral-100)' }}>AI daily reports are ready</div>
          <div style={{ fontSize:13, color:'var(--teal-100)', marginTop:3 }}>86 reports compiled from teacher evaluations, supervisor notes, attendance & mood — ready to send to parents.</div>
        </div>
        <Button variant="amber" iconLeft={<Icon name="send" size={17}/>} onClick={()=>setView && setView('reports')}>Review &amp; send</Button>
      </Card>
      {allActivity && <ActivityModal onClose={()=>setAllActivity(false)}/>}
    </div>
  );
}

const ALL_ACTIVITY = [
  { icon:'qr-code', tone:'teal', text:'QR pickup validated for Ali Hossam', who:'Gate', time:'2m' },
  { icon:'sparkles', tone:'amber', text:'AI daily reports generated for KG2', who:'AI Engine', time:'18m' },
  { icon:'user-plus', tone:'info', text:'New child enrolled — Hana Sami', who:'Reception', time:'1h' },
  { icon:'credit-card', tone:'success', text:'Payment received — 2,400 EGP', who:'Accountant', time:'2h' },
  { icon:'bus', tone:'success', text:'Bus 3 arrived — 8 children safe', who:'Reception', time:'2h' },
  { icon:'check-check', tone:'amber', text:'Trip request approved — Aquarium Visit', who:'Manager', time:'3h' },
  { icon:'flag', tone:'danger', text:'Concern flagged by Ms. Hala — Malak Tarek', who:'Teacher', time:'3h' },
  { icon:'video', tone:'info', text:'Camera added — Cafeteria', who:'Admin', time:'4h' },
  { icon:'graduation-cap', tone:'teal', text:'New teacher added — Yasmin Adel', who:'HR', time:'5h' },
  { icon:'calendar-check', tone:'success', text:'Attendance sent to all KG1 parents', who:'Reception', time:'5h' },
  { icon:'credit-card', tone:'success', text:'Payment received — 1,600 EGP', who:'Accountant', time:'6h' },
  { icon:'megaphone', tone:'amber', text:'Announcement sent — Summer schedule', who:'Manager', time:'1d' },
];
function ActivityModal({ onClose }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'var(--overlay-scrim)', backdropFilter:'blur(3px)', display:'grid', placeItems:'center', zIndex:90, padding:28 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--surface-card)', borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-xl)', width:520, maxWidth:'100%', maxHeight:'86vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 22px', borderBottom:'1px solid var(--border-subtle)', flex:'none' }}>
          <span style={{ width:38, height:38, borderRadius:'var(--radius-md)', background:'var(--teal-50)', color:'var(--primary)', display:'grid', placeItems:'center', flex:'none' }}><Icon name="history" size={20}/></span>
          <div style={{ flex:1 }}><h3 style={{ margin:0, fontSize:17, fontWeight:800, color:'var(--text-strong)' }}>All activity</h3><div style={{ fontSize:12.5, color:'var(--text-muted)' }}>Everything happening across the nursery</div></div>
          <button onClick={onClose} style={{ width:34, height:34, borderRadius:'50%', border:'none', background:'var(--surface-raised)', display:'grid', placeItems:'center', cursor:'pointer', flex:'none' }}><Icon name="x" size={18} color="var(--text-body)"/></button>
        </div>
        <div style={{ padding:'8px 22px 18px', overflowY:'auto', flex:1 }}>
          {ALL_ACTIVITY.map((a,i)=>(
            <div key={i} style={{ display:'flex', gap:12, padding:'11px 0', borderBottom: i<ALL_ACTIVITY.length-1?'1px solid var(--border-subtle)':'none' }}>
              <span style={{ width:34, height:34, borderRadius:'var(--radius-sm)', flex:'none', background:`color-mix(in srgb, ${toneColor(a.tone)} 12%, transparent)`, color:toneColor(a.tone), display:'grid', placeItems:'center' }}><Icon name={a.icon} size={17}/></span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13.5, fontWeight:600, color:'var(--text-strong)', lineHeight:1.35 }}>{a.text}</div>
                <div style={{ fontSize:11.5, color:'var(--text-subtle)', marginTop:2 }}>{a.who} · {a.time} ago</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function toneColor(t){ return ({teal:'var(--teal-600)',amber:'var(--amber-600)',info:'var(--info-500)',success:'var(--success-500)'})[t]; }

/* ChildrenView now lives in DashboardChildren.jsx (window.ChildrenView) */

/* AttendanceView now lives in DashboardAttendance.jsx (window.AttendanceView) */

/* PaymentsView now lives in DashboardPayments.jsx (window.PaymentsView) */

function SimpleView({ icon, title, note }) {
  return (
    <div style={{ padding:32 }}>
      <Card padding="lg" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:64, textAlign:'center' }}>
        <span style={{ width:60, height:60, borderRadius:'var(--radius-lg)', background:'var(--teal-50)', color:'var(--primary)', display:'grid', placeItems:'center' }}><Icon name={icon} size={28}/></span>
        <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text-strong)' }}>{title}</h3>
        <p style={{ margin:0, fontSize:14, color:'var(--text-muted)', maxWidth:380, lineHeight:1.5 }}>{note}</p>
      </Card>
    </div>
  );
}

const META = {
  overview:{ t:'Overview', s:'Sunrise Nursery · Tuesday, 20 June' },
  approvals:{ t:'Approvals', s:'Teacher requests — events, trips & exams' },
  children:{ t:'Children', s:'94 enrolled across 6 classrooms' },
  teachers:{ t:'Teachers', s:'12 staff · 8 subjects' },
  classrooms:{ t:'Classrooms', s:'6 rooms · KG1 & KG2' },
  cameras:{ t:'Cameras', s:'School-wide live CCTV' },
  attendance:{ t:'Attendance', s:'Today · 86 of 94 present' },
  bus:{ t:'Bus Management', s:'4 routes · 6 drivers' },
  payments:{ t:'Payments', s:'June billing cycle' },
  reports:{ t:'AI Reports', s:'Daily · weekly · monthly intelligence' },
  settings:{ t:'Settings', s:'Profile, security & preferences' },
};

function Dashboard() {
  const [authed, setAuthed] = useState(false);
  const [dashProfile, setDashProfile] = useState({ name:'Nadia Fouad', role:'Nursery Manager', email:'nadia@sunrise.edu', phone:'+20 100 222 3344', photo:null });
  const [view, setView] = useState('overview');
  const [showNotif, setShowNotif] = useState(false);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const m = META[view];

  if (!authed) {
    return <window.DashboardAuthGate onDone={()=>setAuthed(true)}/>;
  }

  const action = (view==='overview') ? <Button variant="primary" iconLeft={<Icon name="megaphone" size={17}/>} onClick={()=>setShowAnnounce(true)}>Announce</Button>
    : (view==='approvals'||view==='children'||view==='attendance'||view==='reports'||view==='classrooms'||view==='teachers'||view==='bus'||view==='payments') ? null
    : <Button variant="primary" iconLeft={<Icon name="plus" size={17}/>}>Add</Button>;
  return (
    <div style={{ display:'flex', alignItems:'flex-start', background:'var(--bg-app)' }}>
      <Sidebar view={view} setView={setView} profile={dashProfile} onLogout={()=>{ window.MasarClient.auth.signOut().catch(()=>{}); setAuthed(false); setView('overview'); }}/>
      <main style={{ flex:1, minWidth:0, minHeight:'100vh' }}>
        <Topbar title={m.t} subtitle={m.s} action={action} onBell={()=>setShowNotif(true)}/>
        {view==='overview' && <Overview setView={setView}/>}
        {view==='approvals' && <window.ApprovalsView/>}
        {view==='children' && <window.ChildrenView/>}
        {view==='attendance' && <window.AttendanceView/>}
        {view==='payments' && <window.PaymentsView/>}
        {view==='teachers' && <window.TeachersView/>}
        {view==='classrooms' && <window.ClassroomsView/>}
        {view==='cameras' && <window.CamerasView/>}
        {view==='bus' && <window.BusView/>}
        {view==='reports' && <window.ReportsView/>}
        {view==='settings' && <window.DashboardSettings profile={dashProfile} setProfile={setDashProfile} onLogout={()=>{ window.MasarClient.auth.signOut().catch(()=>{}); setAuthed(false); setView('overview'); }}/>}
      </main>
      {showNotif && <NotifPanel onClose={()=>setShowNotif(false)}/>}
      {showAnnounce && <window.AnnounceModal onClose={()=>setShowAnnounce(false)}/>}
    </div>
  );
}
window.Dashboard = Dashboard;
