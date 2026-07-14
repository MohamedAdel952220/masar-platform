const { useState: useStateCam } = React;

/* ====================================================================
   Masar — Dashboard · Cameras (school-wide CCTV registry)
   Shared camera data on window.MASAR_CAMERAS so Classrooms can link.
   Exposes window.CamerasView + helpers.
   ==================================================================== */
const CAM_MGR = 'var(--role-manager)';

const SEED_CAMERAS = [
  { id: 'cam1', name: 'Sunflower — Front', zone: 'Classroom', room: 'KG2 · Sunflower', online: true, ip: '10.0.4.21', res: '1080p', model: 'Hikvision DS-2CD', audio: true, added: '2024-09-01' },
  { id: 'cam2', name: 'Sunflower — Activity', zone: 'Classroom', room: 'KG2 · Sunflower', online: true, ip: '10.0.4.22', res: '1080p', model: 'Hikvision DS-2CD', audio: false, added: '2024-09-01' },
  { id: 'cam3', name: 'Tulip — Front', zone: 'Classroom', room: 'KG1 · Tulip', online: true, ip: '10.0.4.23', res: '1080p', model: 'Dahua IPC-HFW', audio: true, added: '2024-09-01' },
  { id: 'cam4', name: 'Daisy — Front', zone: 'Classroom', room: 'KG1 · Daisy', online: true, ip: '10.0.4.24', res: '720p', model: 'Dahua IPC-HFW', audio: false, added: '2024-10-12' },
  { id: 'cam5', name: 'Rose — Front', zone: 'Classroom', room: 'KG2 · Rose', online: false, ip: '10.0.4.25', res: '1080p', model: 'Hikvision DS-2CD', audio: true, added: '2024-09-01' },
  { id: 'cam6', name: 'Garden Playground', zone: 'Outdoor', room: 'Shared', online: true, ip: '10.0.4.30', res: '4K', model: 'Axis P32', audio: false, added: '2024-09-01' },
  { id: 'cam7', name: 'Nap Room', zone: 'Rest', room: 'Shared', online: true, ip: '10.0.4.31', res: '720p', model: 'Dahua IPC-HFW', audio: true, added: '2024-09-01' },
  { id: 'cam8', name: 'Main Gate', zone: 'Entrance', room: 'Shared', online: true, ip: '10.0.4.10', res: '1080p', model: 'Hikvision DS-2CD', audio: false, added: '2024-09-01' },
  { id: 'cam9', name: 'Reception Hall', zone: 'Entrance', room: 'Shared', online: true, ip: '10.0.4.11', res: '1080p', model: 'Axis M30', audio: true, added: '2024-09-01' },
  { id: 'cam10', name: 'Cafeteria', zone: 'Common', room: 'Shared', online: true, ip: '10.0.4.40', res: '1080p', model: 'Dahua IPC-HFW', audio: false, added: '2025-01-08' },
];
window.MASAR_CAMERAS = window.MASAR_CAMERAS || SEED_CAMERAS;

const ZONE_OPTS = ['Classroom', 'Outdoor', 'Rest', 'Entrance', 'Common'];
const RES_OPTS = ['720p', '1080p', '4K'];
const ROOM_LINK_OPTS = ['KG2 · Sunflower', 'KG1 · Tulip', 'KG2 · Rose', 'KG1 · Daisy', 'Shared'];

/* Live CCTV-style viewport */
function CamFeed({ label, online, big, room }) {
  if (!online) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: 'var(--neutral-800)', display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Icon name="video-off" size={big ? 34 : 26} color="var(--neutral-500)" />
          <div style={{ fontSize: 11.5, color: 'var(--neutral-500)', marginTop: 6, fontWeight: 700 }}>Offline</div>
        </div>
      </div>
    );
  }
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 50% 18%, #1d3b39 0%, #0E2422 70%, #081715 100%)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5, background: 'linear-gradient(transparent 0 60%, rgba(20,120,95,.14) 60% 100%)' }} />
      <div style={{ position: 'absolute', left: '16%', bottom: '16%', width: big ? 60 : 34, height: big ? 60 : 34, borderRadius: 8, background: 'rgba(245,243,238,.07)' }} />
      <div style={{ position: 'absolute', right: '18%', bottom: '22%', width: big ? 44 : 24, height: big ? 44 : 24, borderRadius: '50%', background: 'rgba(239,159,39,.10)' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px)', pointerEvents: 'none' }} />
      <Icon name="video" size={big ? 40 : 26} color="rgba(245,243,238,.16)" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
      <div style={{ position: 'absolute', top: 9, insetInlineStart: 9, display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 'var(--radius-pill)', background: 'rgba(213,80,58,.92)' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'camBlink 1.4s infinite' }} />
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.1em', color: '#fff' }}>LIVE</span>
      </div>
      <div style={{ position: 'absolute', top: 9, insetInlineEnd: 11, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'rgba(245,243,238,.7)' }}>{ts}</div>
      {label && <div style={{ position: 'absolute', bottom: 9, insetInlineStart: 11, insetInlineEnd: 11, fontSize: big ? 12.5 : 11, fontWeight: 700, color: 'rgba(245,243,238,.92)', textShadow: '0 1px 4px rgba(0,0,0,.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>}
    </div>
  );
}
window.CamFeed = CamFeed;

if (!document.getElementById('cam-anim')) {
  const s = document.createElement('style'); s.id = 'cam-anim';
  s.textContent = '@keyframes camBlink{0%,100%{opacity:1}50%{opacity:.25}}';
  document.head.appendChild(s);
}

/* Add / edit camera form */
function CameraForm({ initial, onClose, onSave }) {
  const F = window.DForms;
  const [c, setC] = useStateCam(initial || { name: '', zone: 'Classroom', room: 'KG2 · Sunflower', ip: '', res: '1080p', model: '', audio: false, online: true });
  const set = (k, v) => setC(p => ({ ...p, [k]: v }));
  const valid = c.name.trim() && c.ip.trim();
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 };
  return (
    <F.PModal icon={initial ? 'video' : 'plus'} title={initial ? 'Edit camera' : 'Add camera'} subtitle={initial ? c.name : 'Register a CCTV stream'} width={560} onClose={onClose}
      footer={<React.Fragment>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" fullWidth disabled={!valid} iconLeft={<Icon name="check" size={16} />} onClick={() => onSave(c)}>{initial ? 'Save camera' : 'Add camera'}</Button>
      </React.Fragment>}>
      <F.PSection icon="video" title="Camera details">
        <div style={{ marginBottom: 18 }}><F.PField label="Camera name" required><F.PInput value={c.name} onChange={v => set('name', v)} placeholder="e.g. Sunflower — Front" /></F.PField></div>
        <div style={grid2}>
          <F.PField label="Zone"><F.PSelect value={c.zone} onChange={v => set('zone', v)} options={ZONE_OPTS} /></F.PField>
          <F.PField label="Linked classroom" hint="Parents of this room see this feed"><F.PSelect value={c.room} onChange={v => set('room', v)} options={ROOM_LINK_OPTS} /></F.PField>
        </div>
      </F.PSection>
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '18px 0' }} />
      <F.PSection icon="settings" title="Stream & hardware">
        <div style={grid2}>
          <F.PField label="Stream IP / RTSP" required><F.PInput value={c.ip} onChange={v => set('ip', v)} placeholder="10.0.4.xx" icon="wifi" /></F.PField>
          <F.PField label="Resolution"><F.PSeg value={c.res} onChange={v => set('res', v)} options={RES_OPTS} /></F.PField>
          <F.PField label="Camera model"><F.PInput value={c.model} onChange={v => set('model', v)} placeholder="e.g. Hikvision DS-2CD" /></F.PField>
          <F.PField label="Microphone">
            <div style={{ display: 'flex', gap: 8, height: 44, alignItems: 'center' }}>
              <button onClick={() => set('audio', !c.audio)} style={{ width: 46, height: 28, borderRadius: 'var(--radius-pill)', border: 'none', background: c.audio ? CAM_MGR : 'var(--neutral-300)', position: 'relative', cursor: 'pointer', padding: 0 }}><span style={{ position: 'absolute', top: 3, insetInlineStart: c.audio ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .2s' }} /></button>
              <span style={{ fontSize: 13, color: 'var(--text-body)', fontWeight: 600 }}>{c.audio ? 'Audio enabled' : 'No audio'}</span>
            </div>
          </F.PField>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--teal-50)', border: '1px solid var(--teal-100)' }}>
          <Icon name="shield-check" size={18} color="var(--teal-600)" />
          <span style={{ fontSize: 12.5, color: 'var(--teal-800)', lineHeight: 1.5 }}>Feeds are encrypted. Parents only see cameras linked to their child’s classroom; staff &amp; managers see all.</span>
        </div>
      </F.PSection>
    </F.PModal>
  );
}

/* View one camera */
function CameraModal({ cam, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,23,21,.86)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 92, padding: 32 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 760, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#F5F3EE' }}>{cam.name}</div>
            <div style={{ fontSize: 13, color: 'rgba(245,243,238,.6)' }}>{cam.zone} · {cam.room} · {cam.res}</div>
          </div>
          <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'rgba(245,243,238,.14)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="x" size={19} color="#F5F3EE" /></button>
        </div>
        <div style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid rgba(245,243,238,.12)' }}>
          <CamFeed label={cam.name} online={cam.online} big room={cam.room} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 'var(--radius-pill)', background: 'rgba(245,243,238,.1)', color: '#F5F3EE', fontSize: 13, fontWeight: 600 }}><Icon name="wifi" size={15} color="#F5F3EE" />{cam.ip}</span>
          {cam.audio && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 'var(--radius-pill)', background: 'rgba(245,243,238,.1)', color: '#F5F3EE', fontSize: 13, fontWeight: 600 }}><Icon name="volume-2" size={15} color="#F5F3EE" />Audio</span>}
        </div>
      </div>
    </div>
  );
}

function CamerasView() {
  const F = window.DForms;
  const [list, setList] = useStateCam(window.MASAR_CAMERAS);
  const [zone, setZone] = useStateCam('all');
  const [form, setForm] = useStateCam(null);
  const [view, setView] = useStateCam(null);
  const [confirm, setConfirm] = useStateCam(null);
  const [toast, setToast] = useStateCam(null);

  const sync = (next) => { window.MASAR_CAMERAS = next; setList(next); };
  const save = (c) => {
    if (form.mode === 'edit') { sync(list.map(x => x.id === c.id ? c : x)); setToast({ msg: 'Camera updated', icon: 'check' }); }
    else { sync([{ ...c, id: 'cam' + Date.now(), added: '2026-06-27' }, ...list]); setToast({ msg: `${c.name} added`, icon: 'video' }); }
    setForm(null);
  };
  const del = (c) => { sync(list.filter(x => x.id !== c.id)); setToast({ msg: `${c.name} removed`, icon: 'trash-2', tone: 'amber' }); };
  const toggle = (c) => { sync(list.map(x => x.id === c.id ? { ...x, online: !x.online } : x)); };

  const zones = ['all', ...ZONE_OPTS];
  const rows = zone === 'all' ? list : list.filter(c => c.zone === zone);
  const online = list.filter(c => c.online).length;

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
        <StatCard label="Cameras" value={list.length} accent={CAM_MGR} icon={<Icon name="video" size={16} />} />
        <StatCard label="Online" value={online} accent="var(--success-500)" icon={<Icon name="wifi" size={16} />} />
        <StatCard label="Offline" value={list.length - online} accent="var(--danger-500)" icon={<Icon name="video-off" size={16} />} />
        <StatCard label="Classrooms covered" value={4} unit="/ 4" accent="var(--teal-600)" icon={<Icon name="door-open" size={16} />} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 7 }}>
          {zones.map(z => { const on = zone === z; return <button key={z} onClick={() => setZone(z)} style={{ height: 36, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: `1px solid ${on ? CAM_MGR : 'var(--border-subtle)'}`, background: on ? CAM_MGR : 'var(--surface-card)', color: on ? '#fff' : 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>{z}</button>; })}
        </div>
        <Button variant="primary" size="sm" iconLeft={<Icon name="plus" size={16} />} style={{ marginInlineStart: 'auto' }} onClick={() => setForm({ mode: 'add' })}>Add camera</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        {rows.map(cam => (
          <Card key={cam.id} padding="none" style={{ overflow: 'hidden' }}>
            <div onClick={() => cam.online && setView(cam)} style={{ position: 'relative', aspectRatio: '16 / 10', cursor: cam.online ? 'pointer' : 'default' }}>
              <CamFeed label={null} online={cam.online} room={cam.room} />
              {cam.room !== 'Shared' && cam.online && (
                <span style={{ position: 'absolute', bottom: 9, insetInlineEnd: 9, display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 'var(--radius-pill)', background: 'rgba(255,255,255,.92)' }}><Icon name="door-open" size={11} color={CAM_MGR} /><span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-strong)' }}>{cam.room.split('·')[1] ? cam.room.split('·')[1].trim() : cam.room}</span></span>
              )}
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cam.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: cam.online ? 'var(--success-500)' : 'var(--danger-500)' }} />{cam.online ? 'Online' : 'Offline'} · {cam.res}</div>
              </div>
              <F.Menu items={[
                { icon: 'maximize', label: 'View live', onClick: () => cam.online && setView(cam) },
                { icon: 'video-pen', label: 'Edit camera', onClick: () => setForm({ mode: 'edit', cam }) },
                { icon: cam.online ? 'power-off' : 'power', label: cam.online ? 'Mark offline' : 'Mark online', onClick: () => toggle(cam) },
                { divider: true },
                { icon: 'trash-2', label: 'Remove camera', danger: true, onClick: () => setConfirm(cam) },
              ]} />
            </div>
          </Card>
        ))}
      </div>

      {form && <CameraForm initial={form.mode === 'edit' ? form.cam : null} onClose={() => setForm(null)} onSave={save} />}
      {view && <CameraModal cam={view} onClose={() => setView(null)} />}
      {confirm && <F.ConfirmDialog icon="trash-2" tone="danger" title={`Remove ${confirm.name}?`} message="This unregisters the camera and removes it from all classroom feeds. This cannot be undone." confirmLabel="Remove camera" onConfirm={() => del(confirm)} onClose={() => setConfirm(null)} />}
      {toast && <F.Toast message={toast.msg} icon={toast.icon} tone={toast.tone} onDone={() => setToast(null)} />}
    </div>
  );
}

window.CamerasView = CamerasView;
