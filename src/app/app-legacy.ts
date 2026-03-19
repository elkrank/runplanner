type Tab = 'training' | 'sleep' | 'weight';
type SessionType = 'easy' | 'moderate' | 'hard' | 'rest';

type Session = {
  type: SessionType;
  kind: string;
  dist: string;
  dur: string;
  pace: string;
  notes: string;
};

type SleepEntry = {
  bedtime: string;
  wakeup: string;
  duration: number;
  quality: number;
  wakeups: number;
  notes: string;
} | null;

type WeightEntry = { date: string; val: number };

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAYS_SHORT = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
const TYPE_LABELS: Record<SessionType, string> = { easy: 'Facile', moderate: 'Modéré', hard: 'Intense', rest: 'Repos' };
const MET: Record<SessionType, number> = { easy: 7.0, moderate: 9.5, hard: 12.5, rest: 1.3 };
const QLABELS: Record<number, string> = { 1: 'Mauvaise', 2: 'Correct', 3: 'Bonne', 4: 'Excellente' };
const QCOLORS: Record<number, string> = { 1: 'var(--hard)', 2: 'var(--moderate)', 3: 'var(--easy)', 4: 'var(--sleep)' };

let initialized = false;
let tab: Tab = 'training';
let weekOff = 0;
let sessions: Record<string, Session[][]> = JSON.parse(localStorage.getItem('rp_sessions') || '{}');
let sleepData: Record<string, SleepEntry[]> = JSON.parse(localStorage.getItem('rp_sleep') || '{}');
let weightLog: WeightEntry[] = JSON.parse(localStorage.getItem('rp_weightlog') || '[]');
let weightGoal = parseFloat(localStorage.getItem('rp_wtgoal') || '0');
let runnerHeight = parseFloat(localStorage.getItem('rp_height') || '0');
let weight = parseFloat(localStorage.getItem('rp_weight') || '70');
let wtRange = 30;
let editState: number | null = null;
let sleepDay: number | null = null;
let selType: SessionType = 'easy';
let selQ = 3;
let curDay: number | null = null;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function getMonday(off = 0) {
  const n = new Date();
  const day = n.getDay();
  const m = new Date(n);
  m.setDate(n.getDate() + (day === 0 ? -6 : 1 - day) + off * 7);
  m.setHours(0, 0, 0, 0);
  return m;
}
function isoWeekRef(d: Date) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
  return dt;
}
function isoWeek(d: Date) {
  const dt = isoWeekRef(d);
  return Math.ceil((((+dt - +new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))) / 86400000) + 1) / 7);
}
function selectedWeekNumber(off = weekOff) { return isoWeek(getMonday(off)); }
function wkey(off = weekOff) { const d = getMonday(off); return `${d.getFullYear()}-W${String(selectedWeekNumber(off)).padStart(2, '0')}`; }
function dates(off = weekOff) { const m = getMonday(off); return Array.from({ length: 7 }, (_, i) => { const d = new Date(m); d.setDate(m.getDate() + i); return d; }); }
function saveSessions() { localStorage.setItem('rp_sessions', JSON.stringify(sessions)); }
function saveSleep() { localStorage.setItem('rp_sleep', JSON.stringify(sleepData)); }
function wSessions(off = weekOff) { const k = wkey(off); if (!sessions[k]) sessions[k] = Array.from({ length: 7 }, () => []); return sessions[k]; }
function wSleep(off = weekOff) { const k = wkey(off); if (!sleepData[k]) sleepData[k] = Array(7).fill(null); return sleepData[k]; }

function kcal(s: Session) {
  const w = weight || 70;
  if (s.type === 'rest') return 0;
  const f = { easy: 1.0, moderate: 1.1, hard: 1.25 }[s.type] || 1;
  if (s.dist && parseFloat(s.dist) > 0) return Math.round(w * parseFloat(s.dist) * f);
  if (s.dur && parseInt(s.dur, 10) > 0) return Math.round((MET[s.type] || 8) * w * parseInt(s.dur, 10) / 60);
  return 0;
}

function renderTraining(ws: Session[][], sl: SleepEntry[], dd: Date[], today: Date) {
  const p = el<HTMLDivElement>('planner'); p.innerHTML = '';
  dd.forEach((date, i) => {
    const isToday = date.getTime() === today.getTime();
    const col = document.createElement('div'); col.className = 'day-col' + (isToday ? ' today' : '');
    const hdr = document.createElement('div'); hdr.className = 'day-header';
    hdr.innerHTML = `<div class="day-name">${DAYS_SHORT[i]}</div><div class="day-date">${date.getDate()} ${date.toLocaleString('fr-FR', { month: 'short' })}</div>`;
    col.appendChild(hdr);
    const body = document.createElement('div'); body.className = 'day-body';

    const sleepEntry = sl[i];
    if (sleepEntry && sleepEntry.duration) {
      const pct = Math.min(100, (sleepEntry.duration / 10) * 100);
      const dots = sleepEntry.quality ? Array.from({ length: 4 }, (_, k) => `<span class="q-dot ${k < sleepEntry.quality ? 'on' : ''}"></span>`).join('') : '';
      const blk = document.createElement('div'); blk.className = 'sleep-day-block';
      blk.innerHTML = `<div class="sleep-day-header"><span class="sleep-day-label">🌙 Sommeil</span><span class="sleep-day-score" style="color:${QCOLORS[sleepEntry.quality] || 'var(--sleep)'}">${sleepEntry.duration}h</span></div><div class="sleep-bar-bg"><div class="sleep-bar-fill" style="width:${pct}%"></div></div><div class="sleep-info">${sleepEntry.bedtime ? `<span class="sleep-pill">🛏 ${sleepEntry.bedtime}</span>` : ''} ${sleepEntry.wakeup ? `<span class="sleep-pill">⏰ ${sleepEntry.wakeup}</span>` : ''} ${sleepEntry.quality ? `<span class="sleep-pill">${dots}</span>` : ''} ${sleepEntry.wakeups ? `<span class="sleep-pill">↑${sleepEntry.wakeups}×</span>` : ''}</div>`;
      blk.addEventListener('click', () => openSleepModal(i));
      body.appendChild(blk);
    } else {
      const ab = document.createElement('button'); ab.className = 'sleep-add-btn'; ab.type = 'button'; ab.innerHTML = '🌙 Saisir sommeil';
      ab.addEventListener('click', () => openSleepModal(i)); body.appendChild(ab);
    }

    (ws[i] || []).forEach((session, si) => {
      const card = document.createElement('div'); card.className = `session-card ${session.type}`;
      const m = [];
      if (session.dist) m.push(`<span class="meta-pill">📍 ${session.dist} km</span>`);
      if (session.dur) m.push(`<span class="meta-pill">⏱ ${session.dur} min</span>`);
      if (session.pace) m.push(`<span class="meta-pill">🏃 ${session.pace}/km</span>`);
      const c = kcal(session); if (c > 0) m.push(`<span class="meta-pill calorie">🔥 ${c} kcal</span>`);
      card.innerHTML = `<div class="session-type">${TYPE_LABELS[session.type]}</div><div class="session-title">${session.kind}</div>${m.length ? `<div class="session-meta">${m.join('')}</div>` : ''} ${session.notes ? `<div style="font-size:.7rem;color:var(--muted);margin-top:5px;font-style:italic">${session.notes}</div>` : ''}<button class="session-delete" data-d="${i}" data-si="${si}" type="button">✕</button>`;
      card.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (!target.classList.contains('session-delete')) openModal(i, si);
      });
      body.appendChild(card);
    });

    const addBtn = document.createElement('button'); addBtn.className = 'add-session-btn'; addBtn.type = 'button'; addBtn.innerHTML = '＋ Ajouter séance';
    addBtn.addEventListener('click', () => openModal(i, null)); body.appendChild(addBtn);
    body.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const d = target.closest('.session-delete') as HTMLElement | null;
      if (d?.dataset['d'] && d.dataset['si']) {
        wSessions()[parseInt(d.dataset['d'], 10)].splice(parseInt(d.dataset['si'], 10), 1);
        saveSessions(); render(); showToast('Séance supprimée');
      }
    });
    col.appendChild(body); p.appendChild(col);
  });
}

function openModal(di: number, si: number | null) {
  curDay = di; editState = si !== null ? si : null;
  const ws = wSessions(); const ex = si !== null ? ws[di][si] : null;
  el<HTMLDivElement>('modalTitle').textContent = ex ? 'MODIFIER LA SÉANCE' : 'NOUVELLE SÉANCE';
  setType(ex ? ex.type : 'easy');
  el<HTMLSelectElement>('sessionKind').value = ex ? ex.kind : 'Footing facile';
  el<HTMLInputElement>('sessionDist').value = ex ? (ex.dist || '') : '';
  el<HTMLInputElement>('sessionDur').value = ex ? (ex.dur || '') : '';
  el<HTMLInputElement>('sessionPace').value = ex ? (ex.pace || '') : '';
  el<HTMLTextAreaElement>('sessionNotes').value = ex ? (ex.notes || '') : '';
  el<HTMLDivElement>('modalOverlay').classList.add('open');
}
function closeModal() { el<HTMLDivElement>('modalOverlay').classList.remove('open'); curDay = null; editState = null; }
function setType(t: SessionType) { selType = t; document.querySelectorAll<HTMLElement>('.type-btn').forEach((b) => { b.className = 'type-btn'; if (b.dataset['type'] === t) b.classList.add({ easy: 'ae', moderate: 'am', hard: 'ah', rest: 'ar' }[t]); }); }

function slDur(bed: string, wake: string) {
  if (!bed || !wake) return null;
  const [bh, bm] = bed.split(':').map(Number), [wh, wm] = wake.split(':').map(Number);
  let m = (wh * 60 + wm) - (bh * 60 + bm); if (m <= 0) m += 1440;
  return Math.round(m / 60 * 4) / 4;
}
function slColor(h: number) { if (!h) return 'empty-bar'; if (h < 5.5) return 'low'; if (h < 7) return 'ok'; if (h < 8.5) return 'good'; return 'great'; }

function renderSleepPanel(sl: SleepEntry[], dd: Date[], wn: number) {
  el<HTMLSpanElement>('slWeekNum').textContent = String(wn);
  const grid = el<HTMLDivElement>('sleepGrid'); grid.innerHTML = '';
  dd.forEach((date, i) => {
    const s = sl[i];
    const card = document.createElement('div'); card.className = 'sleep-week-card' + (s ? ' filled' : '');
    const dots = s && s.quality ? Array.from({ length: 4 }, (_, k) => `<span class="q-dot ${k < s.quality ? 'on' : ''}"></span>`).join('') : '';
    card.innerHTML = `<div class="swc-day">${DAYS_SHORT[i]}</div><div class="swc-date">${date.getDate()} ${date.toLocaleString('fr-FR', { month: 'short' })}</div>${s && s.duration ? `<div class="swc-hours" style="color:${QCOLORS[s.quality] || 'var(--sleep)'}">${s.duration}h</div><div class="swc-qdots">${dots}</div>${s.bedtime ? `<div class="swc-sub">${s.bedtime} → ${s.wakeup}</div>` : ''} ${s.wakeups ? `<div class="swc-sub">${s.wakeups} réveil(s)</div>` : ''}` : `<div class="swc-hours empty">—</div><div class="swc-sub">Non saisi</div>`}`;
    card.addEventListener('click', () => openSleepModal(i)); grid.appendChild(card);
  });

  const chart = el<HTMLDivElement>('sleepChart'); chart.innerHTML = '';
  const maxH = Math.max(9, ...sl.filter(Boolean).map((s) => s?.duration || 0));
  dd.forEach((_, i) => {
    const s = sl[i], h = s?.duration || 0;
    const pct = h > 0 ? (h / maxH) * 100 : 5;
    const cc = slColor(h);
    const w = document.createElement('div'); w.className = 'sleep-bar-wrap';
    w.innerHTML = `<div style="height:${pct}%;width:100%"><div class="sleep-bar-col ${cc}" style="height:100%" title="${h ? h + 'h' : '—'}"></div></div><div class="sleep-bar-lbl">${DAYS_SHORT[i]}</div><div class="sleep-bar-val">${h ? h + 'h' : '—'}</div>`;
    chart.appendChild(w);
  });

  const tips = el<HTMLDivElement>('sleepTips'); tips.innerHTML = '';
  const filled = sl.filter(Boolean) as Exclude<SleepEntry, null>[];
  const hrs = filled.map((s) => s.duration || 0).filter((h) => h > 0);
  if (!hrs.length) { tips.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:8px 0">Aucune nuit saisie cette semaine. Clique sur un jour pour commencer.</div>'; return; }
  const avg = hrs.reduce((a, b) => a + b, 0) / hrs.length;
  const deficit = Math.max(0, 8 - avg);
  const spread = Math.max(...hrs) - Math.min(...hrs);
  const aq = filled.length ? filled.reduce((a, s) => a + (s.quality || 0), 0) / filled.length : 0;
  const medBed = (() => {
    const bt = filled.filter((s) => s.bedtime).map((s) => { const [h, m] = s.bedtime.split(':').map(Number); return h < 12 ? h * 60 + m + 1440 : h * 60 + m; });
    if (!bt.length) return '—'; const md = bt.sort((a, b) => a - b)[Math.floor(bt.length / 2)]; return `${String(Math.floor(md / 60) % 24).padStart(2, '0')}:${String(md % 60).padStart(2, '0')}`;
  })();
  const rows = [
    { icon: '⏱', label: 'Moyenne / nuit', val: avg.toFixed(1) + 'h', color: avg >= 7 ? 'var(--easy)' : avg >= 6 ? 'var(--moderate)' : 'var(--hard)' },
    { icon: '📉', label: 'Déficit semaine', val: deficit > 0 ? '−' + (deficit * filled.length).toFixed(1) + 'h' : '✓ Suffisant', color: deficit > 0 ? 'var(--hard)' : 'var(--easy)' },
    { icon: '📊', label: 'Régularité', val: spread <= 1.5 ? 'Bonne' : spread <= 2.5 ? 'Irrégulier' : 'Très irrégulier', color: spread <= 1.5 ? 'var(--easy)' : spread <= 2.5 ? 'var(--moderate)' : 'var(--hard)' },
    { icon: '⭐', label: 'Qualité moy.', val: QLABELS[Math.round(aq)] || '—', color: aq >= 3 ? 'var(--easy)' : aq >= 2 ? 'var(--moderate)' : 'var(--hard)' },
    { icon: '🌙', label: 'Coucher médian', val: medBed, color: 'var(--sleep)' },
    { icon: '💡', label: 'Conseil', val: avg < 6 ? 'Priorité au sommeil!' : deficit > 0 ? 'Rattrapez le déficit' : spread > 2 ? 'Régularisez les horaires' : 'Bonne routine 👍', color: 'var(--muted)' }
  ];
  rows.forEach((r) => { const d = document.createElement('div'); d.className = 'tip-row'; d.innerHTML = `<div class="tip-left"><span class="tip-icon">${r.icon}</span><span class="tip-label">${r.label}</span></div><span class="tip-val" style="color:${r.color}">${r.val}</span>`; tips.appendChild(d); });
}

function openSleepModal(di: number) {
  sleepDay = di;
  const sl = wSleep(), ex = sl[di];
  el<HTMLDivElement>('sleepModalTitle').textContent = `SOMMEIL — ${DAYS[di].toUpperCase()}`;
  el<HTMLInputElement>('slBedtime').value = ex?.bedtime || '22:30';
  el<HTMLInputElement>('slWakeup').value = ex?.wakeup || '06:30';
  el<HTMLInputElement>('slDuration').value = ex?.duration ? String(ex.duration) : '';
  el<HTMLInputElement>('slWakeups').value = ex?.wakeups ? String(ex.wakeups) : '0';
  el<HTMLTextAreaElement>('slNotes').value = ex?.notes || '';
  setQ(ex?.quality || 3);
  el<HTMLDivElement>('sleepModal').classList.add('open');
}
function closeSleepModal() { el<HTMLDivElement>('sleepModal').classList.remove('open'); sleepDay = null; }
function setQ(q: number) { selQ = q; document.querySelectorAll<HTMLElement>('.q-btn').forEach((b) => { b.classList.toggle('aq', parseInt(b.dataset['q'] || '0', 10) === q); }); }

function wtBMI(w: number) { if (!runnerHeight || runnerHeight < 100) return null; const h = runnerHeight / 100; return (w / (h * h)).toFixed(1); }
function wtBMILabel(bmi: string | null) { if (!bmi) return '—'; const b = parseFloat(bmi); if (b < 18.5) return 'Insuffisant'; if (b < 25) return 'Normal'; if (b < 30) return 'Surpoids'; return 'Obésité'; }
function wtBMIColor(bmi: string | null) { if (!bmi) return 'var(--muted)'; const b = parseFloat(bmi); if (b < 18.5) return 'var(--moderate)'; if (b < 25) return 'var(--easy)'; if (b < 30) return 'var(--moderate)'; return 'var(--hard)'; }

export function legacySetWeightRange(r: number) {
  wtRange = r;
  document.querySelectorAll<HTMLElement>('.wp-range-btn').forEach((b) => b.classList.toggle('active', parseInt(b.dataset['range'] || '0', 10) === r));
  renderWeightPanel();
}

function renderWeightPanel() {
  const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const cur = sorted.length ? sorted[sorted.length - 1].val : null;
  const first = sorted.length ? sorted[0].val : null;
  const delta = (cur && first) ? (cur - first) : null;
  const goalDiff = (cur && weightGoal) ? (cur - weightGoal) : null;
  const bmi = cur ? wtBMI(cur) : null;

  el<HTMLDivElement>('wtCurrent').textContent = cur ? cur.toFixed(1) + ' kg' : '—';
  el<HTMLDivElement>('wtStart').textContent = first ? first.toFixed(1) + ' kg' : '—';
  el<HTMLDivElement>('wtDelta').textContent = delta !== null ? (delta > 0 ? '+' : '') + delta.toFixed(1) + ' kg' : '—';
  el<HTMLDivElement>('wtDelta').style.color = delta === null ? 'var(--wt)' : delta > 0 ? 'var(--hard)' : delta < 0 ? 'var(--easy)' : 'var(--wt)';
  el<HTMLDivElement>('wtGoalDiff').textContent = goalDiff !== null ? (goalDiff > 0 ? '+' : '') + goalDiff.toFixed(1) + ' kg' : '—';
  el<HTMLDivElement>('wtGoalDiff').style.color = goalDiff === null ? 'var(--wt)' : Math.abs(goalDiff) < 0.5 ? 'var(--easy)' : goalDiff > 0 ? 'var(--hard)' : 'var(--easy)';
  el<HTMLDivElement>('wtBMI').textContent = bmi || '—';
  el<HTMLDivElement>('wtBMI').style.color = bmi ? wtBMIColor(bmi) : 'var(--wt)';

  el<HTMLDivElement>('wpCur').textContent = cur ? cur.toFixed(1) + ' kg' : '—';
  el<HTMLDivElement>('wpDelta').textContent = delta !== null ? (delta > 0 ? '+' : '') + delta.toFixed(1) + ' kg' : '—';
  el<HTMLDivElement>('wpDelta').style.color = delta === null ? 'var(--wt)' : delta > 0 ? 'var(--hard)' : delta < 0 ? 'var(--easy)' : 'var(--wt)';
  el<HTMLDivElement>('wpGoalDiff').textContent = goalDiff !== null ? (goalDiff > 0 ? '+' : '') + goalDiff.toFixed(1) + ' kg' : '—';
  el<HTMLDivElement>('wpGoalDiff').style.color = goalDiff === null ? 'var(--wt)' : Math.abs(goalDiff) < 0.5 ? 'var(--easy)' : goalDiff > 0 ? 'var(--hard)' : 'var(--easy)';
  const bmiLabel = bmi ? `${bmi} (${wtBMILabel(bmi)})` : '—';
  el<HTMLDivElement>('wpBMI').textContent = bmiLabel;
  el<HTMLDivElement>('wpBMI').style.color = bmi ? wtBMIColor(bmi) : 'var(--wt)';
  el<HTMLDivElement>('wpEntries').textContent = String(sorted.length);

  let display = sorted;
  if (wtRange > 0) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - wtRange);
    const cutStr = cutoff.toISOString().split('T')[0];
    display = sorted.filter((entry) => entry.date >= cutStr);
  }

  renderWtChart(display, weightGoal);

  const list = el<HTMLDivElement>('wtLogList'); list.innerHTML = '';
  if (!sorted.length) { list.innerHTML = '<div class="wp-empty">Aucune mesure. Ajoutez votre premier poids !</div>'; return; }
  const rev = [...sorted].reverse();
  rev.forEach((entry, i) => {
    const prev = rev[i + 1];
    const diff = prev ? entry.val - prev.val : null;
    const deltaClass = diff === null ? 'same' : diff > 0 ? 'up' : 'down';
    const deltaStr = diff === null ? '—' : (diff > 0 ? '+' : '') + diff.toFixed(1) + ' kg';
    const row = document.createElement('div'); row.className = 'wp-log-entry';
    row.innerHTML = `<span class="wp-log-date">${new Date(entry.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span><span class="wp-log-val">${entry.val.toFixed(1)} kg</span><span class="wp-log-delta ${deltaClass}">${deltaStr}</span><button class="wp-log-del" data-date="${entry.date}" type="button">✕</button>`;
    list.appendChild(row);
  });
}

function renderWtChart(data: WeightEntry[], goal: number) {
  const wrap = el<HTMLDivElement>('wtChartWrap');
  const W = wrap.clientWidth || 600, H = 220;
  const PAD = { top: 20, right: 20, bottom: 36, left: 44 };
  const cw = W - PAD.left - PAD.right, ch = H - PAD.top - PAD.bottom;
  if (!data.length) { wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="var(--muted)" font-family="DM Sans" font-size="13">Aucune donnée à afficher</text></svg>`; return; }
  const vals = data.map((d) => d.val);
  let minV = Math.min(...vals), maxV = Math.max(...vals);
  if (goal) { minV = Math.min(minV, goal); maxV = Math.max(maxV, goal); }
  const pad = Math.max(0.5, (maxV - minV) * 0.15) || 1;
  minV -= pad; maxV += pad;
  const xScale = (i: number) => PAD.left + (data.length > 1 ? i / (data.length - 1) * cw : cw / 2);
  const yScale = (v: number) => PAD.top + ch - ((v - minV) / (maxV - minV)) * ch;
  let gridLines = '', yLabels = '';
  for (let i = 0; i <= 5; i++) {
    const v = minV + (maxV - minV) * i / 5; const y = yScale(v);
    gridLines += `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + cw}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
    yLabels += `<text x="${PAD.left - 6}" y="${y + 4}" text-anchor="end" fill="var(--muted)" font-family="DM Sans" font-size="10">${v.toFixed(1)}</text>`;
  }
  let xLabels = '';
  const step = Math.max(1, Math.floor(data.length / 6));
  data.forEach((d, i) => {
    if (i % step === 0 || i === data.length - 1) {
      const x = xScale(i), y = PAD.top + ch + 22;
      const dt = new Date(d.date + 'T12:00:00');
      xLabels += `<text x="${x}" y="${y}" text-anchor="middle" fill="var(--muted)" font-family="DM Sans" font-size="10">${dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</text>`;
    }
  });
  let areaPath = `M ${xScale(0)} ${PAD.top + ch}`;
  data.forEach((d, i) => { areaPath += ` L ${xScale(i)} ${yScale(d.val)}`; });
  areaPath += ` L ${xScale(data.length - 1)} ${PAD.top + ch} Z`;
  let linePath = '';
  data.forEach((d, i) => { linePath += (i === 0 ? 'M' : 'L') + ` ${xScale(i)} ${yScale(d.val)}`; });
  let goalLine = '';
  if (goal && goal >= minV && goal <= maxV) {
    const gy = yScale(goal);
    goalLine = `<line x1="${PAD.left}" y1="${gy}" x2="${PAD.left + cw}" y2="${gy}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.7"/><text x="${PAD.left + cw - 2}" y="${gy - 5}" text-anchor="end" fill="var(--accent)" font-family="DM Sans" font-size="10">Objectif ${goal} kg</text>`;
  }
  let dots = '';
  if (data.length <= 60) data.forEach((d, i) => { dots += `<circle cx="${xScale(i)}" cy="${yScale(d.val)}" r="3.5" fill="var(--wt)" stroke="var(--bg)" stroke-width="1.5"><title>${new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR')} — ${d.val} kg</title></circle>`; });
  let trendLine = '';
  if (data.length >= 3) {
    const n = data.length, xs = data.map((_, i) => i), ys = data.map((d) => d.val);
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
    const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    const slope = den ? num / den : 0, intercept = my - slope * mx;
    trendLine = `<line x1="${xScale(0)}" y1="${yScale(intercept)}" x2="${xScale(n - 1)}" y2="${yScale(slope * (n - 1) + intercept)}" stroke="rgba(52,211,153,0.35)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  }
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block"><defs><linearGradient id="wtGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--wt)" stop-opacity="0.25"/><stop offset="100%" stop-color="var(--wt)" stop-opacity="0.02"/></linearGradient></defs>${gridLines}${yLabels}${xLabels}<path d="${areaPath}" fill="url(#wtGrad)"/>${trendLine}${goalLine}<path d="${linePath}" fill="none" stroke="var(--wt)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg>`;
}

export function legacySwitchTab(t: Tab) {
  tab = t;
  el<HTMLButtonElement>('tabTraining').classList.toggle('active', t === 'training');
  el<HTMLButtonElement>('tabSleep').classList.toggle('active', t === 'sleep');
  el<HTMLButtonElement>('tabWeight').classList.toggle('active', t === 'weight');
  el<HTMLDivElement>('planner').style.display = t === 'training' ? 'grid' : 'none';
  el<HTMLDivElement>('sleepPanel').style.display = t === 'sleep' ? 'block' : 'none';
  el<HTMLDivElement>('weightPanel').style.display = t === 'weight' ? 'block' : 'none';
  el<HTMLDivElement>('statsTraining').style.display = t === 'training' ? 'flex' : 'none';
  el<HTMLDivElement>('statsSleep').style.display = t === 'sleep' ? 'flex' : 'none';
  el<HTMLDivElement>('statsWeight').style.display = t === 'weight' ? 'flex' : 'none';
  render();
}

function render() {
  const ws = wSessions(), sl = wSleep(), dd = dates();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const wn = selectedWeekNumber();
  el<HTMLDivElement>('weekLabel').textContent = `SEMAINE ${wn}`;
  let km = 0, min = 0, cnt = 0, cal = 0; const tc: Record<SessionType, number> = { easy: 0, moderate: 0, hard: 0, rest: 0 };
  ws.forEach((day) => day.forEach((s) => { if (s.type !== 'rest') cnt++; if (s.dist) km += parseFloat(s.dist); if (s.dur) min += parseInt(s.dur, 10); cal += kcal(s); tc[s.type] = (tc[s.type] || 0) + 1; }));
  const dom = Object.entries(tc).sort((a, b) => b[1] - a[1])[0];
  el<HTMLDivElement>('statKm').textContent = km > 0 ? km.toFixed(1) + ' km' : '0 km';
  const hh = Math.floor(min / 60), mm = min % 60;
  el<HTMLDivElement>('statTime').textContent = min > 0 ? (hh > 0 ? `${hh}h${mm > 0 ? mm + 'm' : ''}` : `${mm}min`) : '0 h';
  el<HTMLDivElement>('statSessions').textContent = String(cnt);
  el<HTMLDivElement>('statCalories').textContent = cal > 0 ? cal.toLocaleString('fr-FR') + ' kcal' : '— kcal';
  el<HTMLDivElement>('statIntensity').textContent = dom && dom[1] > 0 ? TYPE_LABELS[dom[0] as SessionType] : '—';
  const filled = sl.filter(Boolean) as Exclude<SleepEntry, null>[];
  const hrs = filled.map((s) => s.duration || 0).filter((h) => h > 0);
  el<HTMLDivElement>('slNights').textContent = `${filled.length}/7`;
  if (hrs.length) {
    const avg = hrs.reduce((a, b) => a + b, 0) / hrs.length;
    el<HTMLDivElement>('slAvg').textContent = avg.toFixed(1) + 'h';
    el<HTMLDivElement>('slTotal').textContent = hrs.reduce((a, b) => a + b, 0).toFixed(1) + 'h';
    el<HTMLDivElement>('slBest').textContent = Math.max(...hrs).toFixed(1) + 'h';
    const aq = filled.length ? filled.reduce((a, s) => a + (s.quality || 0), 0) / filled.length : 0;
    el<HTMLDivElement>('slQuality').textContent = QLABELS[Math.round(aq)] || '—';
  } else ['slAvg', 'slTotal', 'slBest', 'slQuality'].forEach((id) => { el<HTMLDivElement>(id).textContent = '—'; });
  if (tab === 'training') renderTraining(ws, sl, dd, today); else if (tab === 'sleep') renderSleepPanel(sl, dd, wn); else renderWeightPanel();
}

function showToast(msg: string, isSleep = false, type = '') {
  const t = el<HTMLDivElement>('toast'); t.textContent = msg;
  t.className = 'toast show' + (isSleep ? ' slp' : '') + (type === 'wt' ? ' wt' : '');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function initSample() {
  const k = wkey(0);
  if (!sessions[k]) {
    sessions[k] = [[{ type: 'easy', kind: 'Footing facile', dist: '8', dur: '48', pace: '6:00', notes: 'Allure conversation' }], [], [{ type: 'hard', kind: 'Fractionné court', dist: '10', dur: '55', pace: '4:15', notes: '10×400m avec 90s récup' }], [{ type: 'easy', kind: 'Récupération active', dist: '5', dur: '35', pace: '7:00', notes: '' }], [], [{ type: 'moderate', kind: 'Sortie longue', dist: '18', dur: '105', pace: '5:50', notes: 'Progressif, allure marathon en fin' }], [{ type: 'rest', kind: 'Repos complet', dist: '', dur: '', pace: '', notes: 'Étirements, foam roller' }]];
    saveSessions();
  }
  if (!sleepData[k] || sleepData[k].every((s) => !s)) {
    sleepData[k] = [{ bedtime: '22:45', wakeup: '06:30', duration: 7.75, quality: 3, wakeups: 1, notes: '' }, { bedtime: '23:30', wakeup: '07:00', duration: 7.5, quality: 2, wakeups: 2, notes: 'Stress avant fractionné' }, { bedtime: '22:00', wakeup: '06:00', duration: 8, quality: 4, wakeups: 0, notes: '' }, { bedtime: '23:00', wakeup: '06:30', duration: 7.5, quality: 3, wakeups: 1, notes: '' }, { bedtime: '00:30', wakeup: '07:30', duration: 7, quality: 2, wakeups: 2, notes: 'Couché tard' }, { bedtime: '22:30', wakeup: '07:30', duration: 9, quality: 4, wakeups: 0, notes: 'Bonne récup sortie longue' }, null];
    saveSleep();
  }
  if (!weightLog.length) {
    const today = new Date(); const base = 74.2;
    for (let i = 34; i >= 0; i -= 2) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const v = parseFloat((base - i * 0.04 + (Math.random() - 0.5) * 0.4).toFixed(1));
      const ds = d.toISOString().split('T')[0];
      if (!weightLog.find((e) => e.date === ds)) weightLog.push({ date: ds, val: v });
    }
    localStorage.setItem('rp_weightlog', JSON.stringify(weightLog));
    weightGoal = 72; localStorage.setItem('rp_wtgoal', String(weightGoal)); el<HTMLInputElement>('wtGoalInput').value = '72';
    runnerHeight = 178; localStorage.setItem('rp_height', String(runnerHeight)); el<HTMLInputElement>('wtHeightInput').value = '178';
    const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
    weight = sorted[sorted.length - 1].val; localStorage.setItem('rp_weight', String(weight));
    el<HTMLInputElement>('runnerWeight').value = String(weight);
  }
}

export function bootstrapLegacyApp() {
  if (initialized) return;
  initialized = true;

  const weightInput = el<HTMLInputElement>('runnerWeight');
  weightInput.value = String(weight);
  weightInput.addEventListener('input', () => { const v = parseFloat(weightInput.value); if (v >= 30 && v <= 200) { weight = v; localStorage.setItem('rp_weight', String(v)); render(); } });

  el<HTMLButtonElement>('prevWeek').addEventListener('click', () => { weekOff--; render(); });
  el<HTMLButtonElement>('nextWeek').addEventListener('click', () => { weekOff++; render(); });
  el<HTMLButtonElement>('clearWeekBtn').addEventListener('click', () => { if (!confirm('Vider les séances de cette semaine ?')) return; sessions[wkey()] = Array.from({ length: 7 }, () => []); saveSessions(); render(); showToast('Semaine vidée'); });
  el<HTMLButtonElement>('exportBtn').addEventListener('click', () => {
    const ws = wSessions(), sl = wSleep(), dd = dates(), wn = selectedWeekNumber();
    let txt = `RUNPLAN — Semaine ${wn}\n${'='.repeat(45)}\n\n`;
    dd.forEach((d, i) => { txt += `${DAYS[i]} ${d.toLocaleDateString('fr-FR')}\n`; const s = sl[i]; if (s?.duration) txt += `  🌙 Sommeil: ${s.duration}h — ${QLABELS[s.quality] || '?'} — ${s.bedtime || '?'}→${s.wakeup || '?'}${s.wakeups ? ` — ${s.wakeups} réveil(s)` : ''}\n`; if (!ws[i] || !ws[i].length) txt += '  — Aucune séance\n'; else ws[i].forEach((session) => { const c = kcal(session); txt += `  • [${TYPE_LABELS[session.type]}] ${session.kind}${session.dist ? ` — ${session.dist} km` : ''}${session.dur ? ` — ${session.dur} min` : ''}${session.pace ? ` @ ${session.pace}/km` : ''}${c > 0 ? ` — ~${c} kcal` : ''}${session.notes ? `\n    Note: ${session.notes}` : ''}\n`; }); txt += '\n'; });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = `runplan-semaine-${wn}.txt`; a.click(); showToast('Export téléchargé ✓');
  });

  if (weightLog.length) {
    const sorted = [...weightLog].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1].val;
    weight = latest; localStorage.setItem('rp_weight', String(latest)); weightInput.value = String(latest);
  }

  document.querySelectorAll<HTMLElement>('.type-btn').forEach((b) => b.addEventListener('click', () => setType((b.dataset['type'] || 'easy') as SessionType)));
  el<HTMLButtonElement>('cancelBtn').addEventListener('click', closeModal);
  el<HTMLDivElement>('modalOverlay').addEventListener('click', (event) => { if (event.target === el('modalOverlay')) closeModal(); });
  el<HTMLButtonElement>('saveBtn').addEventListener('click', () => {
    if (curDay === null) return;
    const session: Session = { type: selType, kind: el<HTMLSelectElement>('sessionKind').value, dist: el<HTMLInputElement>('sessionDist').value, dur: el<HTMLInputElement>('sessionDur').value, pace: el<HTMLInputElement>('sessionPace').value, notes: el<HTMLTextAreaElement>('sessionNotes').value };
    const ws = wSessions(); if (!ws[curDay]) ws[curDay] = [];
    if (editState !== null) { ws[curDay][editState] = session; showToast('Séance mise à jour ✓'); } else { ws[curDay].push(session); showToast('Séance ajoutée ✓'); }
    saveSessions(); closeModal(); render();
  });

  document.querySelectorAll<HTMLElement>('.q-btn').forEach((b) => b.addEventListener('click', () => setQ(parseInt(b.dataset['q'] || '3', 10))));
  ['slBedtime', 'slWakeup'].forEach((id) => el<HTMLInputElement>(id).addEventListener('change', () => { const d = slDur(el<HTMLInputElement>('slBedtime').value, el<HTMLInputElement>('slWakeup').value); if (d !== null) el<HTMLInputElement>('slDuration').value = String(d); }));
  el<HTMLButtonElement>('slCancelBtn').addEventListener('click', closeSleepModal);
  el<HTMLDivElement>('sleepModal').addEventListener('click', (event) => { if (event.target === el('sleepModal')) closeSleepModal(); });
  el<HTMLButtonElement>('slSaveBtn').addEventListener('click', () => {
    if (sleepDay === null) return;
    const bt = el<HTMLInputElement>('slBedtime').value, wk = el<HTMLInputElement>('slWakeup').value;
    let dur = parseFloat(el<HTMLInputElement>('slDuration').value);
    if (!dur || Number.isNaN(dur)) dur = slDur(bt, wk) || 0;
    const entry = { bedtime: bt, wakeup: wk, duration: dur, quality: selQ, wakeups: parseInt(el<HTMLInputElement>('slWakeups').value, 10) || 0, notes: el<HTMLTextAreaElement>('slNotes').value };
    wSleep()[sleepDay] = entry; saveSleep(); closeSleepModal(); render(); showToast('Sommeil enregistré 🌙', true);
  });

  const wtGoalInput = el<HTMLInputElement>('wtGoalInput');
  const wtHeightInput = el<HTMLInputElement>('wtHeightInput');
  wtGoalInput.value = weightGoal ? String(weightGoal) : '';
  wtHeightInput.value = runnerHeight ? String(runnerHeight) : '';
  wtGoalInput.addEventListener('change', () => { weightGoal = parseFloat(wtGoalInput.value) || 0; localStorage.setItem('rp_wtgoal', String(weightGoal)); renderWeightPanel(); });
  wtHeightInput.addEventListener('change', () => { runnerHeight = parseFloat(wtHeightInput.value) || 0; localStorage.setItem('rp_height', String(runnerHeight)); renderWeightPanel(); });
  el<HTMLInputElement>('wtDate').value = new Date().toISOString().split('T')[0];
  el<HTMLButtonElement>('wtAddBtn').addEventListener('click', () => {
    const date = el<HTMLInputElement>('wtDate').value;
    const val = parseFloat(el<HTMLInputElement>('wtVal').value);
    if (!date || Number.isNaN(val) || val < 30 || val > 250) { showToast('Valeur invalide', false, 'wt'); return; }
    weightLog = weightLog.filter((entry) => entry.date !== date); weightLog.push({ date, val });
    localStorage.setItem('rp_weightlog', JSON.stringify(weightLog));
    weight = val; localStorage.setItem('rp_weight', String(val)); weightInput.value = String(val); el<HTMLInputElement>('wtVal').value = '';
    renderWeightPanel(); showToast('Poids enregistré ✓', false, 'wt');
  });
  el<HTMLDivElement>('wtLogList').addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const btn = target.closest('.wp-log-del') as HTMLElement | null;
    if (btn?.dataset['date']) { weightLog = weightLog.filter((x) => x.date !== btn.dataset['date']); localStorage.setItem('rp_weightlog', JSON.stringify(weightLog)); renderWeightPanel(); showToast('Mesure supprimée', false, 'wt'); }
  });

  initSample();
  render();
}
